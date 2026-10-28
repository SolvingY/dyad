# <What changed, in plain words>

<!--
Copy this file to docs/changes/YYYY-MM-DD-short-name.md. Keep every heading; write
"None." where one does not apply. Standard: docs/operations/change-records.md.
-->

- **Date:** YYYY-MM-DD
- **Author:** Claude Code | Lovable | <person>
- **Request:** <what was asked, in the requester's own words>
- **Branch / PR:** <branch> / <PR link, or "None">
- **Status:** Planned | Built, not deployed | Deployed | Published
- **Decision notes:** <links to docs/decisions/..., or "None">

## Why

<One to three sentences: the problem, or the request and what it is for.>

## What changed

<Bullets grouped by area. Each bullet names the file and says what it does now.>

- **Database:** `supabase/migrations/<file>.sql`: ...
- **Edge functions:** `supabase/functions/<name>/index.ts`: ...
- **App:** `src/...`: ...
- **Docs and rules:** ...

## How it works

<The path from what the user does to what they see, in a few steps. "None." for a small fix.>

## How to check it

<Numbered steps someone can follow in the app, then the automated checks that were run
and their real results. Say plainly what was not checked and why.>

1. ...

**Checks run:** <command: result>

## Deploy steps

<What has to happen, in order: migration, merge, Lovable publish, secrets, cron. "None." if nothing.>

## Rollback

<How to undo it: the revert, the down-migration SQL, the setting to switch off.>

## Open items

<What is left, known limits, follow-ups. "None." if nothing.>
