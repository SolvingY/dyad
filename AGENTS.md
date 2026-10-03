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

## Dyad architecture rules
- Dashboard data flows Supabase rows → `src/lib/dyad/vitals.ts` adapter (raw display vitals + separate normalized 0–1 visual state) → `DyadBrain`; the renderer never queries Supabase. Why: keeps raw values intact and the brain a pure view.
- Posture comparison constants live only in `src/lib/dyad/posture-config.ts`; `getDyadOperatingPosture` stays a pure function. Why: no existing readiness bands, so one tunable home.
- Agent readiness is computed only by `refresh_agent_daily` in SQL; the client may explain the limiting factor using mirrored weights but never recomputes readiness. Why: single source of truth.
- The brain GLB is served as a Lovable asset with a local Draco decoder in `public/draco/`; data changes only materials/uniforms, never geometry. Why: no runtime third-party CDN, no anatomy deformation.
- "/" is the public landing page (signed-in visitors redirect to "/app"); the dashboard lives at "/app" and redirects signed-out visitors to "/auth". Why: marketing page and app stay separate.
- Reuse `BrandLogo` for visible brand headers; keep the brain app icon for favicon/install surfaces and the branded banner for social previews. Why: one source keeps Dyad identity consistent without substituting the wide logo where a square icon is required.
