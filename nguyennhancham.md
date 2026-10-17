# Nguyên nhân làm chậm web app

Ghi chú kỹ thuật về các điểm làm chậm tốc độ sử dụng (thời gian mở trang, thời gian phản hồi, tải DB) của app "Lớp học thảo luận".

Lưu ý: đây là các nguyên nhân **runtime**, không phải vấn đề "monolith" hay độ dài file. Monolith một deploy thường nhanh hơn tách service vì không có hop mạng giữa các service.

Thứ tự dưới đây xếp theo mức ảnh hưởng thực tế.

---

## 1. Nhiều round-trip tới Supabase cho mỗi lần chuyển trang

**Mức độ: cao**

Mỗi lần mở một tab lớp học đang tốn 3-4 vòng mạng tới Supabase:

- `middleware.ts` gọi `updateSession()` → `supabase.auth.getUser()` cho mọi route (trừ static/api).
- `app/classes/[id]/layout.tsx` gọi `getUser()` thêm một lần nữa.
- Page gọi query dữ liệu, sau đó nhiều query phụ tiếp theo.
- `lib/supabase/server.ts` không cache client, mỗi lần gọi `createClient()` tạo client mới, nên `getUser()` là một HTTP request thật, không được dedupe trong cùng request.

Ước tính: 3-4 RTT × 80-250ms (tuỳ region Vercel và Supabase) = **0.3-1s chỉ để mở một trang**, trước khi render xong.

Hướng xử lý:

- Bọc `getUser()` bằng `React.cache()` để dedupe trong một request.
- Bỏ lần `getUser()` trùng ở layout nếu middleware đã xác thực, hoặc ngược lại.
- Cân nhắc chỉ đọc session/JWT ở tầng page thay vì gọi mạng ở cả middleware và layout.

---

## 2. Polling 5 giây × 3 query, chạy song song với Realtime

**Mức độ: cao (khi cả lớp cùng vào)**

- `app/classes/[id]/roster/roster-view.tsx:215` — `setInterval(..., 5000)` gọi `refreshStudents()`, `refreshGroups()`, `refreshMembers()`.
- `app/c/[token]/class-lobby.tsx:194` — cùng pattern, cùng chu kỳ 5s.

Đây là fallback cho Realtime, nhưng đang chạy **luôn luôn**, không phân biệt Realtime còn sống hay không, và không phân biệt tab đang ẩn.

Hệ quả: một lớp 40 học sinh mở lobby = 40 tab × 3 query/5s = **khoảng 24 query/giây** đập vào Supabase, liên tục trong suốt buổi học. Chính tải này làm chậm mọi người, đặc biệt lúc giáo viên vừa mở màn phân nhóm hoặc màn chiếu.

Hướng xử lý:

- Chỉ polling khi Realtime đã fail hoặc quá 10-15s không nhận event (pattern đã dùng đúng ở `components/ai-grade-panel.tsx:154-160`).
- Tăng chu kỳ lên 30-60s.
- Dừng khi `document.hidden` (tab bị ẩn).
- Hoặc bỏ hẳn polling nếu đã tin Realtime, chỉ giữ refresh khi focus lại tab.

---

## 3. Payload trang phiên quá lớn do `select("*")`

**Mức độ: cao (mạng lớp học, 4G/3G)**

- `app/classes/[id]/sessions/[sid]/page.tsx:49-50` tải **toàn bộ** `submissions` và `annotations` của phiên.
- `app/classes/[id]/individual/[sid]/page.tsx:44-48` tương tự.
- `app/c/[token]/session/[sid]/results/page.tsx` có 5 lời gọi `select("*")`.
- `annotations.data` chứa toàn bộ nét vẽ, toạ độ, highlight, stamp của từng bài.
- `submissions` chứa `text_content` (HTML có thể kèm link ảnh) và `files`.

Với 8 nhóm có vẽ tay và bài nộp dài, payload RSC có thể lên vài trăm KB đến vài MB mỗi lần mở phiên. Đây là độ trễ cảm nhận rõ nhất khi giáo viên mở màn chiếu.

Hướng xử lý:

- Chọn đúng cột cần thiết thay vì `select("*")`.
- Tách annotation khỏi payload ban đầu; chỉ tải khi giáo viên mở một nhóm cụ thể (lazy load theo `session_group_id`).
- Với danh sách, chỉ lấy metadata (id, nhóm, thời gian nộp, trạng thái), không lấy `text_content`/`data`.

---

## 4. Không có cache phía server

**Mức độ: trung bình-cao**

Vì dùng cookie auth, gần như mọi trang là dynamic, không có ISR và không có `fetch` cache. Chuyển qua lại giữa "Danh sách & nhóm" và "Thảo luận nhóm" là query lại toàn bộ từ đầu.

Các route dynamic cũng khó được `next/link` prefetch hiệu quả, nên cảm giác chuyển tab chậm hơn so với app tĩnh.

Hướng xử lý:

- Cache ngắn hạn các dữ liệu ít đổi (danh sách lớp, tên lớp, share token) bằng `unstable_cache`/`revalidateTag`, invalidate khi có mutation.
- Giữ realtime cho dữ liệu thay đổi nhanh, cache cho dữ liệu nền.

---

## 5. Bundle tải dư ở client

**Mức độ: trung bình**

Các thư viện nặng đang được import tĩnh vào client component, tải ngay cả khi người dùng không dùng tới:

- `app/classes/[id]/roster/roster-view.tsx:52` — `import * as XLSX from "xlsx"` (dùng cho import/export Excel, chỉ cần khi bấm nút).
- `components/annotation-editor.tsx:18` — `import { renderAsync } from "docx-preview"` (chỉ cần khi mở file Word).
- `qrcode.react` import tĩnh ở `components/presentation-viewer.tsx`, `app/classes/[id]/share/share-view.tsx`, `app/classes/[id]/sessions/[sid]/group-board.tsx` (chỉ cần khi mở QR).

Hướng xử lý: chuyển sang `dynamic import` hoặc `next/dynamic` cho XLSX, docx-preview và QR. Đây là thay đổi nhỏ, hiệu quả thấy ngay ở lần tải đầu trang phân nhóm.

Ghi chú: `public/pdf.worker.min.mjs` nặng 1.3MB nhưng chỉ tải khi thực sự đọc PDF, nên chấp nhận được.

---

## 6. Ảnh bài nộp không được tối ưu

**Mức độ: trung bình**

Có nhiều chỗ dùng thẻ `<img>` trực tiếp (đang tồn tại dưới dạng warning trong `eslint`). Ảnh chụp bài nộp và ảnh chèn trong bài viết được tải nguyên kích thước, không resize, không chuyển AVIF/WebP.

Trên mạng lớp học hoặc 4G yếu, đây thường là phần chậm nhất của trang chấm bài.

Hướng xử lý:

- Dùng `next/image` cho ảnh hiển thị (đã có `remotePatterns` cho `*.supabase.co` trong `next.config.mjs`).
- Hoặc tạo ảnh thumbnail khi upload, chỉ tải bản đầy đủ khi phóng to.
- Với ảnh chèn trong bài nộp, giới hạn kích thước hiển thị và dùng `loading="lazy"`.

---

## 7. Chấm AI chạy tuần tự, có vòng quét lặp

**Mức độ: trung bình (chỉ ảnh hưởng tính năng chấm AI)**

- `lib/ai/run-grade-job.ts` chấm từng bài một, tuần tự.
- Tối đa 6 vòng quét (`MAX_SWEEPS = 6`), mỗi vòng nghỉ 1 giây (`SWEEP_GAP_MS = 1000`).
- Mỗi bài còn phải tải ảnh, resize bằng `sharp`, gọi API AI.

Với 30 bài × 3-8s/bài, thời gian hoàn tất thường **1.5-4 phút**. Đây là thiết kế (an toàn, tránh rate limit), không phải bug, nhưng người dùng cảm nhận là chậm.

Ngoài ra `listGradedSamplesAction` trong `app/ai-grade-actions.ts` có N+1 query: mỗi bài mẫu lại query thêm `session_groups`/`session_slots` và `submissions`.

Hướng xử lý:

- Chấm song song có giới hạn (ví dụ 3-5 bài cùng lúc) thay vì tuần tự.
- Gộp query N+1 thành một query kèm join hoặc `in(...)`.
- Hiển thị tiến độ rõ ràng (đã có) và cho phép chấm lại một bài (đã có) để giáo viên không phải chờ cả job.

---

## 8. Client Supabase không được cache

**Mức độ: thấp**

`lib/supabase/server.ts` tạo client mới mỗi lần gọi. Bản browser (`lib/supabase/client.ts`) đã cache đúng, bản server thì chưa.

Ảnh hưởng chủ yếu là nhân thêm chi phí cho `getUser()` như mục 1, không phải nguyên nhân độc lập.

---

## Những thứ KHÔNG phải nguyên nhân chậm

Để tránh tối ưu sai chỗ:

- `app/actions.ts` dài 1.335 dòng: ảnh hưởng tốc độ đọc code và review, không ảnh hưởng runtime.
- Các component 1.000+ dòng (`roster-view.tsx`, `group-board.tsx`, `annotation-editor.tsx`): vấn đề bảo trì, không phải hiệu năng.
- Kiến trúc monolith một deploy: không có network hop giữa các service, thường nhanh hơn microservice.
- RLS kiểu public-all: ảnh hưởng bảo mật, không đáng kể tốc độ (các bảng chính đều có index theo `class_id`, `session_id`).
- Trigger SQL (`enforce_single_class_group`, `enforce_leader_in_group`): chi phí nhỏ trên dữ liệu hiện tại.

---

## Thứ tự ưu tiên nếu muốn sửa

1. Bỏ polling 5s khi Realtime còn sống, tăng chu kỳ, dừng khi tab ẩn (mục 2).
2. Dedupe `getUser()` bằng `React.cache()` và bỏ lần gọi trùng ở layout (mục 1).
3. Chọn đúng cột, tách annotation khỏi payload trang phiên (mục 3).
4. `dynamic import` XLSX và docx-preview (mục 5).
5. Dùng `next/image` hoặc thumbnail cho ảnh bài nộp (mục 6).
6. Cache ngắn hạn dữ liệu nền (mục 4).
7. Song song hoá job chấm AI và bỏ N+1 (mục 7).

---

## Cách đo đúng

Đừng đo bằng `npm run dev`: chế độ dev biên dịch theo route, không minify, số liệu sẽ tệ hơn production rất nhiều và không phản ánh đúng nguyên nhân.

Đo trên bản production:

```bash
npm run build
npm run start
```

Sau đó đo bằng Chrome DevTools Performance/Lighthouse, chú ý:

- TTFB (phản ánh mục 1 và 2).
- Thời gian tải chunk (phản ánh mục 5).
- Payload RSC trong tab Network (phản ánh mục 3).
- Số request tới Supabase trong tab Network khi để yên một trang (phản ánh mục 2).
