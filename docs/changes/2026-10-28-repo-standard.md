# The Solving Y? repo standard: change records, simple scope, no Claude or Lovable branding

- **Date:** 2026-10-28
- **Author:** Claude Code
- **Request:** "I want you to apply this to all my repos. Also, don't let Lovable say that it's a Lovable built app or anything like that either... apply both the instructions plus the simplicity first, as well as the other functions that we've added to the Solving Y repo."
- **Branch / PR:** `claude/repo-standard` / see the PR linked from this branch
- **Status:** Built, not merged.
- **Decision notes:** None. This follows the same standard as the HumanAi repo (`SolvingY/solving-y`).

## Why

Adam wants every repo to work the same way as HumanAi:
- Every change leaves the same written record.
- Changes stay minimal.
- Commits and PRs don't carry Claude's name or session links.
- Nothing users see says the app was built with Lovable.

## What changed

- **Rules:**
  - `AGENTS.md`: opens with "Every change leaves a record", and adds a rule against Lovable branding anywhere users or clients see it. Lovable reads this file on every request.
  - `CLAUDE.md`: the same standard for Claude, plus the simple-scope and no-branding notes.
- **Standard and templates:**
  - `docs/operations/change-records.md`: how every change is written down (plan, code comments, change record, decision note, commit, PR, CI check).
  - `docs/changes/_TEMPLATE.md`, `docs/decisions/_TEMPLATE.md` and `docs/operations/_TEMPLATE.md`.
  - `docs/decisions/README.md` and `docs/README.md`, the indexes.
- **Skills:**
  - `.agents/skills/change-records/SKILL.md` and `.agents/skills/simplicity-first/SKILL.md`.
  - `.claude/skills`, a link to `../.agents/skills`, so Claude Code loads both skills.
- **Claude Code settings:** `.claude/settings.json` sets `attribution` so commits and PRs carry no co-author line, no "Generated with Claude Code" and no session link.
- **PR template:** `.github/pull_request_template.md`, with the change record's headings.
- **Test:** `src/test/docsFormat.test.ts` (new) checks that new records, decision notes and runbooks have every required heading, that each record is listed in `docs/README.md`, and that `AGENTS.md`, `CLAUDE.md`, the skill and the PR template still point at the standard.
- **Lovable branding removed:**
  - `README.md` was the original Lovable build prompt ("Create a new app called Dyad..."). This repo is public, so that was its front page. The prompt moved unchanged to `docs/build-brief.md`, and the README now says what Dyad is and how to work on it.
- **Docs:** `docs/build-brief.md` is the old README, moved with `git mv` and otherwise unchanged.

## How it works

1. Lovable reads `AGENTS.md` and Claude reads `CLAUDE.md` and the two skills before every change.
2. Each change ends with a record in `docs/changes/`, listed in `docs/README.md`.
3. The docs test fails when a record is missing a heading, or when the rule files stop pointing at the standard.
4. Claude Code sessions on this repo read `.claude/settings.json` and leave attribution off commits and PRs.

## How to check it

1. Open `AGENTS.md`. It starts with "Every change leaves a record", and the no-branding rule is in its rules list.
2. After merging, the next Claude Code commit on this repo has no `Co-Authored-By` line and no session link.
3. After the next Lovable change, a new file appears in `docs/changes/`.

**Checks run:**
- No app code changed: this is rules, docs, skills, settings and the README.
- `npx vitest run src/test/docsFormat.test.ts` with a minimal config: all passed. The project installs with bun, which isn't set up in this workspace, so the full suite was not run.
- `python3 -m json.tool .claude/settings.json`: valid.

## Deploy steps

1. Merge. Nothing to publish: these are rules and docs, read by Lovable and Claude.
2. If this project is published from Lovable, turn on "Hide 'Lovable' badge" in the Lovable project settings. The badge is a Lovable setting, not code.

## Rollback

Revert the merge commit. Nothing else depends on these files.

## Open items

- `AGENTS.md` keeps Lovable's own managed block at the top (between `LOVABLE:BEGIN` and `LOVABLE:END`). It is a note to coding agents, never shown to users, and Lovable rewrites it, so the standard starts right after it. The existing "Dyad architecture rules" follow unchanged.

