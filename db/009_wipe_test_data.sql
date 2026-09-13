-- One-off: clear everything entered while building, before real data goes in.
--
-- IRREVERSIBLE. The free Supabase tier takes no backups at all (D4), so there is
-- nothing to restore from. Read the list below and be sure it is what you want.
--
-- TRUNCATE rather than DELETE for two reasons: CASCADE follows the foreign keys
-- so the order of the tables does not matter, and RESTART IDENTITY sets the id
-- counters back to 1 — the first real client becomes client 1 rather than 14.
--
-- Not touched: `settings` (see below), `ping` (the keep-alive heartbeat), and the
-- login user itself.
truncate table
  public.txs,
  public.materials,
  public.quote_items,
  public.quotes,
  public.projects,
  public.clients,
  public.suppliers,
  public.stock,
  public.workshop_days
restart identity cascade;

-- Settings hold the opening balance, the rent and the day rate. If those are his
-- real figures, leave this commented out. If they were placeholders, run it too —
-- and then set the real ones from the הגדרות screen rather than from here (D12).
--
-- update public.settings
--    set opening = 0,
--        opening_date = null,
--        rent = 0,
--        days_per_month = 8,
--        day_rate = 0,
--        updated_at = now()
--  where id = 1;
