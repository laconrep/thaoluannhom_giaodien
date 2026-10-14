import type { GradingParam } from "@/lib/types"

/**
 * Biến rubric lưu trong sessions.ai_rubric thành text đưa vào prompt chấm.
 * - Nếu là JSON param mẫu A (criteria_weighted): render thành danh sách tiêu chí.
 * - Ngược lại: giữ nguyên text cũ (tương thích ngược).
 */
export function formatRubricForPrompt(rubric: string | null | undefined): string {
  if (!rubric || !rubric.trim()) return ""
  const raw = rubric.trim()
  if (raw.startsWith("{")) {
    try {
      const p = JSON.parse(raw) as GradingParam
      if (p && p.template === "criteria_weighted" && Array.isArray(p.criteria)) {
        const lines: string[] = [
          `Tiêu chí chấm (thang ${p.max_score} điểm):`,
        ]
        p.criteria.forEach((c, i) => {
          lines.push(`${i + 1}. ${c.name} — ${c.points} điểm`)
          if (c.expect && c.expect.length > 0) {
            lines.push(`   Ý cần có: ${c.expect.join("; ")}`)
          }
          if (c.notes) lines.push(`   Ghi chú: ${c.notes}`)
        })
        lines.push("Chấm từng tiêu chí, cộng điểm các tiêu chí thành điểm tổng.")
        return lines.join("\n")
      }
    } catch {
      // JSON hỏng → dùng text gốc
    }
  }
  return raw
}

/** Parse rubric JSON mẫu A, trả null nếu không phải. */
export function parseGradingParam(rubric: string | null | undefined): GradingParam | null {
  if (!rubric || !rubric.trim().startsWith("{")) return null
  try {
    const p = JSON.parse(rubric) as GradingParam
    if (p && p.template === "criteria_weighted" && Array.isArray(p.criteria)) return p
  } catch {
    // bỏ qua
  }
  return null
}
