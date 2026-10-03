# Brain: remove the black box, add firing neural connections

## 1. Remove the black box behind the brain

The brain's canvas is opaque black because the bloom effect chain (EffectComposer + UnrealBloomPass) discards transparency — the page background can't show through, so a black rectangle sits behind the brain. The current `mix-blend-mode: screen` workaround doesn't fully hide it.

Fix in `src/components/dyad/dyad-brain.tsx`:

- Drop the EffectComposer/RenderPass/UnrealBloomPass chain and render directly with the transparent WebGL renderer (`alpha: true`, clear alpha 0) that already exists. Black-box gone by construction — no blend-mode workaround needed.
- Compensate for the lost bloom (it ran at low strength, 0.22–0.42): slightly raise the emissive intensity of the hemisphere materials and the activity-point brightness so the brain keeps its glow. No geometry changes.
- Remove the now-unneeded `mix-blend-mode: screen` on the canvas and the `mix-blend-screen` wrapper in `src/routes/index.tsx`.

## 2. Animated neural connections

Add a "synapse" layer inside the brain in `dyad-brain.tsx`:

- Reuse the cortical surface points already sampled for the activity field. Connect nearby random pairs (same hemisphere, plus a few crossing the midline) — about 120 connections, within the performance budget.
- Each connection is a line rendered with a small shader: a bright pulse travels from one end to the other, fades, and re-fires at a random interval — like a signal going off. Color follows the side: gold on the human half, teal on the agent half, gold→teal blend for midline crossings.
- Firing rate scales gently with each side's existing activity level (more activity → more frequent pulses); when a side is selected/hovered, its connections brighten slightly, matching the existing selection behavior.
- Additive blending, thin lines, low base alpha so it reads as sparks inside the brain, not a wireframe.
- Reduced-motion visitors: connections render as faint static lines, no traveling pulses.

## Verification

- Build check via /tmp/observability/build-errors.log.
- Playwright screenshot of the landing hero: brain visible with no black rectangle behind it (page background shows through), connections visible as small firing lights. Two screenshots a moment apart to confirm the pulses move.
