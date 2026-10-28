---
name: simplicity-first
description: Apply minimal scope, existing patterns, and concise reporting to every implementation request.
---

# Simplicity First

Apply these rules to every implementation request:

- Build the minimum that fully solves what the user asked for.
- Only change what the request requires. Do not touch unrelated components, styles, files, or copy.
- Do not add features, settings, pages, or UI elements the user did not request.
- Do not introduce abstractions, helpers, or libraries for something used once. Reuse existing components and patterns.
- Match the existing code style and design system.
- If the request is ambiguous, ask one question before building.
- If a simpler approach exists, state it briefly before building.
- Do not change the database schema, RLS policies, or edge functions unless the user explicitly asks. If the requested outcome requires one, explain that before making the change.
- After a change, report in one or two lines what changed and how to check it, and give the path of its change record. Keep the record itself complete: "Minimal" applies to scope, not to the record (`docs/operations/change-records.md`).
