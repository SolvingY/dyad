<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Every change leaves a record (read this first)

These rules apply to Lovable, Claude and anyone else who changes this repo. The full
standard, with examples, is `docs/operations/change-records.md`. Keep this section at
the top of this file when you add rules below it.

- Before building anything bigger than a small fix, write the plan (Lovable: `.lovable/plan/`; Claude: `specs/` or the chat) with the headings **Why**, **What will change** and **How to check it**.
- Every new file starts with a header comment: what it is for, who calls it, and the rules it enforces and why. Every exported function, component and hook gets a one-line doc comment. Every non-obvious guard, number or ordering gets a comment saying why. Don't comment the obvious.
- Every migration starts with a header block: what it changes, why, whether it is safe to re-run, and how to roll it back. Every new SQL function gets a comment saying who may call it and what it refuses.
- After every change request, write one change record in `docs/changes/YYYY-MM-DD-short-name.md` from `docs/changes/_TEMPLATE.md`. Keep every heading (Why, What changed, How it works, How to check it, Deploy steps, Rollback, Open items) and write "None." where one does not apply. List the record in `docs/README.md`. Continuing the same request later updates its record.
- When a choice would surprise a later reader, add a decision note from `docs/decisions/_TEMPLATE.md` (Decision, Why, Not doing, Where). A runbook (SOP) follows `docs/operations/_TEMPLATE.md`.
- Keep scope minimal: build only what was asked, reuse existing patterns, and don't touch unrelated files (`.agents/skills/simplicity-first/SKILL.md`).
- A new rule in this file is one bullet: "<the rule>, because <the reason>."
- End every reply about a change with: what changed, how to check it, and the path of the change record.

# Rules

## Dyad architecture rules
- Dashboard data flows Supabase rows → `src/lib/dyad/vitals.ts` adapter (raw display vitals + separate normalized 0–1 visual state) → `DyadBrain`; the renderer never queries Supabase. Why: keeps raw values intact and the brain a pure view.
- Posture comparison constants live only in `src/lib/dyad/posture-config.ts`; `getDyadOperatingPosture` stays a pure function. Why: no existing readiness bands, so one tunable home.
- Agent readiness is computed only by `refresh_agent_daily` in SQL; the client may explain the limiting factor using mirrored weights but never recomputes readiness. Why: single source of truth.
- Edge Function executions use the shared `_shared/edge-health.ts` recorder and feed daily Agent readiness without storing request or response content. Why: function reliability belongs in Agent health while secrets and user content must stay out of telemetry.
- The brain GLB is served as a Lovable asset with a local Draco decoder in `public/draco/`; data changes only materials/uniforms, never geometry. Why: no runtime third-party CDN, no anatomy deformation.
- "/" is the public landing page (signed-in visitors redirect to "/app"); the dashboard lives at "/app" and redirects signed-out visitors to "/auth". Why: marketing page and app stay separate.
- Reuse `BrandLogo` for visible brand headers; keep the brain app icon for favicon/install surfaces and the branded banner for social previews. Why: one source keeps Dyad identity consistent without substituting the wide logo where a square icon is required.
- All new accounts start pending; authorization is enforced by account approval and administrators manage access from `/admin`. Why: sign-in proves identity, while explicit approval controls product access.
- Never add Lovable branding anywhere users or clients can see it: no "Edit with Lovable" or "Built with Lovable" badges, no Lovable name, logo, links or `@lovable_dev` handles in pages, page titles, meta and social tags, favicons, emails, PDFs or README intros, because every app here is built and delivered by Solving Y? and must present as its own product. Hosting and API plumbing (the `lovable.app` domain, `LOVABLE_API_KEY`, the AI and connector gateways, `lovable-uploads` paths, `lovable-tagger`) is not branding and stays.
