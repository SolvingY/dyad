<!--
Same headings as the change record (docs/changes/_TEMPLATE.md). Link the record; don't
paste it. Standard: docs/operations/change-records.md.
-->

**Change record:** docs/changes/YYYY-MM-DD-short-name.md

## Why

<!-- The problem, or the request in the requester's words. -->

## What changed

<!-- Bullets by area (Database, Edge functions, App, Docs and rules), each naming the file. -->

## How to check it

<!-- Steps in the app, then the checks you actually ran and their results. Delete what does not apply. -->

- [ ] Local checks pass (typecheck, test, build)
- [ ] New or changed behaviour is covered by a test
- [ ] `npx vitest run src/test/docsFormat.test.ts` passes (change record, decision notes, runbooks)
- [ ] Database changes are in a new migration file under `supabase/migrations/` with a header block, and that migration has been applied
- [ ] Edge function changes are committed here, not only deployed

## Deploy steps

<!-- In order: migration, merge, Lovable publish, secrets, cron. "None." if nothing. -->

## Rollback

<!-- How to undo it. -->

## Open items

<!-- What is left. "None." if nothing. -->
