# Public pages meet WCAG 2.1 AA: landmarks, headings, labels, announced errors, pause control

- **Date:** 2026-11-02
- **Author:** Claude Code
- **Request:** "Every public page in his web repos to meet ADA website accessibility expectations", to WCAG 2.1 Level AA, delivered as one pull request.
- **Branch / PR:** `a11y/wcag-21-aa` / see the PR opened from this branch
- **Status:** Built, not merged.
- **Decision notes:** None.

## Why

Public pages have to meet WCAG 2.1 AA, the level the DOJ adopted under ADA Title II, which also covers Section 508. Axe found no automatic failures. A code review still found gaps that axe does not test: no skip link, pages with no `<main>` or no `<h1>`, sign-in fields with no label, errors that screen readers never hear, weak focus on inputs, and looping motion on the landing page with no way to pause it.

## What changed

- **App, shared layout:** `src/routes/__root.tsx`:
  - A "Skip to main content" link appears on the first Tab press. It focuses `#main-content`, or the page's first `<main>` on signed-in pages.
  - The 404 and error screens use `<main>`.
  - The 404 sets its title to "Page not found — Dyad". Before, it was just "Dyad".
- **Landing `/`:** `src/routes/index.tsx`:
  - The page content is now inside `<main>`. Most of the file's diff is only the extra two-space indent from that wrapper.
  - The header nav has a "Pause motion" / "Play motion" button. When paused, the page stops its looping CSS animations, the particles, the scan overlay and the brain's rotation and firing (WCAG 2.2.2).
  - The walkthrough link says "(opens in a new tab)" to screen readers.
- **Brain:** `src/components/dyad/dyad-brain.tsx`: a new optional `paused` prop holds the brain still, the same way reduced motion already does. The dashboard does not pass it, so the dashboard is unchanged.
- **Styles:** `src/styles.css`: the `.motion-paused` rule that the pause button uses.
- **Sign in `/auth`:** `src/routes/auth.index.tsx`:
  - The page is a `<main>` with a screen-reader `<h1>` that follows the mode: "Sign in", "Create account", "Magic link" or "Reset your password".
  - Email and password have `<label>`s. The password field has a "6 characters" hint.
  - The mode buttons are a labelled group with `aria-pressed`.
  - Errors are in a `role="alert"` region and are linked to the fields with `aria-invalid` and `aria-describedby`. "Check your email" notices are in a `role="status"` region.
  - Inputs show a teal focus ring.
- **Reset password `/reset-password`:** `src/routes/reset-password.tsx`: a `<main>`, a label, an announced error linked to the field, and the focus ring.
- **Auth callback `/auth/callback`:** `src/routes/auth.callback.tsx`: a `<main>`, a screen-reader `<h1>`, the error as `role="alert"` and "Signing you in…" as `role="status"`.
- **OAuth consent `/oauth/consent`:** `src/routes/oauth/consent.tsx`: a `<main>`, "Connect an app" is now the `<h1>`, and errors are `role="alert"`.
- **Oura callback `/oura/callback`:** `src/routes/oura/callback.tsx`: a `<main>`, and "Connecting your Oura ring…" is the `<h1>`.
- **Privacy and Terms:** `src/routes/privacy.tsx` and `src/routes/terms.tsx`: the page name ("Privacy Policy", "Terms of Service") is now the `<h1>`. Before, these pages had no `<h1>`. The `<main>` gets `id="main-content"`.
- **For agents `/agents`:** `src/routes/agents.tsx`: the sections are inside `<main>`. Again, most of the diff is the indent.
- **Docs and rules:** this record, and its line in `docs/README.md`.

## How it works

1. A keyboard user presses Tab on any page and sees "Skip to main content" at the top left. Enter moves focus past the header.
2. On the landing page, "Pause motion" in the header adds `motion-paused` to the page. That stops every CSS animation inside it, removes the particle canvas and scan overlay, and tells `DyadBrain` to stop rotating. Pressing it again ("Play motion") restores everything.
3. On `/auth`, a failed sign-in puts the message in the alert region, so a screen reader reads it out at once, and marks the fields invalid.

## How to check it

1. Open `/` and press Tab once. "Skip to main content" appears. Press Enter, then Tab: focus lands on "Sign up" in the hero, past the header links.
2. On `/`, press "Pause motion". The brain stops turning and the title stops glitching. Press "Play motion" and they start again.
3. On `/auth`, turn on VoiceOver or NVDA. The fields are read as "Email" and "Password", and the mode buttons as toggle buttons. Sign in with a wrong password: the error is read out.
4. Tab through `/auth` and `/reset-password`. Every input shows a teal ring.

**Checks run:**
- Axe (`@axe-core/playwright`, tags wcag2a, wcag2aa, wcag21a and wcag21aa):
  - Before: 13 public routes and states at 1280px and 375px. 0 violations.
  - After: the same 13, plus "motion paused" and "skip link focused" on `/`. 0 violations at 1280px and 375px.
  - 320px pass after the change: 0 violations, and no page scrolls sideways. The two extra `/` states timed out at 320px because the shared test machine was overloaded.
  - The per-route table is in the PR.
- Playwright behaviour checks:
  - The first Tab on `/` focuses "Skip to main content". Enter moves focus to `#main-content`, and the next Tab reaches "Sign up".
  - "Pause motion" leaves 0 infinite animations running and removes the particle canvas.
  - On `/auth`, a wrong-password sign-in (Supabase response mocked) puts "Invalid login credentials" in the alert region and sets `aria-invalid="true"` and `aria-describedby="auth-error"` on the fields.
  - The focused input shows a 2px `oklch(0.784 0.137 187.6)` ring.
  - Every checked page has one `<h1>` and a `main#main-content`. The 404 title is "Page not found — Dyad".
- `npx tsc --noEmit`: the same 2 errors as on `main`, both in `src/test/docsFormat.test.ts`. No new errors.
- `npx eslint` on every changed file: the same error count per file as on `main`. All of those are existing `prettier/prettier` errors.
- `npx vitest run`: 14 passed in 2 files. On `main` it was 13; the new test is the docs check for this record.
- `npx vite build`: succeeded.
- Installed with `npm install`, because `bun install` could not download packages through this workspace's proxy. The `package-lock.json` it made is not committed.

## Deploy steps

1. Merge.
2. Publish from Lovable.

## Rollback

Revert the merge commit. Nothing else depends on these changes.

## Open items

- **Captions:** `/dyad-explainer.mp4` on the landing page has no captions (WCAG 1.2.2) and no transcript. Someone has to write a WebVTT file. After that, add `<track kind="captions" src="/dyad-explainer.vtt" srclang="en" label="English" default>` to the `<video>` in `src/routes/index.tsx`.
- **Legal pages:** `/privacy` and `/terms` still show `[DATE]`, `[COMPANY NAME]` and `[CONTACT EMAIL]` placeholders. This is not an accessibility failure, but visitors can see it.
- **Signed-in follow-ups (not changed here):**
  - The message box in `src/components/dyad/dyad-thread.tsx` uses `outline-none` and shows no focus indicator of its own (WCAG 2.4.7).
  - The reminder switches in `src/routes/reminders.tsx` are named only "On" or "Off", not after the reminder they control (WCAG 2.4.6 and 4.1.2).
- **Manual testing:** axe catches roughly a third of issues. A keyboard-only pass and a screen-reader pass (VoiceOver or NVDA) on these pages are still recommended.
- **Accessibility statement:** whether to publish one is the owner's decision. This change does not add one.
