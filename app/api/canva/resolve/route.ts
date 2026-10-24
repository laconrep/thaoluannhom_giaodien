import { NextRequest, NextResponse } from "next/server"
import { buildCanvaEmbedUrl, isCanvaUrl } from "@/lib/canva"
import { checkApiRateLimit } from "@/lib/rate-limit"

// Đổi link Canva HS dán (thường là link rút gọn canva.link/...) thành URL
// nhúng chuẩn để hiện trong khung chấm. Server phải resolve chuyển hướng
// vì trình duyệt bị CORS, không tự đọc được URL đích.
//
// Chống SSRF (24/10/2026, GĐ4): đi từng hop chuyển hướng BẰNG TAY và kiểm
// tra MỖI hop đều là https + host Canva. Bản cũ dùng redirect:"follow" và
// chỉ kiểm tra URL cuối — hop trung gian trỏ vào IP nội bộ vẫn bị server
// gọi (blind SSRF) trước khi tới đích.
const CANVA_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

export async function POST(request: NextRequest) {
  if (!checkApiRateLimit(request)) {
    return NextResponse.json(
      { error: "Gửi quá nhiều yêu cầu, thử lại sau." },
      { status: 429 },
    )
  }
  try {
    const body = (await request.json().catch(() => ({}))) as { url?: string }
    const url = typeof body.url === "string" ? body.url.trim() : ""
    if (!url || !isCanvaUrl(url)) {
      return NextResponse.json(
        { error: "Link không phải Canva." },
        { status: 400 },
      )
    }

    let current = url
    for (let hop = 0; hop < 5; hop++) {
      const res = await fetch(current, {
        redirect: "manual",
        // Bảo mật 24/10/2026: không để server lạ treo function (DoS nhẹ).
        signal: AbortSignal.timeout(10000),
        headers: {
          // Canva trả nội dung khác cho bot — dùng UA trình duyệt thường.
          "User-Agent": CANVA_UA,
        },
      })
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location")
        if (!loc) {
          return NextResponse.json(
            { error: "Link chuyển hướng không hợp lệ." },
            { status: 502 },
          )
        }
        const next = new URL(loc, current)
        if (next.protocol !== "https:" || !isCanvaUrl(next.toString())) {
          return NextResponse.json(
            { error: "Link chuyển hướng ra ngoài Canva." },
            { status: 502 },
          )
        }
        current = next.toString()
        continue
      }
      const resolvedUrl = current
      const embedUrl = buildCanvaEmbedUrl(resolvedUrl) ?? resolvedUrl
      return NextResponse.json({ ok: true, resolvedUrl, embedUrl })
    }
    return NextResponse.json(
      { error: "Link chuyển hướng quá nhiều lần." },
      { status: 502 },
    )
  } catch {
    return NextResponse.json(
      { error: "Không mở được link Canva." },
      { status: 502 },
    )
  }
}
