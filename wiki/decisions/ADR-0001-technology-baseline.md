# ADR-0001: Technology baseline

- Status: accepted
- Date: 2026-09-19, amended 2026-09-19 (framework major: NestJS 12, see the Framework section)
- Slice: S-01
- Related: AC-00, AC-35, AC-38, A-16, A-17

## Context

The brief as transcribed names no runtime, framework or language. Marcin fixed the baseline
before the process started: it appears as a fact in the `CLAUDE.md` header ("in NestJS") and in
AC-00 (Node 24 LTS, the gate scripts, ESLint and Prettier, Swagger UI and Redoc). Nowhere was
it recorded as a decision with the alternatives that were not taken. A reviewer opening this
folder should find that record here, once, instead of inferring it from configuration files.

This ADR records the choices that were made. It does not repeat what other pages already
own: lint and format settings are the code standard in `CLAUDE.md §3`, the two documentation
views over one OpenAPI document are A-16 and AC-35, the storage engine, Kafka client and test
infrastructure are ADR-0002 to ADR-0004.

## Options

### Runtime: Node 24 LTS
Chosen. Current LTS at the start of the project, the same major used in CI (`actions/setup-node`
with `node-version: 24`). Alternatives: Node 22 LTS (older, no reason to start a new service on
it), Bun or Deno (faster start, but weaker compatibility with the NestJS and Kafka ecosystem and
an unusual choice for a reviewer to run locally).

### Framework: NestJS 12
Chosen. Modules, dependency injection and decorators give the three-layer structure of
`CLAUDE.md §2` a natural home; `class-validator` DTOs double as the OpenAPI schema; the
ecosystem covers health checks, Swagger and testing utilities. Alternatives: plain Fastify or
Express (less structure, everything hand-rolled), Hono (small and fast, no DI or module system,
thin OpenAPI story), AdonisJS (full-stack shape that fits a web app more than a service).

Amended on 2026-09-19, while S-01 scaffolded the project: the major is 12, not 11 as first
written. Two facts decided it. NestJS 12.0.3 is the `latest` tag; the 11 line ended at 11.2.5
and npm now tags it `legacy`, so a service starting today would start one major behind. And
NestJS 11 carries an open high severity advisory through `multer` in `@nestjs/platform-express`
(a denial of service via crafted multipart field names) that is fixed only in 12. The advisory
is not reachable for us, since no route in the brief accepts a file, but a red `npm audit` on
day one is noise every later slice would inherit. Marcin decided the bump when it surfaced.

The version matrix that follows from 12 and is pinned in `api/package.json`: TypeScript 6
(`@nestjs/schematics` 12 requires `>=6`, and `typescript-eslint` 8 supports `<6.1`, which rules
out the newer TypeScript 7), ESLint 10 with `typescript-eslint` 8, Jest 30 with `ts-jest` 29,
Prisma 7 for both the client and the CLI. Prisma 8 was rejected for now: its `latest` tag is a
release candidate, and a baseline does not start on a prerelease.

### Language: TypeScript with `strict: true`
Chosen. NestJS is written for it and the money rules (INV-08, `bigint` in the domain) lean on
the type system. Alternative: JavaScript with JSDoc, which loses the compile-time guarantees
`/review` checks for.

### Package manager: npm
Chosen. Lockfile understood by `actions/setup-node` cache, no extra install step for a reviewer.
Alternatives: pnpm (faster installs, needs corepack or a global install), yarn (no advantage
here).

### Deployment shape: everything in Docker, three services of ours plus the Kafka broker we consume from
Chosen. Every process runs in a container, locally through one `docker compose up`. The
compose file defines three services that are ours, one piece of infrastructure that is not
ours but must exist for our consumer to have something to read, and one dev tool:

| Service | Container | Role |
|---|---|---|
| `api` | NestJS on Node 24 | the API and nothing else: HTTP endpoints, Kafka consumer, domain, ledger |
| `web` | React (Vite, TypeScript) built to static files, served by nginx | a simple UI, a few tables, that shows what the system does: the demo from A-17, calling `api` over HTTP with a dev token |
| `db` | Postgres | the database, its own container, its own volume |
| `kafka` | single broker, KRaft | not our service. Locally it stands in for the treasury's broker; in production we connect to theirs. We only consume from it (A-03, A-04) |
| `studio` | pgweb, port 5555 | dev profile only: browse and edit rows by hand (ADR-0002, which records why it is pgweb and not Prisma Studio). Not deployed in production |

`web` never contains business logic and never talks to `db` or `kafka` directly; everything
it shows comes from `api`. `api` serves no HTML. In production the `web` container is simply
not deployed; `api` keeps its dev-only endpoints out of the production profile.

**Why a Kafka container when we only consume.** The brief says capacity data flows in
from the treasury over Kafka, so `api` has a consumer. A consumer needs a broker to connect
to. In production that broker belongs to the treasury or a shared platform and we only hold
its address. On a laptop nobody provides it, so compose starts one, exactly as it starts
Postgres although we do not build databases. Without it `api` cannot boot its consumer and
AC-20 to AC-31 cannot be shown or tested.

**Who publishes on the local broker.** There is no treasury locally, so we impersonate it,
and only in the dev profile. The path is:

```
web  --HTTP-->  api: POST /dev/treasury  -->  kafka topic  -->  api: consumer  -->  ledger
                (dev profile only, plays the treasury)          (the real production code)
```

`web` never talks to Kafka; a browser has no Kafka client and should not know the broker.
It calls a dev-only `api` endpoint that carries a small producer. The same `api` then reads
the message through its real consumer and processes it as if the treasury had sent it:
dedup by `messageId`, `asOf` check, adjustments in the ledger. Only the sender is faked;
the whole production path is exercised. The same producer feeds the integration and e2e
tests of the consumer. In production the dev module is not registered, `/dev/*` answers
`404`, no producer starts, and Kafka is consumed only, as the brief says.

Repository layout follows the containers: `api/` and `web/` are separate folders with their
own `package.json`, `Dockerfile`, lint and test setup, isolated from each other; the root
`package.json` declares them as npm workspaces so `npm ci` and `npm run gate` at the root
cover both. Nothing is imported across the two folders; the only contract between them is
the OpenAPI document `api` publishes.

`web` stack: React with Vite and TypeScript `strict`, no state library, no UI kit beyond
plain CSS; components are a handful of tables and forms. Its gate is lint, typecheck, build
and a render test per screen. Alternatives: vanilla HTML and JavaScript without a build
(smaller, but four live-updating panels get unreadable fast without components), Next.js or
Remix (server rendering the demo does not need), Vue or Svelte (fine, React is simply the
one Marcin wants to show).
Alternatives: one container serving both the API and the page (fewer moving parts, but
mixes a static page into the service and blurs "api has to be api"); no containers for the
app, only for Postgres and Kafka (faster local iteration, but "runnable locally" would then
depend on the reviewer's Node setup and the production image would never be exercised).

### Not decided here
Data access library (ADR-0002), Kafka client (ADR-0003), test runner and containers (ADR-0004),
lint and format rules (`CLAUDE.md §3`), API documentation views (A-16).

## Decision

Node 24 LTS, NestJS 12, TypeScript 6 `strict`, npm. Everything containerised, local run through
`docker compose up` with three services of ours (`api`, `web`, `db`) plus the Kafka broker.
`api` is only an API; `web` is a small React UI that only shows. Folders `api/` and `web/`
are isolated, joined by npm workspaces at the root. Decided by Marcin at project setup and recorded here
on 2026-09-19 so the alternatives are visible. The framework major was moved from 11 to 12 on
the same day, during S-01, for the reasons in the Framework section.

## Consequences

Every dependency in S-01 is chosen inside this baseline. S-01 creates all four compose
services with `web` as a placeholder page; S-07 fills `web` with the demo. `api` needs CORS
for the `web` origin in the dev profile. Cold start (AC-00, AC-36) checks `web` as well as
`api`. Upgrading the Node major or the NestJS
major is a setup PR with a work-log line, not a new ADR, unless the alternatives above become
relevant again.
