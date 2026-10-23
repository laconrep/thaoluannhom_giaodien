-- 008: Đề bài cho phiên giao việc cá nhân.
-- prompt_text: bản chữ GV gõ/dán (HTML rich text, giống text_content của bài nộp).
-- prompt_file: file đính kèm {url, name, kind, mime, rotation} (SubmissionFile) ở bucket submissions, thư mục prompts/<session_id>/.
-- prompt_source: 'text' | 'file' — khi có cả chữ lẫn file, GV chọn bản nào sẽ giao cho HS.
alter table public.sessions add column if not exists prompt_text text;
alter table public.sessions add column if not exists prompt_file jsonb;
alter table public.sessions add column if not exists prompt_source text;
