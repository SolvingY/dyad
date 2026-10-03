# Liquid Glass + fluid motion across Dyad

Strong Liquid Glass surfaces and squishy, fluid motion on every page: landing, dashboard, conversation, sign-in, reset password, agent page, For agents, Terms, Privacy. Colours, layout, wording, the brain and all features stay as they are.

## What you'll see

**Liquid Glass surfaces**
- Every card, panel, the message input bar, the Human/Dyad/Agent tabs and header links become thick, see-through glass. The background (navy glow, brain, specks) shows through blurred and slightly bent at the edges.
- A bright highlight runs along the top edge of each panel, with a soft inner shine. The highlight shifts a little as the pointer moves over it.
- Gold panels (You) get a warm tint and teal panels (Agent) a cool one. Dyad panels blend from gold to teal.
- Message bubbles become small glass blobs: gold for yours, teal for the agent's.

**Fluid motion**
- Buttons squish down when pressed and spring back, with a ripple of light from the tap point.
- The selected Human/Dyad/Agent tab sits in a glass bubble that slides over to the new tab.
- New messages stretch in with a soft wobble. The 1–5 energy buttons and the mic button wobble when tapped. While dictating, the mic pulses like liquid.
- Cards rise and swell a little on hover. Pages and sign-in tabs fade in with a soft morph.

**Comfort and readability**
- All text stays full brightness; the glass gets darker behind text wherever it's needed to keep it readable.
- People who ask their device for less motion get the glass without the squish, wobble or ripples.
- On phones, the bending effect is lighter so scrolling stays smooth.

## Technical details

- `src/styles.css`: upgrade the `glass-card` utility in place (heavier `backdrop-filter: blur() saturate()`, layered specular top edge via `::before`, inner shine and tinted edges via the `--glass-*` tokens, plus a pointer-tracked `--mx/--my` highlight). Add new utilities: `liquid-press` (spring scale on `:active`), `liquid-ripple`, `liquid-pill` (sliding tab indicator), `liquid-in` (wobble-in keyframes), `liquid-pulse` (mic). Write only the standard `backdrop-filter` property, no `-webkit-` copy.
- Bending at the edges: one shared inline SVG `feTurbulence` + `feDisplacementMap` filter mounted once in `__root.tsx`, used through `backdrop-filter: url(#liquid)` where the browser supports it. Other browsers get the blur-only glass.
- `GlassCard` gets a small pointer handler that sets `--mx/--my`; no change to its props.
- Apply `liquid-press` and `liquid-ripple` to the shared buttons (shadcn `button` variants, thread send/mic/energy/Listen, landing Sign up, auth tabs and submit). Animate the dashboard tab indicator with a CSS transform driven by the selected index.
- `@media (prefers-reduced-motion)` turns off every liquid animation. On narrow screens the displacement filter is turned off.
- Brain canvas, layout, copy and data flow stay untouched. No new libraries.
- Check every page with Playwright on desktop and phone: text stays readable, nothing jumps, no console errors.
