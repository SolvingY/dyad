# Heart rate, workouts, past conversations, and reminders

Four additions. Three of them need new database tables or columns, so the plan lists those changes up front.

## 1. Heart rate through the day, plus workouts (Oura)

- Each Oura sync also pulls your **heart rate readings for today** (about every 5 minutes while you wear the ring) and your **workouts** for the last few days.
- The "You" card shows a small **Heart rate today** line: your latest reading, your daytime average, and a "Running high" flag when your recent daytime heart rate is well above your resting rate (simple rule: last hour's average more than 15 bpm above resting HR, with no workout logged in that hour).
- A **Workouts** list on the Trends page shows the activity, its length, calories, and how hard it was.
- The agent can read the same heart-rate summary and workouts, so it can see if you're stressed mid-day.
- Sync runs when you open the dashboard and when you tap retry. It also runs during the existing hourly check-in, so readings stay current without you opening the app.
- **You'll need to reconnect Oura once.** Today Dyad only has permission to read daily summaries, and Oura asks you to approve heart rate and workout access separately.

## 2. Past conversations

- New **Conversations** item in the menu that slides out from the right, linking to a page that lists your past chats with your agent, **grouped by day** (newest first), with the first line of each day as a preview.
- Open a day to read it in full, laid out like the current chat.
- **Delete** a day's conversation, with a confirm step. Deleting is permanent.

## 3. Reminders (in-app only)

- New **Reminders** item in the menu, linking to a page where you turn rules on or off and set how often each can notify you:
  - **Working too hard**: heart rate running high mid-day
  - **Low sleep / low readiness**: your readiness below a number you choose
  - **Agent slowing down**: agent latency above a number you choose
  - **Agent errors**: agent error rate above a percent you choose
- **How often**: at most once per hour, every 3 hours, or once a day, plus quiet hours (start and end time).
- When a rule triggers, a notification appears behind a **bell with a count** in the dashboard header. Open it to see the list and mark notifications read. Nothing is sent outside the app.
- Rules are checked during the existing hourly check-in, so no new timer is added. A notification can arrive up to an hour after the condition starts.

## Technical details

Database changes (migrations, own-only access, approved users only):
- `oura_heartrate` (user_id, ts, bpm, source), unique (user_id, ts); deletes rows older than 14 days during sync.
- `oura_workouts` (user_id, oura_id unique, day, activity, start/end, calories, intensity, raw).
- `reminders` (user_id, kind, enabled, threshold, frequency_minutes, quiet_start, quiet_end, last_fired_at); users can read and write their own rows.
- `notifications` (user_id, reminder_kind, title, body, read_at, created_at); users can read, mark read, and delete their own rows.
- `thread_messages`: add a DELETE policy so users can delete their own messages (needed to delete conversations).

Code:
- `_shared/oura.ts`: add `heartrate` and `workout` to the requested permissions.
- `oura-sync`: fetch `/heartrate` (today, local time zone) and `/workout` (last 7 days), then upsert.
- `agent-checkin` (existing hourly job): call oura-sync for each connected user, evaluate each user's enabled reminders against the latest `oura_heartrate`, `oura_daily`, and `agent_daily` data, apply frequency and quiet hours, and insert `notifications`.
- `dyad-mcp`: add one read-only tool, `get_heart_rate_and_workouts`.
- New routes: `/conversations`, `/reminders`. Add a notification bell to the `/app` header. Add both links to the AccountMenu.
- No change to readiness scoring.
