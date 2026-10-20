export type ClassRow = {
  id: string
  teacher_id: string
  name: string
  capacity: number
  share_token: string
  created_at: string
}

export type StudentRow = {
  id: string
  class_id: string
  slot_number: number
  name: string | null
  device_token: string | null
  created_at: string
}

export type ClassGroupRow = {
  id: string
  class_id: string
  group_number: number
  label: string
  name: string
  color: string
  display_order: number
}

export type ClassGroupMember = {
  class_group_id: string
  student_id: string
}

export type SessionKind = "group" | "individual"
export type SessionStatus = "idle" | "running" | "ended"

export type SessionRow = {
  id: string
  class_id: string
  title: string
  kind: SessionKind
  duration_seconds: number
  started_at: string | null
  ends_at: string | null
  status: SessionStatus
  scores_shared: boolean
  allow_paste: boolean
  results_shared_at: string | null
  allow_download: boolean
  use_fixed_groups: boolean
  created_at: string
  ai_enabled?: boolean
  ai_rubric?: string | null
  ai_max_score?: number
}

export type GeminiTier = "free" | "pro"

export type AiGradeJobStatus = "queued" | "running" | "done" | "error"

export type AiGradeResultStatus = "pending" | "ready" | "error" | "approved" | "rejected"

/** Lựa chọn AI lúc bấm chấm: tự động, ép Gemini, ép Muse */
export type AiProviderChoice = "auto" | "gemini"

/** Trạm chấm trong farm (mỗi trạm = một tài khoản Muse riêng) */
export type BackendStationStatus = "active" | "paused"

export type BackendStationRow = {
  id: string
  label: string
  status: BackendStationStatus
  notes: string | null
  created_at: string
}

export type TeacherBackendMapRow = {
  teacher_id: string
  station_id: string
  updated_at: string
}

export type AiBaremRequestStatus = "pending" | "processing" | "done" | "error"

export type AiBaremRequestRow = {
  id: string
  session_id: string
  teacher_id: string
  answer_text: string
  max_score: number
  status: AiBaremRequestStatus
  barem_json: GradingBarem | null
  error_message: string | null
  created_at: string
  finished_at: string | null
}

// Barem chấm mẫu A: tiêu chí có trọng số (lưu JSON trong sessions.ai_rubric)
export type BaremCriterion = {
  name: string
  points: number
  expect: string[]
  notes: string
}

export type GradingBarem = {
  template: "criteria_weighted"
  version: 1
  max_score: number
  criteria: BaremCriterion[]
}

// Bài đã chấm tay — ứng viên làm "bài chấm mẫu" để AI suy barem
export type GradedSample = {
  submissionId: string
  groupLabel: string
  score: number
  textCount: number // số nhận xét chữ
  stampCount: number // số dấu stamp ✓ ★ ⚠ ✗
  hasDrawings: boolean // có nét vẽ/tô/gạch không chữ
}

// Kết quả vòng tự kiểm: AI chấm lại bài mẫu bằng barem vừa suy, so với điểm tay
export type BaremSelfCheck = {
  teacher_score: number
  ai_rescore: number | null
  diff: number | null
  match: boolean // true khi diff != null và diff <= 1
}

// Báo cáo "AI đánh giá tổng thể" (lưu JSON trong ai_eval_requests.result_json)
export type AiEvalRequestStatus = "pending" | "processing" | "done" | "error"

export type AiEvalRequestRow = {
  id: string
  session_id: string
  teacher_id: string
  status: AiEvalRequestStatus
  result_json: EvalReport | null
  error_message: string | null
  created_at: string
  finished_at: string | null
}

export type EvalReportStats = {
  total_submissions: number
  graded: number
  avg: number
  max: number
  min: number
  distribution: { gioi: number; kha: number; trung_binh: number; yeu: number }
}

export type EvalCriterionAvg = {
  name: string
  points: number
  avg: number
}

export type EvalGroupAvg = {
  key: string
  name: string
  avg: number
  count: number
}

export type EvalAttentionItem = {
  key: string
  name: string
  score: number | null
  reason: string
}

export type EvalReport = {
  version: 1
  generated_at: string
  max_score: number
  stats: EvalReportStats
  criteria_avg: EvalCriterionAvg[]
  common_mistakes: string[]
  common_strengths: string[]
  group_avg: EvalGroupAvg[]
  attention_list: EvalAttentionItem[]
  overall_comment: string
}

export type AiGradeJobRow = {
  id: string
  session_id: string
  teacher_id: string
  status: AiGradeJobStatus
  provider: string | null
  total: number
  completed: number
  error_message: string | null
  created_at: string
  finished_at: string | null
}

export type AiGradeResultRow = {
  id: string
  job_id: string
  session_id: string
  session_group_id: string | null
  session_slot_id: string | null
  submission_id: string | null
  ai_score: number | null
  ai_feedback: string | null
  transcript: string | null
  unreadable: boolean
  status: AiGradeResultStatus
  error_message: string | null
  created_at: string
}

export type AnnotationStamp = {
  kind: "stamp"
  label: string // dấu chấm bài, VD "✓" (bản cũ có thể lưu cả tên "✓ Tốt")
  color: string
  x: number
  y: number
  fontSize: number
  fileIndex?: number
  // Chi cho file nhung (PPTX/Canva): so slide/trang ma dau gan vao (mac dinh 1).
  slide?: number
}

export type SessionGroupRow = {
  id: string
  session_id: string
  class_group_id: string | null
  group_number: number
  label: string
  claimed: boolean
  claimed_at: string | null
}

export type SessionSlotRow = {
  id: string
  session_id: string
  slot_number: number
  student_id: string | null
}

export type SubmissionFileKind = "image" | "pdf" | "docx" | "pptx" | "canva" | "other"

export type SubmissionFile = {
  url: string
  name: string
  kind: SubmissionFileKind
  mime: string
  rotation?: number // degrees: 0, 90, 180, 270
}

export type SubmissionRow = {
  id: string
  session_id: string
  session_group_id: string | null
  session_slot_id: string | null
  image_url: string | null
  text_content: string | null
  files: SubmissionFile[]
  submitted_at: string
  is_auto_submitted: boolean
}

export type AnnotationDrawPath = {
  kind: "path"
  color: string
  width: number
  points: { x: number; y: number }[]
  fileIndex?: number
  // Chi cho file nhung (PPTX/Canva): so slide/trang ma dau gan vao (mac dinh 1).
  slide?: number
}
export type AnnotationText = {
  kind: "text"
  color: string
  x: number
  y: number
  text: string
  fontSize: number
  fileIndex?: number
  // Chi cho file nhung (PPTX/Canva): so slide/trang ma dau gan vao (mac dinh 1).
  slide?: number
}
export type AnnotationHighlight = {
  kind: "highlight"
  color: string
  x: number
  y: number
  w: number
  h: number
  fileIndex?: number
  // Chi cho file nhung (PPTX/Canva): so slide/trang ma dau gan vao (mac dinh 1).
  slide?: number
}
export type AnnotationUnderline = {
  kind: "underline"
  color: string
  x1: number
  y1: number
  x2: number
  y2: number
  fileIndex?: number
  // Chi cho file nhung (PPTX/Canva): so slide/trang ma dau gan vao (mac dinh 1).
  slide?: number
}
export type AnnotationItem =
  | AnnotationDrawPath
  | AnnotationText
  | AnnotationHighlight
  | AnnotationUnderline
  | AnnotationStamp

export type AnnotationRow = {
  id: string
  session_id: string
  session_group_id: string | null
  session_slot_id: string | null
  /** Nét vẽ — trang danh sách KHÔNG select cột này (nặng); tải lười khi mở editor. */
  data?: AnnotationItem[]
  score: number | null
  updated_at: string
}

export type StudentScoreRow = {
  id: string
  session_id: string
  student_id: string
  score: number | null
  group_name: string | null
  updated_at: string
}

