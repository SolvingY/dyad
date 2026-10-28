# Dyad: agent rules

See also AGENTS.md.

- The agent runs on the Claude API (Anthropic), not Gemini.
- The API key is the Supabase edge function secret `ANTHROPIC_API_KEY`. Never log it or return it to a client.
- Default model: `claude-haiku-4-5-20251001`.
- Logging: every Claude call must be logged to `agent_events` through the `agent-call` edge function (`supabase/functions/agent-call`). Don't call the Claude API from anywhere else.
- `agent_events` is model-agnostic; don't change the database schema for a model or provider switch.

---

## Every Change Leaves a Record

Follow `docs/operations/change-records.md` on every change. It applies to every change, however small, and is the same standard Lovable follows through `AGENTS.md`. In short:

1. **Plan** anything bigger than a small fix with the headings Why, What will change, How to check it (`specs/` or the chat).
2. **Comment the code:**
   - Every new file gets a header comment: what it is for, who calls it, and the rules it enforces and why.
   - Every exported function, component and hook gets a one-line doc comment.
   - Every non-obvious guard, number or ordering gets a "why" comment.
   - Every migration gets a header block: what, why, safe to re-run, how to roll back.
3. **Write one change record per request** in `docs/changes/YYYY-MM-DD-short-name.md` from `docs/changes/_TEMPLATE.md`:
   - Keep every heading. Write "None." where one does not apply.
   - List the record in `docs/README.md`.
4. **Add a decision note** from `docs/decisions/_TEMPLATE.md` (Decision, Why, Not doing, Where) when a choice would surprise a later reader. A runbook follows `docs/operations/_TEMPLATE.md`.
5. **Write commits and PRs in the standard's format.** The PR template's headings match the change record.
6. **End the reply** with what changed, how to check it, and the record's path.

`npx vitest run src/test/docsFormat.test.ts` fails when a new record, decision note or runbook is missing a required heading.

Other notes:
- Keep scope minimal (`.agents/skills/simplicity-first/SKILL.md`): build only what was asked, reuse existing patterns, don't touch unrelated files.
- Do not add Lovable branding anywhere users or clients can see it (badges, "Built with Lovable", Lovable links, logos, meta tags, handles); see the rule in `AGENTS.md`.
- New docs go in `docs/` by kind (see `docs/README.md`), and each gets a line in that index. Don't add notes at the repo root.
- `.lovable/plan/` (if present) is written by Lovable. Read it, but leave it as Lovable writes it.
