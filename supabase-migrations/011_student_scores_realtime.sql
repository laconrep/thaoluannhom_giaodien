-- 011: bật realtime cho bảng student_scores
-- Mục đích: trang Bảng điểm (lớp) tự cập nhật ngay khi giáo viên sửa điểm
-- ở khung chấm (annotation) hoặc ở nơi khác, không cần tải lại trang.
-- Chạy 1 lần trong SQL Editor của Supabase (giống cách đã chạy migration 009).
-- Lệnh an toàn chạy lại nhiều lần (chỉ thêm khi chưa có).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'student_scores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.student_scores;
  END IF;
END
$$;
