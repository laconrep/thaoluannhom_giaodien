// Tự cân điểm tiêu chí barem — thuần số học, chạy tức thì trên trình duyệt.
// Quy tắc: giáo viên sửa 1 khung thì giữ đúng giá trị vừa nhập, các khung còn lại
// co/giãn theo tỉ lệ để tổng luôn đúng thang điểm. Điểm khung khác làm tròn bước 0.5.

const STEP = 0.5

const round2 = (v: number) => Math.round(v * 100) / 100
const snap = (v: number) => round2(Math.round(v / STEP) * STEP)
const nonNeg = (v: number) => Math.max(0, Number.isFinite(v) ? v : 0)

/** Dồn phần lệch tổng vào 1 khung (lớn nhất, trừ khung vừa sửa) để tổng khớp tuyệt đối. */
function fixDrift(out: number[], protectedIndex: number, maxScore: number) {
  const drift = round2(maxScore - out.reduce((s, p) => s + p, 0))
  if (Math.abs(drift) < 1e-9) return
  const order = out
    .map((p, j) => j)
    .filter((j) => j !== protectedIndex)
    .sort((a, b) => out[b] - out[a])
  for (const j of order) {
    const cand = round2(out[j] + drift)
    if (cand >= 0) {
      out[j] = cand
      return
    }
  }
  // Không dồn được (hiếm) — để nguyên, validation lúc lưu sẽ bắt.
}

/**
 * Sửa điểm khung `index` thành `rawValue`.
 * Giữ đúng giá trị giáo viên nhập; các khung khác điều chỉnh theo tỉ lệ.
 */
export function rebalanceOnEdit(
  points: number[],
  index: number,
  rawValue: number,
  maxScore: number,
): number[] {
  const n = points.length
  if (n === 0) return []
  const value = Math.min(maxScore, nonNeg(rawValue))
  if (n === 1) return [maxScore] // 1 tiêu chí duy nhất thì điểm phải bằng thang điểm
  const cur = points.map(nonNeg)
  const rest = cur.reduce((s, p, j) => (j === index ? s : s + p), 0)
  const delta = value - cur[index] // >0: khung i tăng → các khung khác giảm
  const out = [...cur]
  out[index] = value
  if (rest <= 0) {
    // Các khung khác đang 0đ: chia đều phần điểm được nhả ra (khi giáo viên giảm điểm khung i)
    const others = n - 1
    const share = delta < 0 ? snap(-delta / others) : 0
    for (let j = 0; j < n; j++) if (j !== index) out[j] = share
  } else {
    for (let j = 0; j < n; j++) {
      if (j === index) continue
      out[j] = snap(Math.max(0, cur[j] - delta * (cur[j] / rest)))
    }
  }
  fixDrift(out, index, maxScore)
  return out
}

/** Xóa khung `removedIndex`: điểm của nó chia đều theo tỉ lệ cho các khung còn lại. */
export function rebalanceOnRemove(
  points: number[],
  removedIndex: number,
  maxScore: number,
): number[] {
  const kept = points.map(nonNeg).filter((_, j) => j !== removedIndex)
  if (kept.length === 0) return []
  const freed = nonNeg(points[removedIndex])
  const rest = kept.reduce((s, p) => s + p, 0)
  let out: number[]
  if (rest <= 0) {
    const share = snap(freed / kept.length)
    out = kept.map(() => share)
  } else {
    out = kept.map((p) => snap(p + freed * (p / rest)))
  }
  fixDrift(out, -1, maxScore)
  return out
}

/** Thêm khung mới (mặc định `defaultPoints` điểm, lấy theo tỉ lệ từ các khung cũ). */
export function rebalanceOnAdd(
  points: number[],
  maxScore: number,
  defaultPoints = 1,
): number[] {
  return rebalanceOnEdit([...points.map(nonNeg), 0], points.length, defaultPoints, maxScore)
}

/** Đổi thang điểm: co/giãn toàn bộ theo tỉ lệ. */
export function rebalanceOnMaxScore(points: number[], newMax: number): number[] {
  const cur = points.map(nonNeg)
  if (cur.length === 0) return []
  const total = cur.reduce((s, p) => s + p, 0)
  let out: number[]
  if (total <= 0) {
    const share = snap(newMax / cur.length)
    out = cur.map(() => share)
  } else {
    out = cur.map((p) => snap((p * newMax) / total))
  }
  fixDrift(out, -1, newMax)
  return out
}
