-- Receipt photos, and the first use of Supabase Storage in this system.
--
-- His spec asked for this from the start: "הזנת הוצאה מהירה — כפתור צף (+)
-- בנייד להזנת הוצאה/הכנסה בתוך שניות (כולל צילום קבלה)". A receipt he
-- photographs in the lumber yard is worth more than one he means to file later.
--
-- The bucket is PRIVATE. A public bucket would hand anyone with the URL a
-- photograph of his business's spending, and object URLs are guessable enough
-- that "nobody knows the link" is not a control. The app reads them through
-- signed URLs that expire instead.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760,  -- 10 MB: a phone photo, not a scan of a book
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do nothing;

-- Same rule as every other table (D19): signed in or nothing. Storage policies
-- live on storage.objects and have to be written per operation.
create policy "authenticated read receipts" on storage.objects
  for select to authenticated using (bucket_id = 'receipts');

create policy "authenticated upload receipts" on storage.objects
  for insert to authenticated with check (bucket_id = 'receipts');

create policy "authenticated replace receipts" on storage.objects
  for update to authenticated using (bucket_id = 'receipts');

create policy "authenticated delete receipts" on storage.objects
  for delete to authenticated using (bucket_id = 'receipts');

-- The path inside the bucket, not a URL: a signed URL expires, so storing one
-- would leave dead links in the ledger within the hour.
alter table public.txs
  add column receipt_path text;
