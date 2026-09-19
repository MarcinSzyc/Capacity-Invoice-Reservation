# ADR-0003: Kafka client library and topic layout

- Status: proposed
- Date: 2026-09-19
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

(empty until Marcin decides)

## Consequences

Per-program ordering across both message types comes from one partition per key. A future
real treasury contract replaces the DTOs and the topic name, not the use cases (A-11). If the
treasury insists on two topics, the consumer becomes two subscriptions of the same class and
INV-07's per-fact monotonic checks carry the ordering burden.
