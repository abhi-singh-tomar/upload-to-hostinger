-- ─────────────────────────────────────────────────────────────
--  Run this once in Supabase → SQL Editor, AFTER the send-task-alerts
--  function has been deployed (Edge Functions → New function).
--
--  Replace the two <PLACEHOLDER> values below before running:
--   1. <YOUR-PROJECT-REF> → the project ref in your Supabase URL,
--      e.g. for https://tdisbllxgifxyahpeopu.supabase.co it's
--      tdisbllxgifxyahpeopu
--   2. <YOUR-CRON-SECRET> → the exact same secret value already used
--      by the existing "ceo-planner-reminders" cron job. You can see
--      the existing job (without revealing the secret in plain text
--      if you'd rather not) by running:
--        select jobname, schedule, command from cron.job;
--      and copying the x-cron-secret value from its command text.
-- ─────────────────────────────────────────────────────────────

select cron.schedule(
  'ceo-planner-task-alerts',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<YOUR-PROJECT-REF>.supabase.co/functions/v1/send-task-alerts',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<YOUR-CRON-SECRET>'),
    body := '{}'::jsonb
  );
  $$
);

-- To check it's registered:
--   select jobname, schedule, active from cron.job where jobname = 'ceo-planner-task-alerts';
-- To remove it later if ever needed:
--   select cron.unschedule('ceo-planner-task-alerts');
