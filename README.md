# Capacity-Invoice-Reservation

Program Capacity & Invoice Reservation service in NestJS: a capacity ledger for invoice
financing programs. Reservations draw from a program credit limit, releases return capacity,
the treasury reconciles over Kafka.

## Run it locally

You need Docker and nothing else. From a clean checkout:

```bash
docker compose up --wait
```

That builds and starts five containers defined in [docker-compose.yml](docker-compose.yml):

| Service | URL | What it is |
|---|---|---|
| `api` | http://localhost:3000 | the NestJS service: HTTP endpoints, the treasury Kafka consumer, the ledger |
| `web` | http://localhost:8080 | a small React page that only shows what `api` returns (the demo lands in S-07) |
| `db` | localhost:5432 | PostgreSQL, its own volume |
| `kafka` | localhost:9092 | a single broker in KRaft mode, standing in for the treasury's broker |
| `studio` | http://localhost:5555 | pgweb, to browse and edit rows by hand (dev profile only, ADR-0002) |

To start again from nothing: `docker compose down -v && docker compose up --wait`.

If one of those ports is already taken on your machine, move it without editing any file:
`API_PORT=3010 WEB_PORT=8081 docker compose up --wait`, and the same variables work for
`npm run smoke`. The names are `API_PORT`, `WEB_PORT`, `DB_PORT`, `KAFKA_PORT` and
`STUDIO_PORT`.

### Where to look first

| What | Where |
|---|---|
| Liveness | http://localhost:3000/health |
| Readiness (database and broker) | http://localhost:3000/health/ready |
| API documentation, try requests | http://localhost:3000/docs (Swagger UI) |
| API documentation, read the contract | http://localhost:3000/redoc (Redoc) |
| The OpenAPI document both views render | http://localhost:3000/openapi.json |

Health and the documentation need no token (A-16). The documentation views are not served in
the production profile.

## Working on it

Node 24 LTS and npm, two workspaces: `api/` (NestJS) and `web/` (React with Vite).

```bash
npm ci
npm run gate:quick    # lint, format, typecheck, prose check, build, unit and integration tests
npm run gate          # gate:quick plus e2e tests and the cold start smoke
```

`gate:quick` needs Docker: integration and e2e tests start PostgreSQL and Kafka through
Testcontainers (ADR-0004). It also runs on every commit through the pre-commit hook.

## Where the thinking is written down

| What | Where |
|---|---|
| The brief this was built from | [wiki/spec/brief.md](wiki/spec/brief.md) |
| Assumptions register, every assumption with rationale and consequence | [wiki/spec/assumptions.md](wiki/spec/assumptions.md) |
| Architecture decision records | [wiki/decisions/README.md](wiki/decisions/README.md) |
| Acceptance criteria and invariants | [wiki/spec/acceptance-criteria.md](wiki/spec/acceptance-criteria.md), [wiki/spec/invariants.md](wiki/spec/invariants.md) |
| Domain glossary, the words used in code and API | [wiki/spec/glossary.md](wiki/spec/glossary.md) |
| Plan, slices and requirement checklist | [wiki/plan/plan.md](wiki/plan/plan.md), [wiki/slices/README.md](wiki/slices/README.md) |
| Map and current status | [wiki/Home.md](wiki/Home.md) |
| How we work, gates and standards | [CONTRIBUTING.md](CONTRIBUTING.md), [CLAUDE.md](CLAUDE.md) |
