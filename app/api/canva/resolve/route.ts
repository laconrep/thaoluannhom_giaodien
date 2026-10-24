import { NextRequest, NextResponse } from "next/server"
import { buildCanvaEmbedUrl, isCanvaUrl } from "@/lib/canva"

// Đổi link Canva HS dán (thường là link rút gọn canva.link/...) thành URL
// nhúng chuẩn để hiện trong khung chấm. Server phải resolve chuyển hướng
// vì trình duyệt bị CORS, không tự đọc được URL đích.
// Chống SSRF: chỉ cho phép host Canva ở cả link gốc lẫn đích chuyển hướng.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { url?: string }
    const url = typeof body.url === "string" ? body.url.trim() : ""
    if (!url || !isCanvaUrl(url)) {
      return NextResponse.json(
        { error: "Link không phải Canva." },
        { status: 400 },
      )
    }

    const res = await fetch(url, {
      redirect: "follow",
      // Bảo mật 24/10/2026: không để server lạ treo function (DoS nhẹ).
      signal: AbortSignal.timeout(10000),
      headers: {
        // Canva trả nội dung khác cho bot — dùng UA trình duyệt thường.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      },
    })
    const resolvedUrl = res.url || url
    if (!isCanvaUrl(resolvedUrl)) {
      return NextResponse.json(
        { error: "Link chuyển hướng ra ngoài Canva." },
        { status: 502 },
      )
    }

    const embedUrl = buildCanvaEmbedUrl(resolvedUrl) ?? resolvedUrl
    return NextResponse.json({ ok: true, resolvedUrl, embedUrl })
  } catch (e: any) {
    return NextResponse.json(
      { error: `Không mở được link Canva: ${e?.message ?? "lỗi không xác định"}` },
      { status: 502 },
    )
  }
}
