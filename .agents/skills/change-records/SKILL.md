---
name: change-records
description: Use on every change to this repo (code, migration, edge function, config, rules, docs) to leave the required plan, code comments, change record, decision note and commit/PR text in the repo's one standard format.
---

# Change records

Every change in this repo leaves the same record, whoever makes it. The full standard is
`docs/operations/change-records.md`. Read it before your first change in a session.

## Before building

- For anything bigger than a small fix, write the plan with the headings **Why**, **What will change** and **How to check it**. Put it in `specs/`, or in `.lovable/plan/` for Lovable.

## While building

- **New file:** a header comment saying what it is for, who calls it, and the rules it enforces and why.
- **Exported function, component or hook:** a one-line doc comment.
- **Non-obvious guard, number or ordering:** a comment saying why, not what.
- **Migration:** a header block saying what it changes, why, whether it is safe to re-run, and how to roll it back.
- **New SQL function:** a comment saying who may call it and what it refuses.
- **TODO:** only with the change record that tracks it.

## After building (every time)

1. Copy `docs/changes/_TEMPLATE.md` to `docs/changes/YYYY-MM-DD-short-name.md`, or update the record for the same request if one exists.
   - Fill every heading: Why, What changed, How it works, How to check it, Deploy steps, Rollback, Open items.
   - Write "None." where a heading does not apply.
   - Use real paths and real results.
2. If a choice would surprise a later reader, add a decision note from `docs/decisions/_TEMPLATE.md` (Decision, Why, Not doing, Where) and link it from the record.
3. If every future change must follow a new rule, add one bullet to the nearest `AGENTS.md`: "<rule>, because <reason>."
4. List the record (and any decision note) in `docs/README.md`, plus the decision in `docs/decisions/README.md`.
5. Commit with the standard's format. Keep the blank lines: GitHub renders the body as Markdown.
   ```
   <Area>: <what changed>

   Why: <one line>

   What changed:
   - <one bullet per area>

   Checked: <what was run, result>

   Record: docs/changes/<file>.md
   ```
6. Write the PR body with the template's headings: Why, What changed, How to check it, Deploy steps, Rollback, Open items. Link the record at the top. A PR made through the API gets no template, so write the headings yourself.
7. After pushing, check CI for the commit (`gh api repos/SolvingY/dyad/commits/<sha>/check-runs`). Report any red check before asking for a merge. "Not started" means GitHub billing; run `npx tsc --noEmit`, `bun run test`, `bun run build` locally, and say so.
8. Run `npx vitest run src/test/docsFormat.test.ts` and make sure it passes.
9. End the reply with three lines: what changed, how to check it, and the record's path.
