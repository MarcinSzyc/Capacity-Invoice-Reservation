# ADR-0003: Kafka client library and topic layout

- Status: accepted; amendment proposed 2026-09-26, see Amendments
- Date: proposed 2026-09-19, accepted 2026-09-19
- Slice: S-01 (broker in compose, readiness check), S-02 (consumer)
- Related: A-03, A-04, A-11, A-13, AC-23, AC-24, AC-25, INV-05, INV-07

## Context

Two message types arrive from the treasury, keyed by `programId` (A-11): capacity updates and
reconciliation snapshots. Consumption must be idempotent, staleness-checked, ordered per
program, and a bad message goes to a dead-letter topic while consumption continues (A-13).
The service publishes nothing except dead letters (A-03); dev tooling publishes sample
messages. Everything must run locally from compose, so a pure-JS client avoids native build
steps in the Docker image.

Two decisions travel together: which client library, and whether both message types share
one topic.

## Options

### Client library

**Option 1: kafkajs, used directly behind a port.** Pure JavaScript, ubiquitous, `eachMessage`
with explicit offset handling, headers for dead-letter metadata. Cons: releases are rare
since 2023; the project is maintained but slow.

**Option 2: `@confluentinc/kafka-javascript`.** Confluent's supported client with a
kafkajs-compatible API on librdkafka. Cons: native module, larger image, platform build
concerns on Apple silicon and Alpine images.

**Option 3: `@nestjs/microservices` Kafka transport.** Declarative handlers. Cons: it wraps
kafkajs and hides the consumer, so per-message commit after a database transaction,
dead-lettering and reconnect behaviour become fights with the abstraction.

### Topic layout

**Option A: one topic `treasury.capacity`, `type` field in the payload, key `programId`.**
Every fact about a program is in one partition, so a snapshot and a limit change for the same
program are strictly ordered relative to each other. One consumer, one dispatch by `type`.

**Option B: two topics, `treasury.capacity-updates` and `treasury.reconciliation-snapshots`.**
Independent schemas and retention. Cons: no ordering guarantee across the two for one
program; INV-07 handles it per fact, but reasoning is harder and the dev tooling doubles.

Dead letters go to `treasury.capacity.dlq` in both cases, carrying the original bytes and
headers `error`, `sourceTopic`, `sourcePartition`, `sourceOffset`, `correlationId`.

## Recommendation

Option 1 with Option A: kafkajs behind a `TreasuryMessageSource` port, one topic with a `type`
discriminator, single consumer group `capacity-service`, offset committed after the database
transaction commits (redelivery is harmless because of `messageId` dedupe). Broker in compose
and tests: the official `apache/kafka` image in KRaft mode, single node.

## Decision

Option 1 with Option A: kafkajs used directly behind the `TreasuryMessageSource` port, one
topic `treasury.capacity` with a `type` discriminator in the payload, key `programId`, single
consumer group `capacity-service`, offset committed after the database transaction commits,
dead letters to `treasury.capacity.dlq`. Broker: the official `apache/kafka` image in KRaft
mode, single node, in compose and in Testcontainers.

Considered and declined: the `@nestjs/microservices` Kafka transport is the easiest to wire
in NestJS (a few lines and a decorator), but it wraps kafkajs and hides the consumer, so
committing the offset after our database transaction, dead-lettering with source headers and
pausing a partition on error become fights with the abstraction. The consumer loop we write
ourselves is about fifty lines in one provider with `OnModuleInit` and `OnModuleDestroy`.
Decided by Marcin on 2026-09-19 following the recommendation.

## Consequences

Per-program ordering across both message types comes from one partition per key. A future
real treasury contract replaces the DTOs and the topic name, not the use cases (A-11). If the
treasury insists on two topics, the consumer becomes two subscriptions of the same class and
INV-07's per-fact monotonic checks carry the ordering burden.

## Amendments

### 2026-09-26, proposed in S-08, awaiting Marcin in the S-08 pull request

**Context.** A dead letter carries the original bytes, but the service reads them decompressed
and publishes them uncompressed, and adds headers. A message the broker accepted (compressed, or
just under its 1 MiB `message.max.bytes`, or with a key that is not UTF-8 and triples when
decoded) could come back refused as a dead letter; the offset then stays uncommitted and the
partition stalls for good (A-13 clauses 4 and 6). Found by review rounds 3 and 4 of S-08.

**Options.** (1) Leave an oversized value or key out of the dead letter and name it in a header,
the source topic, partition and offset still finding the original. (2) Publish dead letters
compressed; smaller, but a value that does not compress still does not fit. (3) Raise
`max.message.bytes` on the dead-letter topic; an infrastructure setting a real treasury broker
may not grant, and no finite value covers a compressed input.

**Proposed decision.** Option 1, implemented in S-08: a value past 1 000 000 bytes is left out
with `valueOmitted`, a key past 1 000 bytes with `keyOmitted`; the error header is cut at 2 000
characters. Every other dead letter keeps its original bytes. A message past 8 000 000 bytes is
refused before parsing and dead-lettered by the same rule.

**Consequence.** For an oversized message the dead-letter topic is an index, not a copy: the
original is read from the treasury topic by its source position, while the treasury topic's
retention keeps it.

