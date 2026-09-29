# Setting up: Add Task, deadline alerts, alarm, Do Not Disturb

These three files are **not part of the website** — don't upload this folder to
Hostinger. They're the one-time backend setup for the new features. Do this
once, in order, from a laptop (not the phone).

## What's already done (no action needed)

The website files (`app.js`, `data.js`, `app.css`, `sw.js`) already have the
new Add Task screen, the Do Not Disturb switch, and the in-app alarm. Just
upload them the normal way (see the main setup guide) once you're ready.

## Step 1 — Create the `tasks` table

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Open `task_alerts.sql` in this folder, copy its contents, paste into the
   query box, and click **Run**.
3. You should see "Success. No rows returned."

This creates the table that stores tasks and their deadlines. Do Not Disturb
needs no table change — it's just a switch saved with your other settings.

## Step 2 — Deploy the new edge function

1. Supabase dashboard → **Edge Functions** → **Deploy a new function**.
2. Name it exactly `send-task-alerts`.
3. Open `send-task-alerts.ts` in this folder, copy its contents, and paste
   them in as the function code.
4. Before deploying, turn **Verify JWT** OFF — same setting as your existing
   `send-reminders` function.
5. Deploy it. No new secrets to add: it reuses the same
   `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` / `CRON_SECRET`
   already set on this project.

## Step 3 — Schedule it to run every minute

1. Find your project ref: it's the part before `.supabase.co` in your
   Supabase URL (from `config.js`, that's `tdisbllxgifxyahpeopu`).
2. Find the `CRON_SECRET` value already used by your existing
   `ceo-planner-reminders` cron job. In SQL Editor, run:
   ```sql
   select jobname, command from cron.job where jobname = 'ceo-planner-reminders';
   ```
   and copy the `x-cron-secret` value out of the `command` column.
3. Open `cron_job.sql` in this folder, replace `<YOUR-PROJECT-REF>` and
   `<YOUR-CRON-SECRET>` with those two values, then run it in SQL Editor.
4. Check it registered:
   ```sql
   select jobname, schedule, active from cron.job where jobname = 'ceo-planner-task-alerts';
   ```
   `active` should say `true`.

## Step 4 — Test it

1. Upload the updated site files to Hostinger (or test at `localhost:5500`
   first — remember, real push notifications only work on the live https
   site added to your Home Screen).
2. In the app, go to **Today** → **Add task**, and add a task with a
   deadline about 12 minutes from now.
3. Wait — you should get a push saying "Due in 10 minutes" once it's within
   10 minutes of the deadline, and then, if you don't mark it done, a push
   every 5 minutes once the deadline passes.
4. With the app **open**, once the deadline passes and the task is still
   not done, a full-screen alarm should appear with a beeping sound —
   tap "Mark done" or "Snooze 5 min" to clear it.
5. Flip on **Do Not Disturb** (More → Reminders) and confirm nothing comes
   through while it's on.

## A note on "alarm" on iPhone

A website (even one added to the Home Screen) cannot ring the iPhone's own
Alarm/Clock app or override Silent Mode — Apple doesn't allow that for any
web app. What you now have is the closest practical version of an alarm:
- **App open** → a full-screen, flashing, beeping alert that won't go away
  until you dismiss it.
- **App closed** → a push notification every 5 minutes until the task is
  done (same sound/vibration as any other notification, and it will still
  respect your phone's Silent Mode / Focus settings, same as every app).

## About Do Not Disturb and your existing reminders

The new Do Not Disturb switch is fully wired up for **tasks** (this new
feature). Your existing day-of-week **reminders** (the ones in More →
Reminders) are sent by the older `send-reminders` function, which I haven't
touched — so right now DND does not yet silence those. If you'd like it to,
share that function's current code and I'll add the same one-line check to
it, without changing anything else about how it works.
