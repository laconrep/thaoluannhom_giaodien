-- 010_rollback: KHÔI PHỤC policy mở cũ (trạng thái trước migration 010).
-- CHỈ chạy khi sau khi chạy 010 có luồng nào hỏng và cần về lại ngay để lớp
-- học tiếp tục chạy. Sau khi rollback, báo lại bước hỏng để sửa policy 010
-- cho đúng luồng đó rồi chạy lại 010.
--
-- Lưu ý: rollback này MỞ LẠI toàn bộ lỗ hổng báo cáo bảo mật 24/10/2026
-- (anon đọc/ghi/xóa được qua REST). Chỉ dùng tạm thời để cứu giờ học.

-- Dọn policy siết của 010 (drop if exists nên chạy lại cũng an toàn).
drop policy if exists t010_classes_anon_select on public.classes;
drop policy if exists t010_classes_teacher_all on public.classes;
drop policy if exists t010_students_anon_select on public.students;
drop policy if exists t010_students_anon_update on public.students;
drop policy if exists t010_students_teacher_all on public.students;
drop policy if exists t010_class_groups_anon_select on public.class_groups;
drop policy if exists t010_class_groups_teacher_all on public.class_groups;
drop policy if exists t010_class_group_members_anon_select on public.class_group_members;
drop policy if exists t010_class_group_members_anon_write on public.class_group_members;
drop policy if exists t010_class_group_members_teacher_all on public.class_group_members;
drop policy if exists t010_sessions_anon_select on public.sessions;
drop policy if exists t010_sessions_teacher_all on public.sessions;
drop policy if exists t010_session_groups_anon_select on public.session_groups;
drop policy if exists t010_session_groups_anon_update on public.session_groups;
drop policy if exists t010_session_groups_teacher_all on public.session_groups;
drop policy if exists t010_session_group_members_anon_all on public.session_group_members;
drop policy if exists t010_session_group_members_teacher_all on public.session_group_members;
drop policy if exists t010_session_slots_anon_select on public.session_slots;
drop policy if exists t010_session_slots_anon_update on public.session_slots;
drop policy if exists t010_session_slots_teacher_all on public.session_slots;
drop policy if exists t010_submissions_anon_select on public.submissions;
drop policy if exists t010_submissions_anon_insert on public.submissions;
drop policy if exists t010_submissions_anon_update on public.submissions;
drop policy if exists t010_submissions_teacher_all on public.submissions;
drop policy if exists t010_annotations_anon_select on public.annotations;
drop policy if exists t010_annotations_teacher_all on public.annotations;
drop policy if exists t010_student_scores_anon_select on public.student_scores;
drop policy if exists t010_student_scores_teacher_all on public.student_scores;
drop policy if exists t010_score_history_teacher_all on public.score_history;
drop policy if exists t010_profiles_own_select on public.profiles;
drop policy if exists t010_profiles_own_insert_free on public.profiles;
drop policy if exists t010_profiles_own_update_free on public.profiles;
drop policy if exists t010_presentations_anon_select on public.presentations;
drop policy if exists t010_presentations_teacher_all on public.presentations;
drop policy if exists t010_presentation_slides_anon_select on public.presentation_slides;
drop policy if exists t010_presentation_slides_teacher_all on public.presentation_slides;
drop policy if exists t010_ai_grade_jobs_teacher_all on public.ai_grade_jobs;
drop policy if exists t010_ai_grade_results_anon_shared_only on public.ai_grade_results;
drop policy if exists t010_ai_grade_results_teacher_all on public.ai_grade_results;
drop policy if exists t010_teacher_backend_map_own_select on public.teacher_backend_map;
drop policy if exists t010_dup_flags_anon_insert on public.submission_duplicate_flags;
drop policy if exists t010_dup_flags_anon_delete on public.submission_duplicate_flags;
drop policy if exists t010_dup_flags_teacher_select on public.submission_duplicate_flags;
drop policy if exists t010_storage_teacher_read on storage.objects;
drop policy if exists t010_storage_media_public_read on storage.objects;

-- Khôi phục policy mở cũ (đúng tên trong script setup gốc).
create policy classes_public_all on public.classes for all using (true) with check (true);
create policy students_public_all on public.students for all using (true) with check (true);
create policy cg_public_all on public.class_groups for all using (true) with check (true);
create policy cgm_public_all on public.class_group_members for all using (true) with check (true);
create policy sessions_public_all on public.sessions for all using (true) with check (true);
create policy session_groups_public_all on public.session_groups for all using (true) with check (true);
create policy sgm_public_all on public.session_group_members for all using (true) with check (true);
create policy session_slots_public_all on public.session_slots for all using (true) with check (true);
create policy submissions_public_all on public.submissions for all using (true) with check (true);
create policy annotations_public_all on public.annotations for all using (true) with check (true);
create policy student_scores_public_all on public.student_scores for all using (true) with check (true);
create policy sh_public_all on public.score_history for all using (true) with check (true);
create policy profiles_public_all on public.profiles for all using (true) with check (true);
create policy presentations_public_all on public.presentations for all using (true) with check (true);
create policy presentation_slides_public_all on public.presentation_slides for all using (true) with check (true);
create policy ai_grade_jobs_public_all on public.ai_grade_jobs for all using (true) with check (true);
create policy ai_grade_results_public_all on public.ai_grade_results for all using (true) with check (true);
create policy backend_stations_public_all on public.backend_stations for all using (true) with check (true);
create policy teacher_backend_map_public_all on public.teacher_backend_map for all using (true) with check (true);
create policy submission_duplicate_flags_public_all on public.submission_duplicate_flags for all using (true) with check (true);

create policy presentations_storage_insert on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'presentations');
create policy presentations_storage_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'presentations');
create policy presentations_storage_update on storage.objects
  for update to anon, authenticated using (bucket_id = 'presentations') with check (bucket_id = 'presentations');
create policy presentations_storage_delete on storage.objects
  for delete to anon, authenticated using (bucket_id = 'presentations');
create policy submissions_storage_insert on storage.objects
  for insert with check (bucket_id = 'submissions');
create policy submissions_storage_read on storage.objects
  for select using (bucket_id = 'submissions');
create policy submissions_storage_delete on storage.objects
  for delete using (bucket_id = 'submissions');
create policy submission_media_storage_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'submission-media');
create policy submission_media_storage_insert on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'submission-media');
create policy submission_media_storage_update on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'submission-media')
  with check (bucket_id = 'submission-media');
create policy submission_media_storage_delete on storage.objects
  for delete to anon, authenticated using (bucket_id = 'submission-media');
