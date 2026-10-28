# Dyad

Shared vitals for a human and their AI agent. The person's side comes from their Oura
ring; the agent's side comes from its own call telemetry. Both show on one dashboard, and
the agent can read them, check in and message its human through an MCP server
(`supabase/functions/dyad-mcp`). Built by Solving Y?.

## Stack

- TanStack Start, React, TypeScript and Tailwind CSS
- Supabase for the database, sign-in and edge functions (`supabase/`)
- The Claude API for the agent, called only through `supabase/functions/agent-call`
- Vitest for tests

## Working on it

```sh
bun install
bun run dev       # local dev server
bun run test      # tests
bun run build     # production build
```

Before changing anything, read `AGENTS.md` and `CLAUDE.md`. Every change leaves a record
in `docs/changes/`, following `docs/operations/change-records.md`. The original build
brief is `docs/build-brief.md`; the index of all docs is `docs/README.md`.
