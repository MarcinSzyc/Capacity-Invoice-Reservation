# Changelog

What landed, per slice. Written by `/ship`.

| Date | Slice | Outcome for a client of the service | AC / INV closed | ADRs accepted | Known limitations |
|---|---|---|---|---|---|
| 2026-09-19 | [[../slices/S-01-walking-skeleton\|S-01]] | Start the whole system with one command and see it answer: `GET /health`, `GET /health/ready` reporting the database and broker separately, and the API contract as Swagger UI and Redoc over one OpenAPI document, all without a token. Nothing business facing yet: no programs, reservations or authentication. | AC-00, AC-41 | ADR-0001 (amended: NestJS 12), ADR-0002 (amended: pgweb as the inspection tool), ADR-0003, ADR-0004 | No authentication, so every route is open until S-02. No tables: the Prisma schema has a datasource and no models. The `web` page is a placeholder that links to the api; the demo arrives in S-07. Readiness reports a dependency as down after a two second probe bound, so a very slow but healthy dependency reads as down. The `CLAUDE.md §2` and `§4` amendments made during this slice await Marcin's acceptance in the pull request. |
