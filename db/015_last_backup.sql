-- When he last downloaded a backup.
--
-- Kept in settings rather than in the browser so the reminder follows him from
-- the phone to the laptop, instead of each device having its own opinion about
-- whether the books are safe.
alter table public.settings
  add column last_backup date;
