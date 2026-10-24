/**
 * Cảnh báo trùng bài cho phiên cá nhân — CHỈ cảnh báo, không chặn, không trừ
 * điểm. Chạy ngay lúc HS nộp bài (trong submitIndividualReportAction), sau
 * khi dòng submissions đã lưu xong.
 *
 * Cách so (chỉ trong cùng phiên, chỉ các ô cá nhân khác):
 *  - Nội dung chữ: chuẩn hoá text_content rồi so tuyệt đối — giống hệt thì
 *    gắn cờ kind='text', similarity=100.
 *  - Ảnh: so aHash kèm theo file (tính phía client lúc nộp) — giống từ
 *    DUPLICATE_IMAGE_THRESHOLD trở lên thì gắn cờ kind='image'.
 *
 * Cờ ghi vào bảng submission_duplicate_flags (migration 009). Hàm này KHÔNG
 * BAO GIỜ throw: chưa chạy migration, thiếu quyền hay lỗi gì cũng chỉ bỏ
 * qua — bài nộp của HS không được phép hỏng vì tính năng cảnh báo.
 */
import { isMissingSchemaError } from "@/lib/ai/schema-error"
import {
  DUPLICATE_IMAGE_THRESHOLD,
  hashSimilarity,
  normalizeSubmissionText,
} from "@/lib/image-hash"
import type { SubmissionFile } from "@/lib/types"

type SupabaseLike = {
  from: (table: string) => any
}

type OtherSub = {
  id: string
  session_slot_id: string | null
  text_content: string | null
  files: SubmissionFile[] | null
}

export async function refreshIndividualDuplicateFlags(
  supabase: SupabaseLike,
  args: {
    sessionId: string
    slotId: string
    submissionId: string
    textContent: string | null
    files: SubmissionFile[]
  },
): Promise<void> {
  try {
    const { data: others, error } = await supabase
      .from("submissions")
      .select("id, session_slot_id, text_content, files")
      .eq("session_id", args.sessionId)
      .not("session_slot_id", "is", null)
      .neq("session_slot_id", args.slotId)
    if (error || !Array.isArray(others)) return

    const newText = normalizeSubmissionText(args.textContent)
    const newHashes = (args.files ?? []).filter(
      (f): f is SubmissionFile & { hash: string } =>
        f?.kind === "image" && typeof (f as SubmissionFile).hash === "string",
    )

    const flags: {
      session_id: string
      submission_id: string
      matched_submission_id: string
      matched_slot_id: string
      kind: "text" | "image"
      similarity: number
    }[] = []

    for (const other of others as OtherSub[]) {
      if (!other?.id || !other.session_slot_id) continue
      let best: { kind: "text" | "image"; similarity: number } | null = null

      // 1. Nội dung chữ giống hệt (đã chuẩn hoá).
      const otherText = normalizeSubmissionText(other.text_content)
      if (newText && otherText && newText === otherText) {
        best = { kind: "text", similarity: 100 }
      }

      // 2. Ảnh giống nhau (cùng tờ giấy chụp lại).
      if (best?.similarity !== 100 && newHashes.length > 0 && Array.isArray(other.files)) {
        for (const of of other.files) {
          if (of?.kind !== "image" || typeof of.hash !== "string") continue
          for (const nf of newHashes) {
            const sim = hashSimilarity(nf.hash, of.hash)
            if (sim !== null && sim >= DUPLICATE_IMAGE_THRESHOLD) {
              if (!best || sim > best.similarity) best = { kind: "image", similarity: sim }
            }
          }
        }
      }

      if (best) {
        flags.push({
          session_id: args.sessionId,
          submission_id: args.submissionId,
          matched_submission_id: other.id,
          matched_slot_id: other.session_slot_id,
          kind: best.kind,
          similarity: best.similarity,
        })
      }
    }

    // Nộp lại → làm mới cờ (bài cũ có thể đã khác).
    const { error: delError } = await supabase
      .from("submission_duplicate_flags")
      .delete()
      .eq("submission_id", args.submissionId)
    if (delError && !isMissingSchemaError(delError)) return
    if (flags.length > 0) {
      const { error: insError } = await supabase
        .from("submission_duplicate_flags")
        .insert(flags)
      if (insError && !isMissingSchemaError(insError)) return
    }
  } catch {
    // Cảnh báo không được làm hỏng bài nộp — nuốt mọi lỗi.
  }
}
