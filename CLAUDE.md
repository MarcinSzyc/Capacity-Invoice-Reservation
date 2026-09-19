# CLAUDE.md: how we work in this repo

Project: **Program Capacity & Invoice Reservation** in NestJS, a capacity ledger for
invoice financing programs. The brief is `wiki/spec/brief.md`. The wiki (`wiki/`) is part of
the deliverable, not a side note: the brief explicitly asks for assumptions and
trade-offs to be documented.

Everything in this repo (code, commits, wiki, skills) is written in English.

## 1. The flow and its gates

Work moves through six skills. Each is a gate. No gate is skipped, none is
self-approved.

```
brief → /spec → /plan → [ /implement → /verify → /review → /ship ] per slice → PR
```

| Skill | Produces | May not leave until |
|---|---|---|
| `/spec` | AC, invariants, assumptions, glossary | every open question is answered by the user or recorded as an assumption |
| `/plan` | risk-ordered slices, each with named tests and ADR candidates | every AC maps to at least one test name and vice versa |
| `/implement` | code + tests for one slice, work-log entry | red → green → refactor done, `npm run gate:quick` green |
| `/verify` | gate report, AC↔test coverage check, cold-start check | `npm run gate` green and every AC in the slice has a passing test |
| `/review` | findings against standards and against spec | runs in a fresh context; reports, never fixes |
| `/ship` | changelog, requirement checklist, slice status, README, ADR finalisation, PR | wiki reflects reality |

Rules that hold across gates:

- Ambiguity is never resolved silently. Ask Marcin. If he cannot be asked, record
  the assumption in `wiki/spec/assumptions.md` with rationale and consequence.
- Any decision with real alternatives gets an ADR in `wiki/decisions/`. Draft it the
  moment the decision appears, finalise it in `/ship`.
- `/implement` touches the wiki only via `wiki/log/work-log.md`.
- Findings from `/review` go back to `/implement`, then `/verify` and `/review` run again.

## 2. Architecture standards

Domain-oriented NestJS, one module per business area, three layers inside each module:

```
src/modules/<area>/
  domain/          pure TypeScript. No @nestjs/* imports, no decorators, no I/O.
  application/     use cases. @Injectable services that orchestrate domain + ports.
  infrastructure/  controllers, DTOs, repositories, Kafka consumers, mappers.
  <area>.module.ts
src/common/        truly generic cross-cutting code only (filters, guards, logger).
src/config/        typed configuration.
test/              e2e tests (*.e2e-test.ts) and test infrastructure.
```

- **Domain is framework-free.** Entities, value objects, domain services and domain
  errors are plain classes. Dependencies enter through interfaces (ports) defined in
  `domain/` and implemented in `infrastructure/`. Lint enforces the import boundary.
- **Controllers are thin.** Route, validate via DTO, call a use case, map the result.
  No business logic, no repository access.
- **DTOs use `class-validator` + `class-transformer`** through a global `ValidationPipe`
  (`whitelist`, `forbidNonWhitelisted`, `transform`). DTOs double as the Swagger schema.
- **One global exception filter.** Domain errors are mapped to HTTP status in one place.
  5xx never leaks internals. No per-controller try/catch shaping.
- **Repositories hide persistence.** Nothing outside `infrastructure/` sees the ORM.
- **Money is never a float.** Amounts are integer minor units plus an ISO 4217 currency
  code, inside a `Money` value object. Storage type and FX handling are ADRs.
- **Kafka consumers are idempotent** and treat every message as untrusted input:
  validate, then hand a typed command to a use case. Details live in ADRs.
- **Names come from the glossary.** `wiki/spec/glossary.md` is the ubiquitous language.
  Classes, fields, API properties, message fields and test names use its words exactly
  (`held`, `reservedAmount`, `releaseId`, `adjustment`). A new domain word in code
  without a glossary entry is a review finding; the entry must explain the word to a
  newcomer, with a number example where it helps.
- **Every business error has a stable code.** HTTP status plus a constant machine-readable
  code in the body (`CAPACITY_EXCEEDED`, `RESERVATION_ALREADY_EXISTS`). Duplicates of an
  identifier are 409 with the original outcome in the body, never a silent success.

## 3. Code style

- TypeScript `strict: true`. No `any`; use `unknown` and narrow. Cast as
  `as unknown as Target` only when unavoidable, never `as any`.
- kebab-case files and folders, PascalCase classes, camelCase everything else.
- `const` over `let`. Arrow functions. Early returns over nested `if`.
- **No nested ternaries.** One `? :` per expression; anything more becomes an `if` or a
  lookup map.
- **`if` nests at most one level.** An `if` inside an `if` is the limit. Deeper than that,
  extract a function or return early. ESLint `max-depth: 2`.
- **A one-line `if` has no braces.** `if (isRepaid) return false;` Braces only when the
  body spans more than one line. ESLint `curly: multi-line`.
- Explicit return types on exported functions and public methods.
- Comments only for a non-obvious *why*. Never comments that describe *what*.
- No dead code, no compat shims, no error handling for impossible cases.
- Prettier: `singleQuote`, `trailingComma: all`, `bracketSpacing: false`.
- ESLint: `typescript-eslint` recommended-type-checked, `no-floating-promises` is an
  **error** (async Kafka handlers make this a real bug class), `no-nested-ternary`,
  `max-depth: 2`, `curly: multi-line`, `--max-warnings 0`.

## 4. Testing

Strategy in detail: `wiki/testing/strategy.md`. The rules that matter every day:

- **Unit** (`*.test.ts`, next to the file): domain layer, instantiated with `new`,
  in-memory fakes for ports. No `Test.createTestingModule`, no mocks of our own code.
- **Integration** (`*.integration-test.ts`): one module with real infrastructure
  (database, Kafka) via Testcontainers. Repositories and consumers live here.
- **E2E** (`test/**/*.e2e-test.ts`): full Nest app over HTTP with supertest,
  authenticated, one test per acceptance criterion.
- **Invariant tests**: rules that must hold under concurrency (e.g. capacity is never
  over-reserved) get dedicated tests with parallel requests. Tagged `[INV-xx]`.
- **Contract tests for Kafka**: message schema, idempotency, out-of-order and
  duplicate delivery.
- Naming: `describe('<Class|UseCase>')`, `it('[AC-03] should reject a reservation that
  exceeds available capacity')`. Every e2e/invariant test carries its AC or INV id.
- Fixture values in UPPERCASE constants. Tests read top-down, no shared mutable state.
- Coverage is not a metric. Traceability is: `wiki/plan/plan.md` maps each AC and INV to
  a test, a test file and a commit, with its status.

## 5. The gate

One definition of green, used by the hook, `/verify` and CI:

```
npm run gate:quick   lint + typecheck + prose check + unit + integration   (pre-commit hook)
npm run gate         gate:quick + e2e + cold start smoke                   (/verify, CI)
```

Prose check: fails if any Markdown file under the repo, or a commit message, contains an
em dash or en dash (see §7).

Cold start smoke: `docker compose up` from a clean checkout, wait for health, hit an
authenticated endpoint. "Runnable locally" is an acceptance criterion.

## 6. Git and branching

- `main` is always green and is never pushed to directly. Exception: wiki and document
  changes before slice S-01 exists.
- One branch per slice: `slice/S-03-release-capacity`. Non-slice work uses `setup/<slug>`
  or `docs/<slug>` and the same PR flow. Inside a branch, small commits from the TDD loop. Conventional Commits with the slice id as scope:
  `feat(S-03): release capacity on repayment`. Body lists AC, INV and ADR ids touched.
- Rebase the slice branch on `main` before merging. Merge with `--no-ff` so the merge
  commit marks the slice boundary and the inner commits keep the red-green-refactor
  history. No squash. Never force-push `main`.
- Once a branch has a PR, its history is frozen: review fixes are new commits, never
  `--amend` or `--force-push`, so the reviewer sees exactly what changed since the last
  look. Rebasing on `main` is the only allowed rewrite, and only right before merging.
- `/ship` opens the pull request using `.github/PULL_REQUEST_TEMPLATE.md` (outcome,
  AC/INV closed, ADRs accepted, how it was tested, known limitations) and tags the merge
  commit `S-03`.
- Commit only when `gate:quick` is green. Never `--no-verify`.
- Review flow: the agent opens the PR and stops. Marcin reviews on GitHub and gives the
  go-ahead as a PR comment (GitHub disables Approve for the PR author, and PRs are opened
  under his account). Only then the agent merges (`--no-ff`, merge commit, tag). The
  agent never merges on its own and never pushes to `main`.

## 7. Wiki rules

```
wiki/Home.md                    map + current status
wiki/spec/                      brief, acceptance-criteria, invariants,
                                assumptions, glossary, open-questions
wiki/plan/plan.md               every AC and INV: slice, status, test, test file, commit
wiki/slices/README.md           slice index: order, risk, dependencies, status
wiki/slices/S-xx-*.md           one file per slice: AC/INV, tests by name, ADRs, log
wiki/decisions/ADR-xxxx-*.md    one decision per file, template in decisions/
wiki/log/work-log.md            append-only, one entry per working session
wiki/log/changelog.md           what landed, per slice
wiki/testing/strategy.md        test pyramid and rules
```

- Obsidian-style `[[wikilinks]]` between pages. Files are plain Markdown; the vault
  root is `wiki/`.
- **No em dashes or en dashes anywhere**: wiki, CLAUDE.md, skills, README, code comments,
  commit messages. Use a comma, a colon, a period or parentheses. Enforced by the prose
  check in the gate.
- Work-log entries are never edited after the fact. Correct with a new entry.
- Assumptions are numbered `A-xx`, acceptance criteria `AC-xx`, invariants `INV-xx`,
  slices `S-xx`, decisions `ADR-xxxx`. Ids are stable once assigned.
- `README.md` at repo root is the reviewer's entry point: how to run, where the
  assumptions and ADRs are. `/ship` keeps it current.

## 8. Models

| Skill | Model | Why |
|---|---|---|
| spec, plan | Fable | few tokens, irreversible decisions |
| implement | Opus by default, **Fable for slices marked `risk: high`** in the plan (concurrency, reconciliation, money). Switch with `/model` before starting the slice. |
| verify, ship | Sonnet | mechanical work |
| review | Fable in a fresh context | must not be anchored on the implementation |

## 9. Definition of done for a slice

- Every AC and INV assigned to the slice has a passing, tagged test.
- `npm run gate` is green.
- `/review` returned no open findings.
- Work-log, changelog, the requirement checklist, slice status and any ADRs are updated.
- README still tells the truth about how to run the service.
