-- Migration: thêm cột provider cho ai_grade_jobs
-- Chạy trong Supabase Dashboard → SQL Editor (1 lần duy nhất)
--
-- provider: 'gemini' | 'muse' | 'muse_chat'
--   gemini    → chấm bằng key Gemini của giáo viên (luồng cũ trong app)
--   muse      → chấm bằng Muse Model API, key hệ thống (luồng trong app)
--   muse_chat → chấm qua khung chat Muse (hook bên ngoài đảm nhận, app bỏ qua)

alter table public.ai_grade_jobs
  add column if not exists provider text not null default 'auto';

-- Chuẩn hoá các job cũ chưa có provider: suy ra từ key đã dùng
-- (giữ nguyên 'auto' cũng không sao — app coi như luồng cũ)
comment on column public.ai_grade_jobs.provider is 'AI provider: gemini | muse | muse_chat (chat grading via external hook)';
