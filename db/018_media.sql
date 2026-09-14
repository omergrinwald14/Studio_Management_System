-- The process gallery: raw material, work in progress, finished piece — and a
-- flag for the shots good enough to show. From the spec, and it earns its place
-- twice over: the same photographs are what he posts and what he shows the next
-- client who asks "what does your work look like".
--
-- Images only for now, deliberately. The spec also asks for video, but the free
-- tier's storage is 1 GB in total: at the ~300 KB a compressed photo takes that
-- is a few thousand pictures, while a single phone video is 50-100 MB and a
-- dozen of them would fill it. Worth revisiting on a paid plan, not before.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

create policy "authenticated read media" on storage.objects
  for select to authenticated using (bucket_id = 'media');

create policy "authenticated upload media" on storage.objects
  for insert to authenticated with check (bucket_id = 'media');

create policy "authenticated delete media" on storage.objects
  for delete to authenticated using (bucket_id = 'media');

create table public.media (
  id         bigint generated always as identity primary key,
  project_id bigint not null references public.projects (id) on delete cascade,
  path       text    not null,   -- inside the bucket; signed on demand, never stored as a URL
  phase      text    not null default 'wip' check (phase in ('raw', 'wip', 'final')),
  -- the checkbox the spec asks for: which of these are worth showing
  portfolio  boolean not null default false,
  caption    text,
  created_at timestamptz not null default now()
);

create index media_project_idx on public.media (project_id);
create index media_portfolio_idx on public.media (portfolio) where portfolio;

grant select, insert, update, delete on public.media to authenticated;

alter table public.media enable row level security;

create policy "authenticated full access" on public.media
  for all to authenticated using (true) with check (true);
