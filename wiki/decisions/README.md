# Architecture decision records

One decision per file: `ADR-xxxx-<slug>.md`, numbered in order of creation, never
renumbered once any code or shipped slice references them. One exception on record: on
2026-09-19, before any code existed, the technology baseline was moved to ADR-0001 and the
ten proposed ADRs shifted by one, so the first record a reader opens is the one every other
decision builds on. Status flow: `proposed` → `accepted` | `rejected` → `superseded by ADR-yyyy`.

Template: [[ADR-0000-template]].

| Id | Title | Status | Slice |
|---|---|---|---|
| [[ADR-0002-storage-postgres-and-data-access]] | Storage engine and data access library: PostgreSQL, Prisma, Prisma Studio in compose | accepted | S-01 |
| [[ADR-0003-kafka-client-and-topic-layout]] | Kafka client library and topic layout: kafkajs behind a port, one topic keyed by programId | accepted | S-01, S-02 |
| [[ADR-0004-test-infrastructure-testcontainers]] | Test infrastructure: Testcontainers for integration and e2e, compose for cold start, Jest | accepted | S-01 |
| [[ADR-0005-authentication-bearer-jwt]] | Authentication with bearer JWT | accepted | S-02 |
| [[ADR-0006-money-and-rate-representation]] | Money and rate representation across API, domain and storage | accepted | S-02, S-04 |
| [[ADR-0007-program-currency-change-from-treasury]] | A treasury message with a different currency than the program | accepted | S-02, S-06 |
| [[ADR-0008-concurrency-control-per-program]] | Concurrency control for reservations on one program | accepted | S-03 |
| [[ADR-0009-release-conversion-exact-closing-and-release-id-scope]] | Release conversion, exact closing and the scope of releaseId | proposed | S-05 |
| [[ADR-0010-reconciliation-created-at-versus-as-of]] | Deciding whether a local reservation is older than a snapshot | proposed | S-06 |
| [[ADR-0011-reconciliation-created-reservations]] | Reservations created by reconciliation | proposed | S-06 |
| [[ADR-0001-technology-baseline]] | Technology baseline: Node 24 LTS, NestJS 12, TypeScript 6 strict, npm | accepted | S-01 |
