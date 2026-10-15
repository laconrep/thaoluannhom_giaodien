-- Migration: hỗ trợ "AI suy barem từ bài chấm mẫu"
-- Chạy trong Supabase Dashboard → SQL Editor (1 lần duy nhất)
--
-- Luồng: giáo viên chọn 1 bài đã chấm tay trong phiên → app insert dòng
-- source='sample', sample_submission_id=<id bài nộp>, status='pending'
-- → hook bên ngoài (Muse chat) chỉ BÁO TIN (không tự xử lý vì cần xem ảnh)
-- → main agent bung subagent có mắt: đọc ảnh bài mẫu + dấu chấm/nhận xét của giáo viên
-- → suy barem mẫu A → tự chấm lại bài mẫu để kiểm tra (ghi self_check_json)
-- → giáo viên mở popup "Tiêu chí chấm" duyệt/sửa → lưu vào sessions.ai_rubric

alter table public.ai_barem_requests
  add column if not exists source text not null default 'answer'; -- 'answer' | 'sample'

alter table public.ai_barem_requests
  add column if not exists sample_submission_id uuid null
    references public.submissions(id) on delete set null;

alter table public.ai_barem_requests
  add column if not exists self_check_json jsonb null;

create index if not exists ai_barem_requests_sample_idx
  on public.ai_barem_requests (sample_submission_id)
  where sample_submission_id is not null;

-- RLS: policy "teachers manage own barem requests" (migration 002) là FOR ALL
-- nên tự áp dụng cho các cột mới, không cần policy thêm.
