# Contributing

How work happens in this repository, whether you are a person or an agent. The rules
themselves live in `CLAUDE.md`; this page explains how to drive them.

## The loop

```
requirement → /spec → /plan → [ /implement S-xx → /verify S-xx → /review S-xx → /ship S-xx ] → next slice
```

Each step is a Claude Code skill under `.claude/skills/`. Each is a gate: it has
preconditions, a defined output and a "must not" list. Skills do not skip each other and
never approve their own work.

| Step | Run it when | Files written |
|---|---|---|
| `/spec` | starting the project, or adding a requirement | `wiki/spec/acceptance-criteria.md`, `wiki/spec/invariants.md`, `wiki/spec/assumptions.md`, `wiki/spec/glossary.md`, `wiki/spec/open-questions.md`; a feature brief under `wiki/spec/features/` when given inline |
| `/plan` | after every `/spec` | `wiki/plan/plan.md` (every AC and INV with slice, status and test name), `wiki/slices/README.md` (slice order), one `wiki/slices/S-xx-<slug>.md` per slice with AC/INV, named tests and ADR candidates, ADR drafts `wiki/decisions/ADR-xxxx-*.md` with status `proposed` |
| `/implement S-xx` | a slice is next and its ADRs are accepted | code under `src/`, tests next to it and under `test/`, an entry in `wiki/log/work-log.md`, status and log line in the slice file |
| `/verify S-xx` | implement reports done, and after every fix | a `VERIFY S-xx: PASS or FAIL` entry in `wiki/log/work-log.md` and a log line in the slice file, nothing else |
| `/review S-xx` | verify passed, and after every fix | a `REVIEW S-xx` entry in `wiki/log/work-log.md` with findings and a log line in the slice file, nothing else |
| `/ship S-xx` | verify PASS and review clean | `wiki/log/changelog.md`, `wiki/plan/plan.md` (test files, commits and status filled), ADR statuses, slice file status `done`, `wiki/slices/README.md`, `wiki/Home.md`, `README.md`, and the pull request |

## First run

1. `/spec` with no arguments. It reads `wiki/spec/brief.md`, writes the glossary and
   open questions, then stops and asks. Answer by question number; "rest per
   recommendation" is a valid answer. It then writes AC, INV and assumptions.
2. `/plan`. It cuts slices and drafts ADRs that must be decided before coding. Decide
   them; the agent will not decide for you.
3. Loop over slices in plan order. Before a slice marked `risk: high`, switch the model
   with `/model fable`.

## Adding a feature later

Nothing new is needed. Write a short brief and run the same loop:

```
/spec wiki/spec/features/2026-10-02-reservation-expiry.md
/plan
/implement S-09 ...
```

Or pass the requirement inline: `/spec reservations should expire after 30 days`. The
skill saves the text under `wiki/spec/features/` first, so the source is on record.
Existing ids never change; superseded items are marked, not rewritten.

## Where things are written down

| Question | Page |
|---|---|
| What did the brief ask? | `wiki/spec/brief.md` |
| What did we decide it means? | `wiki/spec/assumptions.md` |
| What must the service do? | `wiki/spec/acceptance-criteria.md`, `wiki/spec/invariants.md` |
| Why is it built this way? | `wiki/decisions/` |
| Which test proves which requirement, and is it done? | `wiki/plan/plan.md` |
| What are we building next and in what order? | `wiki/slices/README.md` and one file per slice |
| What happened, in order? | `wiki/log/work-log.md` |
| What has shipped? | `wiki/log/changelog.md` |

Open `wiki/` as an Obsidian vault for the linked view; the files are plain Markdown.

## Review flow

1. The agent finishes a gate and opens a pull request from the branch. Then it stops.
2. Marcin reviews on GitHub and leaves a comment on the PR saying it can be merged.
   (GitHub disables Approve for the PR author, and PRs are opened under his account.)
3. The agent merges with a merge commit (`--no-ff`), tags slice merges `S-xx`, pulls
   `main` and continues with the next step.

The agent never merges without that go-ahead and never pushes to `main` directly.
Fixes requested in review land as new commits on the branch, never as an amend or a
force-push, so the reviewer can see what changed since the last look.

## Hand rules

- Green means `npm run gate`. Nothing else counts.
- Branch per slice (`slice/S-xx-<slug>`), PR to `main`, merge `--no-ff`, tag `S-xx`. Commit, push or merge only when asked. Conventional Commits, scope is the slice id.
- Ambiguity goes to Marcin, or into `wiki/spec/assumptions.md`. Never into the code silently.
- No em dashes or en dashes anywhere in prose. The gate checks.
