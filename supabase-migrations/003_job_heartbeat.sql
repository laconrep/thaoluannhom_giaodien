-- Migration: heartbeat cho job chấm AI (watchdog chống worker kẹt)
-- Chạy trong Supabase Dashboard → SQL Editor (1 lần duy nhất)
--
-- Worker cập nhật heartbeat_at sau mỗi bài chấm xong.
-- Hook sẽ thu hồi (reclaim) job muse_chat đang 'running' mà heartbeat
-- quá cũ (>15 phút) hoặc chưa từng có heartbeat sau 30 phút.

alter table public.ai_grade_jobs
  add column if not exists heartbeat_at timestamptz null;

comment on column public.ai_grade_jobs.heartbeat_at is 'Worker cập nhật sau mỗi submission; hook reclaim job running quá 15 phút không heartbeat';
