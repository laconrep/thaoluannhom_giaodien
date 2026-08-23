# Hướng dẫn setup one-click

Tài liệu này dùng khi deploy repository sang tài khoản v0 hoặc Vercel khác.

## 1. Kết nối Supabase

Trong project v0 mới, kết nối đúng Supabase project sẽ chạy ứng dụng. Không cần tạo project Supabase mới nếu muốn dùng lại dữ liệu hiện tại.

Các biến môi trường cần có:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` hoặc `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` hoặc `SUPABASE_SECRET_KEY`

Không commit các giá trị secret vào repository.

## 2. Chạy schema one-click

1. Mở file [`scripts/one-click-supabase.sql`](./scripts/one-click-supabase.sql).
2. Sao chép toàn bộ nội dung file.
3. Mở **Supabase SQL Editor** của project đã kết nối.
4. Dán nội dung vào một query mới.
5. Bấm **Run** một lần và chờ query hoàn tất.

File SQL có thể chạy lại an toàn và tự cài đặt:

- Bảng lớp, học sinh, nhóm và nhóm trưởng.
- Bảng phiên thảo luận và thành viên phiên.
- Bảng thành viên nhóm `class_group_members`.
- Bảng upload PowerPoint và slide.
- RLS policies, index và trigger cần thiết.
- Realtime publication.
- Storage bucket `presentations` cho slide giáo viên với giới hạn 50 MB.
- Storage bucket `submissions` cho bài nộp học sinh với giới hạn 50 MB.
- Schema cache PostgREST reload.

## 3. Kiểm tra nhanh sau khi chạy

Trong SQL Editor, chạy:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'classes', 'students', 'class_groups', 'class_group_members',
    'sessions', 'session_groups', 'session_group_members',
    'presentations', 'presentation_slides'
  )
order by table_name;
```

Kết quả cần có đủ 9 bảng. Kiểm tra bucket upload:

```sql
select id, name, public, file_size_limit
from storage.buckets
where id in ('presentations', 'submissions')
order by id;
```

Bucket cần có `file_size_limit = 52428800`.

## 4. Deploy ứng dụng

Sau khi schema chạy thành công:

1. Đảm bảo repository đã được kết nối với project v0 mới.
2. Bấm **Publish/Deploy** trên v0 hoặc Vercel.
3. Chờ build hoàn tất.
4. Kiểm tra lần lượt:
   - Đăng nhập.
   - Tạo lớp.
   - Tạo hoặc kéo thả nhóm.
   - Tạo phiên thảo luận.
   - Học sinh quét QR và chọn nhóm.
   - Phân quyền nhóm trưởng.
   - Upload file PowerPoint.

## 5. Lưu ý quan trọng

- Chạy SQL trước khi mở hoặc test các tính năng của ứng dụng.
- Nếu đổi Supabase project, phải chạy lại file SQL trên project mới.
- Nếu phiên cũ không có nhóm, tạo phiên mới sau khi chạy schema; phiên cũ có thể cần đồng bộ nhóm thủ công.
- Nếu thấy lỗi `could not find table`, kiểm tra đúng Supabase project và chạy lại toàn bộ file SQL.
- Nếu thấy lỗi upload slide, kiểm tra bucket `presentations`; bài nộp học sinh dùng bucket `submissions`. Kiểm tra MIME types và giới hạn dung lượng.
- Nếu schema đã chạy nhưng API vẫn không thấy bảng, chạy lại câu lệnh:

```sql
notify pgrst, 'reload schema';
```

## Tóm tắt one-click

```text
Kết nối Supabase → chạy scripts/one-click-supabase.sql → kiểm tra 9 bảng + bucket → Deploy → test các luồng chính
```

SQL setup là idempotent: có thể chạy lại khi database mới chỉ được cài một phần.
