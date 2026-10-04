# Fill the Human and Agent detail sections

Right now the detail sections under the dashboard show only 2 cells per side (Sleep score and Avg HRV for you; Calls and Error rate for the agent). Your ring and agent already send much more. This change adds the missing cells, using data that is already saved. Nothing new gets collected, and the database stays as it is.

## Human column (gold): cells added under Readiness
Values come from your latest Oura day, plus today's heart rate and workouts.
- Sleep score (already there)
- Avg HRV (already there)
- Resting heart rate
- Heart rate now: your latest reading, plus your average while awake
- Total sleep: hours and minutes, plus sleep efficiency %
- Body temperature: how far it is from your normal (for example +0.3 °C)
- Activity score, plus steps
- Latest workout: activity, time and calories ("No workouts in the last 7 days" if there are none)

## Agent column (teal): cells added under Readiness
Values come from the agent's latest day.
- Calls (already there)
- Error rate (already there)
- Freshness
- Correction rate
- Latency
- Retry rate
- Tokens
- Context fill

The Cross-analysis column stays as it is.

Empty values follow the current rule: a cell shows a short message ("No reading yet"), never dashes. On a phone the cells stack in the same order as now.

## What the numbers mean (also shown as a one-line note on each cell)
**You**
- Readiness (0–100): Oura's overall estimate of how recovered you are today. 85+ is strong, under 70 means take it easier.
- Sleep score: how good last night's sleep was (length, depth, timing).
- HRV: the variation between heartbeats. Higher than your usual means you're recovered; a drop can mean stress, illness or poor sleep.
- Resting heart rate: your lowest heart rate overnight. If it's higher than usual, your body is under strain.
- Heart rate now: your latest daytime reading. A long stretch well above resting, without a workout, can mean stress in the middle of the day.
- Total sleep / efficiency: time asleep, and the share of time in bed you were actually asleep (85%+ is good).
- Body temperature: how far you are from your usual temperature. Big swings can come before illness.
- Activity score / steps: how active you've been compared with your goal.
- Workouts: the sessions your ring detected or you logged.

**Agent**
- Readiness (0–100): how fit your agent is to work, based on freshness, corrections, errors, how full its context is, and retries.
- Freshness: how up to date its knowledge of you is. It loses points as its last refresh gets older.
- Correction rate: how often you flagged its replies with "This was wrong".
- Error rate: the share of its calls that failed.
- Calls: how many model calls it made that day.
- Latency: its typical response time. If this rises, it's slowing down.
- Retry rate: how often it had to try a call again.
- Tokens: the total text it read and wrote. This is roughly its workload.
- Context fill: how full its working memory was. Near 100% means it starts forgetting earlier details.

## Technical details
- Only `src/routes/app.tsx` changes: add more `SlotCard`s in the "Human detail" and "Agent detail" sections, built from the existing `oura`, `latestAgent`, and heart-rate/workout data the page already loads (heart-rate data reused from `HeartRateLine`'s query, latest workout from `oura_workouts` limit 1).
- `SlotCard` gets an optional `note` line (full-contrast text, smaller size).
- No changes to the schema, edge functions or readiness formula.
