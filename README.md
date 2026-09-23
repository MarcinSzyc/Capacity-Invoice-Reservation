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
`API_PORT=3010 WEB_PORT=8081 docker compose up --wait`. The names are `API_PORT`, `WEB_PORT`,
`DB_PORT`, `KAFKA_PORT` and `STUDIO_PORT`.

`npm run smoke` never touches this stack: it runs its own throwaway one under the compose
project name `capacity-smoke` on its own ports, so running the gate cannot stop your
containers or delete rows you edited in pgweb.

### Where to look first

| What | Where |
|---|---|
| Liveness | http://localhost:3000/health |
| Readiness (database and broker) | http://localhost:3000/health/ready |
| API documentation, try requests | http://localhost:3000/docs (Swagger UI) |
| API documentation, read the contract | http://localhost:3000/redoc (Redoc) |
| The OpenAPI document both views render | http://localhost:3000/openapi.json |

Health and the documentation need no token (A-16). The documentation views are not served in
the production profile. The raw document is also served as YAML at `/openapi.yaml`.

### Call it

Every business route needs a bearer JWT ([ADR-0005](wiki/decisions/ADR-0005-authentication-bearer-jwt.md)).
After `npm ci`, mint one and read the sample program the stack seeds on start:

```bash
TOKEN=$(npm run dev:token -- --sub demo-client --ttl 8h | tail -1)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/programs/PRG-1/availability
```

The answer is the program as the ledger knows it, amounts in integer minor units:

```json
{"programId":"PRG-1","currency":"USD","limit":1000000000,"reserved":0,"available":1000000000,"overcommitted":false,"asOf":null}
```

`PRG-1` exists because the `seed` container publishes one capacity update once `api` is
healthy. To play the treasury yourself, publish another:

```bash
npm run dev:treasury -- capacity-update --program PRG-2 --currency EUR --limit 500000000
```

Reserve capacity for an invoice. The amount is in minor units of the invoice currency, and for
now the invoice must be in the program currency (cross-currency arrives in S-04):

```bash
curl -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"invoiceId":"INV-A","invoiceAmount":120000000,"invoiceCurrency":"USD"}' \
  http://localhost:3000/programs/PRG-1/reservations
```

`201` with the reservation (`reservedAmount`, `held`, `status` `active`), and availability drops
by the same amount. A currency code is uppercased on the way in, so `usd` works too (A-10).

An invoice in another currency needs the rate, as a decimal string of at most eight places. The
service converts once, rounds half up to the program's minor unit and stores the rate, so every
later release converts the same way:

```bash
curl -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"invoiceId":"INV-B","invoiceAmount":275000000,"invoiceCurrency":"EUR","rate":"1.10"}' \
  http://localhost:3000/programs/PRG-1/reservations
```

2 750 000.00 EUR at 1.10 reserves 3 025 000.00 USD. Each currency keeps its own minor unit, so
1 000 JPY (no decimals) at `0.0067` reserves 6.70 USD, not 0.07. The rate reads back canonical,
`"1.1"` for a sent `"1.10"` and `"1"` for a same-currency reservation (A-10). Send no rate
within one currency; send one across two, or the answer is `400` naming `rate`.

Refusals carry a stable `code` in the body:

| Status | `code` | When |
|---|---|---|
| `400` | `VALIDATION_FAILED` | a field is missing or malformed, or `rate` does not fit the two currencies; `details` names it |
| `404` | `PROGRAM_NOT_FOUND` | the treasury never announced the program |
| `409` | `RESERVATION_ALREADY_EXISTS` | the invoice already has a reservation; the original is in the body |
| `422` | `CAPACITY_EXCEEDED` | the amount is more than `available`, which the body carries |

Without a token, or with an expired or wrongly signed one, every business route answers `401`.
The token command signs with `JWT_SECRET`, or with the development secret compose starts the
api with when the variable is not set; that value is refused in the production profile.

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
