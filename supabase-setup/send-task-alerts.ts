// ─────────────────────────────────────────────────────────────
//  New Supabase Edge Function: send-task-alerts
//  Deploy this as its own function, alongside the existing
//  send-reminders function — it does NOT touch or replace it.
//
//  What it does, every time it's called (once a minute, via the
//  cron job in cron_job.sql):
//   - looks at every task that isn't done yet
//   - 10 minutes before its deadline: sends one push, once
//   - once the deadline has passed: sends a push every 5 minutes
//     until the task is marked done
//   - skips a user entirely while their Do Not Disturb switch is on
//
//  Deploy settings: same as send-reminders — JWT verification OFF.
//  No new secrets needed: it reuses VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
//  VAPID_SUBJECT and CRON_SECRET, which are already set on this project,
//  plus the SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY that Supabase
//  gives every edge function automatically.
// ─────────────────────────────────────────────────────────────
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // India is always UTC+5:30, no DST

function istDeadline(day: string, time: string) {
  // day "YYYY-MM-DD", time "HH:MM", both meant as India time
  const asIfUtc = new Date(`${day}T${time}:00.000Z`);
  return new Date(asIfUtc.getTime() - IST_OFFSET_MS);
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  const now = new Date();

  const { data: tasks, error } = await sb.from("tasks").select("*").eq("done", false);
  if (error) return new Response(error.message, { status: 500 });
  if (!tasks || !tasks.length) return new Response("no pending tasks", { status: 200 });

  // group by user so settings + subscriptions are fetched once per person
  const byUser = new Map<string, typeof tasks>();
  for (const t of tasks) {
    if (!byUser.has(t.user_id)) byUser.set(t.user_id, []);
    byUser.get(t.user_id)!.push(t);
  }

  let sent = 0;
  for (const [userId, userTasks] of byUser) {
    const { data: settingsRow } = await sb.from("settings").select("data").eq("user_id", userId).maybeSingle();
    if (settingsRow?.data?.dnd) continue; // Do Not Disturb is on — skip this person entirely

    const { data: subs } = await sb.from("push_subscriptions").select("*").eq("user_id", userId);
    if (!subs || !subs.length) continue;

    for (const t of userTasks) {
      const deadline = istDeadline(t.day, t.time);
      const msTo = deadline.getTime() - now.getTime();

      let payload: { title: string; body: string; tag: string; renotify: boolean; url: string } | null = null;
      const patch: Record<string, unknown> = {};

      if (!t.notified_pre && msTo > 0 && msTo <= 10 * 60 * 1000) {
        payload = { title: "Due in 10 minutes", body: t.title, tag: `task-${t.id}`, renotify: true, url: "./#today" };
        patch.notified_pre = true;
      } else if (msTo <= 0) {
        const last = t.last_overdue_sent ? new Date(t.last_overdue_sent).getTime() : 0;
        if (now.getTime() - last >= 5 * 60 * 1000) {
          payload = { title: "Overdue task", body: t.title, tag: `task-${t.id}`, renotify: true, url: "./#today" };
          patch.last_overdue_sent = now.toISOString();
        }
      }
      if (!payload) continue;

      for (const s of subs) {
        const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
        try {
          await webpush.sendNotification(subscription, JSON.stringify(payload));
          sent++;
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          }
        }
      }
      if (Object.keys(patch).length) await sb.from("tasks").update(patch).eq("id", t.id);
    }
  }

  return new Response(`sent ${sent} push messages`, { status: 200 });
});
