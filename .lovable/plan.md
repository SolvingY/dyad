# Fix: "You" card shows "No Oura data today" despite today's row

## Diagnosis (confirmed)

The database has a row for today: `oura_daily` day `2026-10-03`, readiness 74, sleep 79, HRV 30, resting HR 65, steps 2201.

The exact query the card runs today, in `useDyadData().loadOura` (src/routes/app.tsx:48-57):

```ts
supabase
  .from("oura_daily")
  .select("*")
  .order("updated_at", { ascending: false })
  .limit(14);
// then: rows.find((r) => r.day === localDate())
```

It returns rows, but the card then keeps only the row whose `day` equals the browser's local date. Two failure modes:

1. **Wrong ordering:** rows are ordered by `updated_at`, not `day`. If more than 14 rows share a recent `updated_at` (e.g. a backfill re-touched many rows at once — exactly what the data shows: all recent rows have the same `updated_at` of 2026-10-03 20:49:14), today's row can fall outside the 14-row window and the find returns nothing.
2. **Timezone mismatch:** `day` is stored as a calendar date; comparing it to the browser's local date breaks around midnight and for users behind UTC.

Either way the result is `oura = null`, so the card renders "No Oura data today".

## Fix (src/routes/app.tsx only)

1. **Change the query** to read the most recent row by day, no date filter:
   ```ts
   supabase
     .from("oura_daily")
     .select("day, readiness_score, sleep_score, average_hrv, resting_heart_rate, steps, updated_at")
     .order("day", { ascending: false })
     .limit(1)
     .maybeSingle();
   ```
   Column names match the table exactly: `day`, `readiness_score`, `sleep_score`, `average_hrv`, `resting_heart_rate`, `steps`.

2. **Show the row's date** next to the readiness ring: caption becomes `Readiness · <day>` formatted in the user's locale (e.g. "Readiness · Oct 3"), replacing "Readiness · today".

3. **Error / empty states on the card instead of dashes:**
   - Query error → caption shows the error message.
   - Zero rows → "No Oura data yet".
   - The small stats under the ring keep showing "—" only when the row exists but a field is null.

4. **Local timezone for any remaining date comparison:** the only other date comparison is the agent side (`agent_daily` filtered by `new Date().toISOString().slice(0, 10)` — UTC). Switch it to the existing `localDate()` helper so both sides use the user's local day. The `localDate()` helper itself already uses local time; keep it.

5. **MiniRing strip (phone)** uses the same `oura` value, so it picks up the fix automatically.

## Out of scope

- No database, RLS, or edge-function changes — the row is readable; this is purely a client query fix.
- No layout, copy, or styling changes beyond the caption text.

## Verification

- Confirm build OK via /tmp/observability/build-errors.log.
- Signed-in end-to-end check is not possible from the sandbox (external Supabase, no session), so verify the query logic against the real data with a read query and note that the user should confirm on their signed-in dashboard.
