-- Extra charges on a quote: הובלה, התקנה, and whatever else a job needs.
--
-- They cannot be costed from a rate the way labour is. Delivery depends on the
-- distance, installation on how awkward the site is, so he types a figure for
-- each one, per quote. The name is free text; names he has used before come
-- back as suggestions, read from this same table.
--
-- A table of their own rather than more rows in quote_items: the builder picks
-- the wood out of quote_items as "the line that is not מתכלים", and quote_items
-- feeds the wood-species suggestions. A delivery charge is neither.
create table public.quote_extras (
  id         bigint generated always as identity primary key,
  quote_id   bigint not null references public.quotes (id) on delete cascade,
  name       text    not null,
  amount     numeric not null default 0 check (amount >= 0),
  created_at timestamptz not null default now()
);

create index quote_extras_quote_idx on public.quote_extras (quote_id);

grant select, insert, update, delete on public.quote_extras to authenticated;

alter table public.quote_extras enable row level security;

create policy "authenticated full access" on public.quote_extras
  for all to authenticated using (true) with check (true);
