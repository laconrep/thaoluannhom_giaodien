-- ============================================================
-- BUCKET ẢNH CHÈN TRONG BÀI NỘP (submission-media)
-- Bucket PUBLIC: ảnh được nhúng thẳng vào nội dung bài viết dưới dạng
-- URL công khai, nên link phải bền (không dùng signed URL hết hạn).
-- Chạy trong Supabase SQL Editor (idempotent).
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submission-media',
  'submission-media',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Đọc công khai: bất kỳ ai có URL đều xem được ảnh (kể cả học sinh chưa đăng nhập).
drop policy if exists submission_media_storage_read on storage.objects;
create policy submission_media_storage_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'submission-media');

-- Ghi: học sinh nộp bài qua signed URL nên cần quyền insert/update/delete
-- tương ứng với bucket này (giống pattern của bucket submissions).
drop policy if exists submission_media_storage_insert on storage.objects;
create policy submission_media_storage_insert on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'submission-media');

drop policy if exists submission_media_storage_update on storage.objects;
create policy submission_media_storage_update on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'submission-media')
  with check (bucket_id = 'submission-media');

drop policy if exists submission_media_storage_delete on storage.objects;
create policy submission_media_storage_delete on storage.objects
  for delete to anon, authenticated using (bucket_id = 'submission-media');
