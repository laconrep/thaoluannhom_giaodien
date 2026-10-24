-- 010: Siết RLS + Storage policy — sửa lỗi gốc của báo cáo bảo mật 24/10/2026.
--
-- TRƯỚC ĐÂY: gần như mọi bảng và bucket đều `for all using (true)` — bất kỳ
-- ai có anon key (public, nằm trong JS client) cũng đọc/ghi/xóa được toàn bộ
-- database và file qua REST/Storage API, không cần đăng nhập.
--
-- SAU FILE NÀY:
--  * Service role (hook chấm bài, trang admin, các route ký signed URL) bypass
--    RLS hoàn toàn nên không bị ảnh hưởng.
--  * Giáo viên (authenticated): chỉ thấy/sửa dữ liệu của lớp mình sở hữu
--    (classes.teacher_id = auth.uid(), hoặc qua join session -> class).
--  * Học sinh ẩn danh (anon, link /c/): CHỈ giữ đúng những thao tác mà luồng
--    nộp bài/chọn ô/chọn nhóm đang cần. Phần còn lại bị khóa.
--
-- RỦI RO CÒN LẠI (cố tình giữ lại để không sập app, sẽ đóng ở giai đoạn code):
--  R1. Anon vẫn SELECT được các bảng trang công khai cần (classes, sessions,
--      students, session_groups, session_slots, session_group_members,
--      submissions, annotations, student_scores, presentations,
--      presentation_slides) — trong đó có cột students.device_token. Đóng hẳn
--      cần chuyển các thao tác claim/nộp sang server action có kiểm tra
--      (giai đoạn 2-3 của báo cáo), vì hiện tại chính các action đó cũng chạy
--      bằng anon key và phải đọc device_token để đối chiếu.
--  R2. Anon vẫn UPDATE được các bảng luồng HS cần ghi (students,
--      session_groups, session_slots, session_group_members, submissions,
--      submission_duplicate_flags) — chưa siết theo từng ô/nhóm được vì anon
--      không mang danh tính trong JWT. Giai đoạn 2 sẽ thêm kiểm tra trong
--      server action (slot/group thuộc session, device binding, file hợp lệ).
--  R3. Anon vẫn SELECT student_scores (trang bảng điểm công khai /c/.../scores
--      đọc bằng anon key) — đây là trang điểm công khai theo thiết kế.
--
-- CÁCH CHẠY: chạy toàn bộ file trong Supabase SQL Editor (Dashboard ->
-- SQL Editor), rồi KIỂM TRA NGAY theo checklist cuối file. Nếu luồng nào
-- hỏng, chạy file 010_rollback.sql để về lại policy mở cũ, rồi báo lại.
--
-- ============ 0. DỌN POLICY MỞ CŨ ============
-- (drop if exists nên chạy lại file cũng an toàn)

drop policy if exists classes_public_all on public.classes;
drop policy if exists students_public_all on public.students;
drop policy if exists class_groups_public_all on public.class_groups;
drop policy if exists cg_public_all on public.class_groups;
drop policy if exists class_group_members_public_all on public.class_group_members;
drop policy if exists cgm_public_all on public.class_group_members;
drop policy if exists sessions_public_all on public.sessions;
drop policy if exists session_groups_public_all on public.session_groups;
drop policy if exists session_group_members_public_all on public.session_group_members;
drop policy if exists sgm_public_all on public.session_group_members;
drop policy if exists session_slots_public_all on public.session_slots;
drop policy if exists submissions_public_all on public.submissions;
drop policy if exists annotations_public_all on public.annotations;
drop policy if exists student_scores_public_all on public.student_scores;
drop policy if exists score_history_public_all on public.score_history;
drop policy if exists sh_public_all on public.score_history;
drop policy if exists profiles_public_all on public.profiles;
drop policy if exists presentations_public_all on public.presentations;
drop policy if exists presentation_slides_public_all on public.presentation_slides;
drop policy if exists ai_grade_jobs_public_all on public.ai_grade_jobs;
drop policy if exists ai_grade_results_public_all on public.ai_grade_results;
drop policy if exists backend_stations_public_all on public.backend_stations;
drop policy if exists teacher_backend_map_public_all on public.teacher_backend_map;
drop policy if exists submission_duplicate_flags_public_all on public.submission_duplicate_flags;

-- Lưới an toàn: dọn nốt mọi policy mở còn sót dưới tên khác (vd script
-- one-click dùng tên rút gọn cg_public_all/cgm_public_all/sgm_public_all/
-- sh_public_all). Chỉ chạm tới policy có tên kết thúc bằng _public_all.
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('classes','students','class_groups','class_group_members',
        'sessions','session_groups','session_group_members','session_slots',
        'submissions','annotations','student_scores','score_history','profiles',
        'presentations','presentation_slides','ai_grade_jobs','ai_grade_results',
        'backend_stations','teacher_backend_map','submission_duplicate_flags')
      and policyname like '%_public_all'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ============ 1. CLASSES ============
-- Anon SELECT: trang /c/ tìm lớp bằng share_token.
create policy t010_classes_anon_select on public.classes
  for select to anon using (true);
-- Giáo viên: toàn quyền trên lớp mình sở hữu.
create policy t010_classes_teacher_all on public.classes
  for all to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

-- ============ 2. STUDENTS (danh sách lớp) ============
-- Anon SELECT: sảnh lớp / trang nộp bài đọc roster (xem R1 về device_token).
create policy t010_students_anon_select on public.students
  for select to anon using (true);
-- Anon UPDATE: HS tự đặt tên / gắn device_token (studentSetNameAction,
-- studentClaimSlotAction — xem R2).
create policy t010_students_anon_update on public.students
  for update to anon using (true) with check (true);
-- Giáo viên: toàn quyền trên HS của lớp mình.
create policy t010_students_teacher_all on public.students
  for all to authenticated using (
    exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
  ) with check (
    exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
  );

-- ============ 3. CLASS_GROUPS / CLASS_GROUP_MEMBERS (nhóm cố định) ============
create policy t010_class_groups_anon_select on public.class_groups
  for select to anon using (true);
create policy t010_class_groups_teacher_all on public.class_groups
  for all to authenticated using (
    exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
  ) with check (
    exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
  );
create policy t010_class_group_members_anon_select on public.class_group_members
  for select to anon using (true);
-- Anon ghi: nhóm trưởng kéo thành viên trên thiết bị HS (xem R2).
create policy t010_class_group_members_anon_write on public.class_group_members
  for all to anon using (true) with check (true);
create policy t010_class_group_members_teacher_all on public.class_group_members
  for all to authenticated using (
    exists (select 1 from public.class_groups g join public.classes c on c.id = g.class_id
            where g.id = class_group_id and c.teacher_id = auth.uid())
  ) with check (
    exists (select 1 from public.class_groups g join public.classes c on c.id = g.class_id
            where g.id = class_group_id and c.teacher_id = auth.uid())
  );

-- ============ 4. SESSIONS (phiên) ============
create policy t010_sessions_anon_select on public.sessions
  for select to anon using (true);
create policy t010_sessions_teacher_all on public.sessions
  for all to authenticated using (
    exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
  ) with check (
    exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
  );

-- ============ 5. SESSION_GROUPS / SESSION_GROUP_MEMBERS / SESSION_SLOTS ============
create policy t010_session_groups_anon_select on public.session_groups
  for select to anon using (true);
-- Anon UPDATE: HS claim nhóm (claimed=true) — xem R2.
create policy t010_session_groups_anon_update on public.session_groups
  for update to anon using (true) with check (true);
create policy t010_session_groups_teacher_all on public.session_groups
  for all to authenticated using (
    exists (select 1 from public.sessions s join public.classes c on c.id = s.class_id
            where s.id = session_id and c.teacher_id = auth.uid())
  ) with check (
    exists (select 1 from public.sessions s join public.classes c on c.id = s.class_id
            where s.id = session_id and c.teacher_id = auth.uid())
  );

create policy t010_session_group_members_anon_all on public.session_group_members
  for all to anon using (true) with check (true);
create policy t010_session_group_members_teacher_all on public.session_group_members
  for all to authenticated using (
    exists (select 1 from public.session_groups g join public.sessions s on s.id = g.session_id
            join public.classes c on c.id = s.class_id
            where g.id = session_group_id and c.teacher_id = auth.uid())
  ) with check (
    exists (select 1 from public.session_groups g join public.sessions s on s.id = g.session_id
            join public.classes c on c.id = s.class_id
            where g.id = session_group_id and c.teacher_id = auth.uid())
  );

create policy t010_session_slots_anon_select on public.session_slots
  for select to anon using (true);
-- Anon UPDATE: HS claim ô (student_id) — xem R2.
create policy t010_session_slots_anon_update on public.session_slots
  for update to anon using (true) with check (true);
create policy t010_session_slots_teacher_all on public.session_slots
  for all to authenticated using (
    exists (select 1 from public.sessions s join public.classes c on c.id = s.class_id
            where s.id = session_id and c.teacher_id = auth.uid())
  ) with check (
    exists (select 1 from public.sessions s join public.classes c on c.id = s.class_id
            where s.id = session_id and c.teacher_id = auth.uid())
  );

-- ============ 6. SUBMISSIONS (bài nộp) ============
-- Anon SELECT: trang nộp bài / kết quả đọc bằng anon key (xem R1).
create policy t010_submissions_anon_select on public.submissions
  for select to anon using (true);
-- Anon INSERT/UPDATE: HS nộp bài / nộp lại (xem R2). KHÔNG cho anon DELETE
-- (xóa bài là thao tác của GV qua "Mở lại", chạy bằng authenticated).
create policy t010_submissions_anon_insert on public.submissions
  for insert to anon with check (true);
create policy t010_submissions_anon_update on public.submissions
  for update to anon using (true) with check (true);
create policy t010_submissions_teacher_all on public.submissions
  for all to authenticated using (
    exists (select 1 from public.sessions s join public.classes c on c.id = s.class_id
            where s.id = session_id and c.teacher_id = auth.uid())
  ) with check (
    exists (select 1 from public.sessions s join public.classes c on c.id = s.class_id
            where s.id = session_id and c.teacher_id = auth.uid())
  );

-- ============ 7. ANNOTATIONS (dấu chấm + điểm tay) ============
-- Anon SELECT: trang kết quả đọc điểm/nhận xét bằng anon key (xem R1).
-- Anon KHÔNG được insert/update/delete (chấm là việc của GV).
create policy t010_annotations_anon_select on public.annotations
  for select to anon using (true);
create policy t010_annotations_teacher_all on public.annotations
  for all to authenticated using (
    exists (select 1 from public.sessions s join public.classes c on c.id = s.class_id
            where s.id = session_id and c.teacher_id = auth.uid())
  ) with check (
    exists (select 1 from public.sessions s join public.classes c on c.id = s.class_id
            where s.id = session_id and c.teacher_id = auth.uid())
  );

-- ============ 8. STUDENT_SCORES / SCORE_HISTORY ============
-- Anon SELECT scores: trang bảng điểm công khai /c/.../scores (xem R3).
create policy t010_student_scores_anon_select on public.student_scores
  for select to anon using (true);
create policy t010_student_scores_teacher_all on public.student_scores
  for all to authenticated using (
    exists (select 1 from public.sessions s join public.classes c on c.id = s.class_id
            where s.id = session_id and c.teacher_id = auth.uid())
  ) with check (
    exists (select 1 from public.sessions s join public.classes c on c.id = s.class_id
            where s.id = session_id and c.teacher_id = auth.uid())
  );
-- Score history: chỉ GV sở hữu mới đọc/ghi (ghi bởi teacher action).
create policy t010_score_history_teacher_all on public.score_history
  for all to authenticated using (
    exists (select 1 from public.sessions s join public.classes c on c.id = s.class_id
            where s.id = session_id and c.teacher_id = auth.uid())
  ) with check (
    exists (select 1 from public.sessions s join public.classes c on c.id = s.class_id
            where s.id = session_id and c.teacher_id = auth.uid())
  );

-- ============ 9. PROFILES (gói) — ĐÓNG LỖ BYPASS THANH TOÁN ============
-- Trước đây ai cũng UPDATE được plan -> tự nâng Pro miễn phí.
-- Luồng hợp lệ duy nhất chạy bằng teacher client là upgradeToPlanAction,
-- và nó CHỈ cho plan='free' (nâng cấp phải qua thanh toán). Admin đổi gói
-- bằng service role nên bypass RLS, không bị ảnh hưởng.
create policy t010_profiles_own_select on public.profiles
  for select to authenticated using (id = auth.uid());
create policy t010_profiles_own_insert_free on public.profiles
  for insert to authenticated with check (id = auth.uid() and plan = 'free');
create policy t010_profiles_own_update_free on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and plan = 'free');

-- ============ 10. PRESENTATIONS / PRESENTATION_SLIDES ============
-- Anon SELECT: HS xem bài giảng trong phiên (file thật vẫn phải qua signed
-- URL mới tải được — xem phần Storage bên dưới).
create policy t010_presentations_anon_select on public.presentations
  for select to anon using (true);
create policy t010_presentations_teacher_all on public.presentations
  for all to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy t010_presentation_slides_anon_select on public.presentation_slides
  for select to anon using (true);
create policy t010_presentation_slides_teacher_all on public.presentation_slides
  for all to authenticated using (
    exists (select 1 from public.presentations p where p.id = presentation_id and p.teacher_id = auth.uid())
  ) with check (
    exists (select 1 from public.presentations p where p.id = presentation_id and p.teacher_id = auth.uid())
  );

-- ============ 11. AI GRADING (jobs/results) ============
-- Jobs: không luồng HS nào đọc trực tiếp (bảng chấm đọc qua teacher action
-- đã kiểm tra sở hữu). Hook chấm chạy bằng service role.
create policy t010_ai_grade_jobs_teacher_all on public.ai_grade_jobs
  for all to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
-- Results: ngoại lệ duy nhất cho anon — trang kết quả của HS đọc ai_feedback
-- để hiện "Nhận xét của giáo viên", NHƯNG chỉ khi GV đã bật chia sẻ kết quả
-- (results_shared_at khác null). Chưa bật chia sẻ thì anon không đọc được.
create policy t010_ai_grade_results_anon_shared_only on public.ai_grade_results
  for select to anon using (
    exists (select 1 from public.sessions s where s.id = session_id and s.results_shared_at is not null)
  );
create policy t010_ai_grade_results_teacher_all on public.ai_grade_results
  for all to authenticated using (
    exists (select 1 from public.ai_grade_jobs j where j.id = job_id and j.teacher_id = auth.uid())
  ) with check (
    exists (select 1 from public.ai_grade_jobs j where j.id = job_id and j.teacher_id = auth.uid())
  );

-- ============ 12. FARM STATIONS / TEACHER_BACKEND_MAP ============
-- Chỉ service role (hook + trang admin) dùng 2 bảng này. Không cấp policy
-- cho anon/authenticated -> mặc định bị chặn (service role bypass RLS).
-- Riêng teacher_backend_map cho GV đọc dòng của chính mình (phòng trường
-- hợp có giao diện nào đọc bằng teacher client sau này).
create policy t010_teacher_backend_map_own_select on public.teacher_backend_map
  for select to authenticated using (teacher_id = auth.uid());

-- ============ 13. SUBMISSION_DUPLICATE_FLAGS (cờ trùng bài, migration 009) ============
-- Ghi cờ chạy trong server action nộp bài bằng anon key: cho anon INSERT +
-- DELETE (làm mới cờ khi nộp lại), KHÔNG cho anon SELECT/UPDATE (không đọc
-- được cờ của người khác). GV đọc cờ bằng teacher client.
create policy t010_dup_flags_anon_insert on public.submission_duplicate_flags
  for insert to anon with check (true);
create policy t010_dup_flags_anon_delete on public.submission_duplicate_flags
  for delete to anon using (true);
create policy t010_dup_flags_teacher_select on public.submission_duplicate_flags
  for select to authenticated using (
    exists (select 1 from public.sessions s join public.classes c on c.id = s.class_id
            where s.id = session_id and c.teacher_id = auth.uid())
  );

-- ============ 14. STORAGE ============
-- Trước đây anon được insert/select/update/delete trực tiếp trên bucket
-- submissions/presentations/submission-media.
-- Sau file này: mọi upload/download của app đều đi qua signed URL do route
-- server ký bằng service/admin client (route đó bypass RLS), nên khóa hẳn
-- truy cập trực tiếp của anon. Ngoại lệ duy nhất: submission-media là bucket
-- ảnh nhúng trong nội dung rich text — giữ anon SELECT để ảnh hiển thị,
-- nhưng khóa anon INSERT/UPDATE/DELETE (upload ảnh nhúng cũng đi qua route
-- ký signed URL bằng service client).
drop policy if exists presentations_storage_insert on storage.objects;
drop policy if exists presentations_storage_read on storage.objects;
drop policy if exists presentations_storage_update on storage.objects;
drop policy if exists presentations_storage_delete on storage.objects;
drop policy if exists submissions_storage_insert on storage.objects;
drop policy if exists submissions_storage_read on storage.objects;
drop policy if exists submissions_storage_delete on storage.objects;
drop policy if exists submission_media_storage_read on storage.objects;
drop policy if exists submission_media_storage_insert on storage.objects;
drop policy if exists submission_media_storage_update on storage.objects;
drop policy if exists submission_media_storage_delete on storage.objects;

-- GV (authenticated) vẫn đọc trực tiếp file 2 bucket chính (phòng trường hợp
-- có luồng nào đọc trực tiếp thay vì signed URL); anon thì không.
create policy t010_storage_teacher_read on storage.objects
  for select to authenticated using (bucket_id in ('submissions', 'presentations', 'submission-media'));
-- Ảnh nhúng public: ai cũng đọc được (đúng thiết kế bucket này).
create policy t010_storage_media_public_read on storage.objects
  for select to anon using (bucket_id = 'submission-media');

-- ============ CHECKLIST KIỂM TRA NGAY SAU KHI CHẠY ============
-- 1. GV đăng nhập, mở dashboard, mở 1 lớp, mở 1 phiên: thấy đủ lớp/phiên/bài.
-- 2. HS mở link lớp /c/<token>: thấy sảnh lớp, chọn tên, chọn ô/nhóm được.
-- 3. HS nộp bài (ảnh + chữ) rồi nộp lại: bài lưu được, không báo lỗi RLS.
-- 4. GV mở khung chấm: thấy bài + file (signed URL vẫn ký được).
-- 5. Mở trang kết quả của HS: thấy bài/điểm của mình.
-- 6. Upload PPT + xem slide: bình thường.
-- 7. Thử nhanh bằng anon key (curl PostgREST): DELETE 1 dòng submissions phải
--    bị chặn (401/403 hoặc 0 dòng bị xóa), PATCH profiles.plan thành 'pro'
--    phải bị chặn.
-- Nếu bước nào hỏng: chạy supabase-migrations/010_rollback.sql để về lại
-- policy mở cũ, rồi báo lại bước hỏng để sửa policy cho đúng luồng đó.
