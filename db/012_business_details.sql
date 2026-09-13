-- A quote he sends a client has to say who it is from. None of this existed
-- anywhere in the system, because until now nothing left the building.
--
-- All optional and all editable (D12): he fills them in once and every quote
-- document carries them. `quote_terms` is the standing text at the foot of a
-- quote — payment terms, validity, the fact that an עוסק פטור charges no VAT
-- (D3) — kept as free text rather than modelled, because it is prose he will
-- want to reword, not data anything computes with.
alter table public.settings
  add column business_name  text,
  add column business_phone text,
  add column business_email text,
  add column business_id    text,   -- מספר עוסק
  add column quote_terms    text;
