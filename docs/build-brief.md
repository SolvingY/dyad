# Dyad Dashboard

Create a new app called Dyad: shared vitals for a human and

their AI agent.

Design: futuristic and calm, like a premium health wearable.

- Near-black background with a subtle deep-navy tint

- Glass-style cards: translucent, thin luminous borders,

  soft glow on hover

- Human color: gold #F5C518. Agent color: teal #00D4C8.

- Center column blends gold into teal as a gradient

- Supporting accents: orange #E07830, violet #B78BFF,

  sky #7EC8FF, green #5FBF77; red #E05252 for warnings only

- Neutral text and lines: white at 40–60% opacity

- Large, thin numerals for scores; ring gauges for readiness

- Slow, subtle motion: a gentle pulse on each readiness ring

Build only the shell for now:

- One dashboard page with three columns: "Human" on the left,

  "Agent" on the right, "Cross-analysis" in the center

- Placeholder cards in each column

- Supabase will be the backend; I'll connect it next

Do not invent data models or sample metrics. The schema will

come from the repo.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://dyad-human-agent-sync.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a382e96a-3ba6-4b7d-9d70-70d8862ed1ec).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
