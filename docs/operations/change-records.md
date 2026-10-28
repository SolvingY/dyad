# Change records: how every change is written down

- **Use this when:** you change anything in this repo: code, a migration, an edge function, config, a rule file or a doc. This applies to Claude, Lovable, ChatGPT and people alike.
- **Before you start:** read the templates in `docs/changes/_TEMPLATE.md`, `docs/decisions/_TEMPLATE.md` and `docs/operations/_TEMPLATE.md`.
- **Owner:** Adam Coury. Change this standard only through a change record of its own.

Every change leaves the same five things behind, in the same format. The goal: someone
reading the repo later, human or AI, can tell what was done, why, how to check it and
how to undo it, without asking.

## Steps

### 1. Plan (before building anything bigger than a small fix)

- Lovable writes its plan in `.lovable/plan/`. Claude writes the spec in `specs/`, or in the chat for a small change.
- Use the change-record headings for the plan: **Why**, **What changed** (written as "what will change"), **How to check it**.

### 2. Comments in the code (while building)

- **Every new file** starts with a header comment saying:
  - what it is for;
  - who calls it, such as a page, a cron or another function;
  - the rules it enforces, and why.
- **Every exported function, component and hook** gets a one-line doc comment saying what it does or returns.
- **Every non-obvious line** gets a comment that explains why, not what. That covers a guard, a magic number, an ordering or a workaround. Example: `// Claimed with a status guard so a double tap cannot run the action twice.`
- **Every migration** starts with a header block:
  - what it changes;
  - why;
  - whether it is safe to re-run;
  - how to roll it back.
- **Every new or replaced SQL function** gets a comment above it saying who may call it and what it refuses.
- **No bare TODOs.** Any TODO names the change record that tracks it.
- Don't narrate the obvious (`// set the state`). Comments explain intent and rules.

### 3. The change record (after building, every time)

- One file per request in `docs/changes/`, named `YYYY-MM-DD-short-name.md`. Copy `docs/changes/_TEMPLATE.md`.
- If the same request continues in a later session, update its record instead of starting a new one. Add a dated line under **Open items** or **Status**.
- Every heading in the template stays. Write "None." when a section does not apply.
- Add one line for it under **Change records** in `docs/README.md`, newest first.
- Lovable writes a change record too. Its commit messages are automatic ("Changes"), so the record is the only description of what it did.

### 4. A decision note (when a choice would surprise someone later)

- That means a rule, a trade-off, or something left out on purpose.
- One file in `docs/decisions/`, copied from `docs/decisions/_TEMPLATE.md`. Use the four fields **Decision**, **Why**, **Not doing** and **Where**.
- Link it from the change record. Add it to `docs/decisions/README.md` and `docs/README.md`.
- Never rewrite an old decision. Add a new note that says which one it replaces.

### 5. A rule in `AGENTS.md` (when every future change must follow it)

- One bullet: `<the rule>, because <the reason>.`
- Put it in the nearest `AGENTS.md`: root for app-wide rules, `supabase/functions/AGENTS.md` for edge functions.

### Commit messages (Claude and people)

GitHub renders a commit body as Markdown, and pastes it into a new pull request's
description. So keep a blank line between the parts, or the lines run together.

```
<Area>: <what changed, plain words, 72 characters or fewer>

Why: <one line: the request or the problem>

What changed:
- <one bullet per area>

Checked: <what was run, and the result>

Record: docs/changes/<file>.md
```

### Pull requests

- Use the headings of `.github/pull_request_template.md`: **Why**, **What changed**, **How to check it**, **Deploy steps**, **Rollback**, **Open items**. They match the change record.
- Link the record at the top. Don't paste the whole record.
- GitHub fills a new pull request's form from the template on `main`. Until a template change is merged, write the headings by hand.
- A pull request opened through the API or `gh` gets no template at all, so the body must be written with these headings.
- After every push, look at the CI result for the commit:
  ```
  gh api repos/SolvingY/dyad/commits/<sha>/check-runs
  ```
  Report a red check before asking anyone to merge. If a job "was not started", that is GitHub billing, not the code. Say so, and run the same steps locally: `npx tsc --noEmit`, `bun run test`, `bun run build`.

### The reply at the end of the work

Finish with three lines:

1. What changed.
2. How to check it.
3. The path of the change record.

## Writing style

- Plain, short sentences. Write for Adam reading on his phone, not for a compiler.
- Say what a person sees first, then the file or function: "The settings page shows a Reminders switch (`SettingsPage.tsx`)."
- Name real paths, functions, tables and commands. Don't write "the helper" or "the new code".
- Give real numbers from real runs: "1,951 tests passed", not "tests pass".
- Say plainly what was not checked, and why.

## Check

- `npx vitest run src/test/docsFormat.test.ts` passes. It fails when a change record, decision note or runbook added from 2026-10-28 on is missing a required heading or field. It also fails when `AGENTS.md`, `CLAUDE.md` or the pull request template stops pointing here.
- The new record is listed in `docs/README.md`.

## If it goes wrong

- **A record is missing after the work is done:** write it from the commits and the chat, and mark **Status** "Written after the fact".
- **The format check fails on an older note:** older notes are not checked. Fix the date in the file name, not the note.
- **Lovable rewrites `AGENTS.md` and drops the "Every change leaves a record" section:** restore it from git. The format check catches it, because it also fails when `AGENTS.md` stops pointing here.
