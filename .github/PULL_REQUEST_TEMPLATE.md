## Outcome

One sentence: what can a client of the service do after this PR that it could not before.
For non-slice PRs (setup, docs): what changes for the people working in the repo.

## Slice

`S-xx`, or `none` for setup and documentation PRs.

## Closed

- AC: `AC-xx`, `AC-yy`
- INV: `INV-xx`
- ADRs accepted: `ADR-xxxx`
- Assumptions touched: `A-xx`

## How it was tested

- `npm run gate` result
- `/verify S-xx` result and date
- `/review S-xx` result and date
- Anything checked by hand (cold start, demo page)

## Known limitations and follow-ups

What is deliberately not in this PR and where it is tracked.

## Checklist

- [ ] Branch follows `slice/S-xx-<slug>` (or `setup/…`, `docs/…` for non-slice work)
- [ ] Commits are Conventional Commits with the slice id as scope
- [ ] Wiki updated: work-log, changelog, traceability, ADR statuses
- [ ] README still runs the service from a clean checkout
- [ ] No em dashes or en dashes anywhere in the diff
