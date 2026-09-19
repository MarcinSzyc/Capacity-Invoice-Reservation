# Architecture decision records

One decision per file: `ADR-xxxx-<slug>.md`, numbered in order of creation, never
renumbered. Status flow: `proposed` → `accepted` | `rejected` → `superseded by ADR-yyyy`.

Template: [[ADR-0000-template]].

| Id | Title | Status | Slice |
|---|---|---|---|
| [[ADR-0001-storage-postgres-and-data-access]] | Storage engine and data access library | proposed | S-01 |
| [[ADR-0002-kafka-client-and-topic-layout]] | Kafka client library and topic layout | proposed | S-01, S-02 |
| [[ADR-0003-test-infrastructure-testcontainers]] | Test infrastructure for integration and e2e tests | proposed | S-01 |
| [[ADR-0004-authentication-bearer-jwt]] | Authentication with bearer JWT | proposed | S-02 |
| [[ADR-0005-money-and-rate-representation]] | Money and rate representation across API, domain and storage | proposed | S-02, S-04 |
| [[ADR-0006-program-currency-change-from-treasury]] | A treasury message with a different currency than the program | proposed | S-02, S-06 |
| [[ADR-0007-concurrency-control-per-program]] | Concurrency control for reservations on one program | proposed | S-03 |
| [[ADR-0008-release-conversion-exact-closing-and-release-id-scope]] | Release conversion, exact closing and the scope of releaseId | proposed | S-05 |
| [[ADR-0009-reconciliation-created-at-versus-as-of]] | Deciding whether a local reservation is older than a snapshot | proposed | S-06 |
| [[ADR-0010-reconciliation-created-reservations]] | Reservations created by reconciliation | proposed | S-06 |
| [[ADR-0011-technology-baseline]] | Technology baseline: Node 24 LTS, NestJS 11, TypeScript strict, npm | accepted | S-01 |
