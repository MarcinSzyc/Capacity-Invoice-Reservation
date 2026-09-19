# ADR-0011: Technology baseline

- Status: accepted
- Date: 2026-09-19
- Slice: S-01
- Related: AC-00, AC-35, A-16

## Context

The brief as transcribed names no runtime, framework or language. Marcin fixed the baseline
before the process started: it appears as a fact in the `CLAUDE.md` header ("in NestJS") and in
AC-00 (Node 24 LTS, the gate scripts, ESLint and Prettier, Swagger UI and Redoc). Nowhere was
it recorded as a decision with the alternatives that were not taken. A reviewer opening this
folder should find that record here, once, instead of inferring it from configuration files.

This ADR records the choices that were made. It does not repeat what other pages already
own: lint and format settings are the code standard in `CLAUDE.md §3`, the two documentation
views over one OpenAPI document are A-16 and AC-35, the storage engine, Kafka client and test
infrastructure are ADR-0001 to ADR-0003.

## Options

### Runtime: Node 24 LTS
Chosen. Current LTS at the start of the project, the same major used in CI (`actions/setup-node`
with `node-version: 24`). Alternatives: Node 22 LTS (older, no reason to start a new service on
it), Bun or Deno (faster start, but weaker compatibility with the NestJS and Kafka ecosystem and
an unusual choice for a reviewer to run locally).

### Framework: NestJS 11
Chosen. Modules, dependency injection and decorators give the three-layer structure of
`CLAUDE.md §2` a natural home; `class-validator` DTOs double as the OpenAPI schema; the
ecosystem covers health checks, Swagger and testing utilities. Alternatives: plain Fastify or
Express (less structure, everything hand-rolled), Hono (small and fast, no DI or module system,
thin OpenAPI story), AdonisJS (full-stack shape that fits a web app more than a service).

### Language: TypeScript with `strict: true`
Chosen. NestJS is written for it and the money rules (INV-08, `bigint` in the domain) lean on
the type system. Alternative: JavaScript with JSDoc, which loses the compile-time guarantees
`/review` checks for.

### Package manager: npm
Chosen. Lockfile understood by `actions/setup-node` cache, no extra install step for a reviewer.
Alternatives: pnpm (faster installs, needs corepack or a global install), yarn (no advantage
here).

### Not decided here
Data access library (ADR-0001), Kafka client (ADR-0002), test runner and containers (ADR-0003),
lint and format rules (`CLAUDE.md §3`), API documentation views (A-16).

## Decision

Node 24 LTS, NestJS 11, TypeScript `strict`, npm. Decided by Marcin at project setup and
recorded here on 2026-09-19 so the alternatives are visible.

## Consequences

Every dependency in S-01 is chosen inside this baseline. Upgrading the Node major or the NestJS
major is a setup PR with a work-log line, not a new ADR, unless the alternatives above become
relevant again.
