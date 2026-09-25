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
| `web` | http://localhost:8080 | the demo page: it shows what `api` returns and computes nothing |
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

### See it working

Open http://localhost:8080 once the stack is up. The page runs against the real `api` and the
real treasury topic, on program `PRG-1` unless you type another id:

| Panel | What it does |
|---|---|
| Request generator | Start, Stop, One request: random reservations of up to 100 000 minor units, and releases of them in full or in part |
| Request log | the last 50 calls the page made, with method, path, status and the error `code` |
| Live ledger | availability and the latest 100 movements, polled every second, amounts in minor units |
| Treasury panel | Limit change, Snapshot (reservations as `INV-A:70000000,INV-B:0`), Duplicate (the last message again), Stale (an update from 2000) |

The page gets its token from `GET /dev/token` and reaches the ledger and the treasury through
`GET /dev/programs/:programId/movements` and `POST /dev/treasury`. Those dev endpoints need no
token and exist only outside the production profile; with `NODE_ENV=production` they answer
`404` because they are not registered. Stop and start the stack and every number reads the same.

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

Reserve capacity for an invoice. The amount is in minor units of the invoice currency:

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

### Release it

A repayment gives capacity back. The amount is in invoice currency and `releaseId` is the
client's identifier of that repayment, so sending it twice is the same repayment twice:

```bash
curl -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"releaseId":"R-1","amount":100000000}' \
  http://localhost:3000/programs/PRG-1/reservations/INV-B/releases
```

`200` with the reservation: 1 000 000.00 EUR of the invoice released, so `held` falls from
3 025 000.00 to 1 925 000.00 USD and availability grows by the difference. Leave `amount` out to
release everything the invoice has left, which closes the reservation:

```bash
curl -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"releaseId":"R-2"}' \
  http://localhost:3000/programs/PRG-1/reservations/INV-B/releases
```

`held` is derived from what the invoice has left rather than decremented per release, so
instalments that do not divide evenly by the rate still close at exactly zero (ADR-0009). Add
`"reason":"cancelled"` if the invoice was not paid after all; it is recorded and changes no rule.
Sending `R-1` again answers `409 RELEASE_ALREADY_PROCESSED` with what that release did, so a
retry is never a second repayment.

Read a reservation with the movements that explain it:

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/programs/PRG-1/reservations/INV-B
```

Refusals carry a stable `code` in the body:

| Status | `code` | When |
|---|---|---|
| `400` | `VALIDATION_FAILED` | a field is missing or malformed, or `rate` does not fit the two currencies; `details` names it |
| `404` | `PROGRAM_NOT_FOUND` | the treasury never announced the program |
| `404` | `RESERVATION_NOT_FOUND` | the program holds no reservation for that invoice |
| `409` | `RESERVATION_ALREADY_EXISTS` | the invoice already has a reservation; the original is in the body |
| `409` | `RESERVATION_ALREADY_RELEASED` | the whole invoice has already been released |
| `409` | `RELEASE_ALREADY_PROCESSED` | that `releaseId` was applied before; `appliedAt` and `heldAfter` say what it did |
| `422` | `CAPACITY_EXCEEDED` | the amount is more than `available`, which the body carries |
| `422` | `RELEASE_EXCEEDS_HELD` | the release is more than the invoice has left; the body carries `held` and `remainingInvoiceAmount` |

Without a token, or with an expired or wrongly signed one, every business route answers `401`.
The token command signs with `JWT_SECRET`, or with the development secret compose starts the
api with when the variable is not set; that value is refused in the production profile.

### Reconcile it

Now and then the treasury sends a snapshot: the program's whole state as of one moment, its
limit, currency and every reservation it considers active with what each holds. Play the
treasury again and tell the service that `INV-A` holds 1 000 000.00 USD rather than 1 200 000.00,
and that there is an `INV-X` it never heard of:

```bash
npm run dev:treasury -- snapshot --program PRG-1 --currency USD --limit 1000000000 \
  --reservations INV-A:100000000,INV-X:5000000
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/programs/PRG-1/reservations/INV-X
```

`INV-A` now holds 100 000 000 with an `adjustment` movement of -20 000 000, and `INV-X` exists
with `source` `reconciliation`, `held` 5 000 000 and one `adjustment` carrying the snapshot's
`messageId`. Availability reports the snapshot's moment as `asOf`. The message on the
`treasury.capacity` topic, keyed by `programId`, amounts in minor units of the program currency:

```json
{"messageId":"m-81","type":"reconciliation_snapshot","programId":"PRG-1","currency":"USD",
 "creditLimit":1000000000,"asOf":"2026-09-21T18:00:00Z",
 "activeReservations":[{"invoiceId":"INV-A","heldAmount":100000000},{"invoiceId":"INV-X","heldAmount":5000000}]}
```

The snapshot is compared against its own moment, never applied as a wholesale replace
([A-12](wiki/spec/assumptions.md)):

| The snapshot says | The service does |
|---|---|
| an invoice we do not know | creates it with `source` `reconciliation` |
| nothing about a reservation created before `asOf` | releases it by adjustment and closes it, unless a client reservation was created within 30 s of `asOf` (`RECONCILIATION_KEEP_WINDOW_SECONDS`) |
| nothing, or anything, about a reservation created after `asOf` | leaves it alone, and a client's release after `asOf` stands |
| a different `held` | corrects it by adjustment; a later release keeps the correction |
| an invoice whose reservation is closed | reopens it, unless the client closed it after `asOf` |
| an `asOf` older than the last one applied | records it `stale` and changes nothing |

One snapshot lists at most 10 000 reservations, whose amounts may add up to at most
9 007 199 254 740 991 minor units; a larger one is rejected and dead-lettered. A message that
fails to apply is tried three times, then dead-lettered with its error and consumption moves on;
every failed attempt is a row in `treasury_message_failures`, readable in pgweb
([ADR-0013](wiki/decisions/ADR-0013-treasury-messages-that-always-fail.md)).

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
