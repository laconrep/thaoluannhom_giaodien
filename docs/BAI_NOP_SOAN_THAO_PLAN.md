# Kế hoạch: Ô soạn thảo bài nộp kiểu Word (bảng + ảnh)

> File này là **bàn giao giữa các phiên code**. Phiên sau chỉ cần đọc file này +
> danh sách file được liệt kê trong từng phiên, **không cần đọc lại toàn bộ repo**.
> Sau mỗi phiên: cập nhật mục [Nhật ký tiến độ](#nhật-ký-tiến-độ), rồi commit + push.

## 1. Mục tiêu

- Ô "Văn bản" khi học sinh nộp bài hiện là `<textarea>` thuần, chỉ gõ chữ.
- Cần nâng thành trình soạn thảo kiểu Word:
  - **Kẻ bảng / lập bảng so sánh** (thêm/xoá hàng, cột).
  - **Chèn ảnh** ngay trong bài viết.
  - Kèm các định dạng cơ bản: đậm/nghiêng/gạch chân, tiêu đề, danh sách, hoàn tác.
- Giáo viên và các màn xem kết quả phải hiển thị đúng nội dung có bảng + ảnh.

## 2. Quyết định đã chốt (không cần hỏi lại)

| # | Vấn đề | Quyết định |
|---|--------|-----------|
| 1 | Ảnh chèn trong bài lưu ở đâu | **Bucket public riêng** `submission-media` (link bền, không hết hạn) |
| 2 | Chèn ảnh khi GV tắt "cho dán" | **Vẫn cho chèn ảnh bằng nút**; chỉ chặn dán chữ/nội dung |
| 3 | Thư viện | **Chấp nhận thêm Tiptap** + `isomorphic-dompurify` |
| 4 | Phạm vi | **Cả 2**: ô soạn của học sinh **và** mọi nơi render `text_content` |

## 3. Kiến trúc chốt

- Nội dung bài viết lưu dạng **HTML có sanitize** vào cột `submissions.text_content`
  (cột đang là `text`, **không cần đổi schema**).
- Bài cũ là plain text → renderer phải **tương thích ngược** (không có thẻ HTML thì
  hiển thị `whitespace-pre-wrap` như hiện tại).
- Ảnh chèn: upload lên bucket public `submission-media` qua signed-URL, rồi nhúng
  URL công khai vào HTML. **Không nhúng base64** (phình DB, nặng autosave).
- Sanitize ở **cả 2 đầu**: server action khi lưu, và component render (chống XSS
  vì nội dung học sinh hiện lên màn giáo viên và trang kết quả).

### 3.1. Thư viện cần cài

```bash
# Bắt buộc cài global-theo-quy-ước không áp dụng cho dependency dự án; dùng npm tại repo
npm install --save --legacy-peer-deps \
  @tiptap/react @tiptap/pm @tiptap/starter-kit \
  @tiptap/extension-table @tiptap/extension-table-row \
  @tiptap/extension-table-cell @tiptap/extension-table-header \
  @tiptap/extension-image @tiptap/extension-placeholder \
  @tiptap/extension-underline isomorphic-dompurify
```

Lưu ý môi trường: `pnpm` trong máy này lỗi (`corepack` thiếu module), dùng
`npm install --legacy-peer-deps` như trên. `node_modules` có thể chưa có → cài trước khi
typecheck/build.

## 4. Bản đồ file liên quan

| Vai trò | File | Ghi chú |
|---------|------|---------|
| Ô soạn của HS | `app/c/[token]/session/[sid]/student-submit.tsx` | `text` state dòng ~123; `<Textarea>` dòng ~601-624; `handleSubmit` ~349-385; auto-submit ~387-393 |
| Lưu bài (server) | `app/actions.ts` | `submitGroupReportAction` ~1181; `submitIndividualReportAction` ~1229 |
| Bucket hiện có | `app/api/submissions/upload-url/route.ts`, `signed-url/route.ts` | bucket private `submissions`, signed URL 7 ngày |
| Nâng hạn bucket | `app/api/storage/ensure-bucket/route.ts` | logic cho `presentations`/`submissions` |
| Mẫu policy storage | `scripts/030_create_presentation_bucket.sql` | copy pattern tạo bucket + policy |
| Schema | `scripts/000_schema.sql:138` | `submissions(text_content text, files jsonb)` |
| Kiểu dữ liệu | `lib/types.ts:97` | `text_content: string \| null` |
| Render (GV board) | `app/classes/[id]/sessions/[sid]/group-board.tsx:1088` | `whitespace-pre-wrap` |
| Render (thẻ nhóm) | `components/group-card.tsx:69` (`hasContent`), `:160` | |
| Render (cá nhân) | `app/classes/[id]/individual/[sid]/individual-board.tsx:291`, `:313` | |
| Render (kết quả HS) | `app/c/[token]/session/[sid]/results/results-viewer.tsx:156` | |
| Render (chấm bài) | `components/annotation-editor.tsx:934` | |
| CSS toàn cục | `app/globals.css` | thêm class `.submission-rich-text` (Tailwind v4, không có typography plugin) |

## 5. Chia 4 phiên code

> Mỗi phiên: code → chạy kiểm chứng → cập nhật Nhật ký tiến độ → commit + push lên
> **cùng một nhánh** `260915-feat-submission-rich-text-editor`.

### Phiên 1 — Nền tảng (deps + sanitize + renderer + bucket ảnh)

Phạm vi:
1. Cài thư viện ở mục 3.1.
2. Tạo `lib/rich-text.ts`:
   - `isRichTextEmpty(html)` — coi `<p></p>`, khoảng trắng là rỗng.
   - `sanitizeSubmissionHtml(html)` — dùng `isomorphic-dompurify`, whitelist thẻ
     `p,br,strong,em,u,s,h1-h3,ul,ol,li,blockquote,table,thead,tbody,tr,th,td,img,a,span,code,pre`
     và thuộc tính cần thiết (`href`, `src`, `alt`, `colspan`, `rowspan`, `class`).
   - `plainTextToHtml(text)` và `submissionToRenderableHtml(raw)` — nhận biết bài cũ
     (không có thẻ HTML) để bọc thành `<p>` giữ xuống dòng, tránh vỡ bài đã nộp.
   - `htmlToPlainText(html)` — cho chỗ cần trích đoạn ngắn.
3. Tạo `components/submission-text.tsx` (client): nhận `value`, `className`, `truncate?`;
   sanitize rồi `dangerouslySetInnerHTML`; bọc class `submission-rich-text`.
4. Thêm style `.submission-rich-text` trong `app/globals.css`: bảng có viền, ảnh
   `max-width:100%`, heading/list, giữ tương thích dark mode.
5. Bucket ảnh public:
   - `scripts/100_submission_media_bucket.sql`: tạo bucket `submission-media` public +
     policy `select` cho mọi người, `insert/update/delete` như pattern
     `scripts/030_create_presentation_bucket.sql`. Cập nhật `scripts/one-click-supabase.sql`.
   - `app/api/submissions/inline-image-upload-url/route.ts`: POST `{ path }` →
     `createSignedUploadUrl` trên `submission-media`, trả thêm `publicUrl`.
6. (Tùy chọn) mở rộng `app/api/storage/ensure-bucket/route.ts` cho bucket mới.

Kiểm chứng: `npx tsc --noEmit`, `npx eslint <file đổi>`, `npm run build`.
Commit: `feat(submission): add rich text foundation and public media bucket`.

### Phiên 2 — Component editor (Tiptap)

Phạm vi:
1. Tạo `components/rich-text-editor.tsx` (client):
   - Props: `value: string`, `onChange(html)`, `disabled?`, `allowPaste: boolean`, `placeholder?`.
   - Toolbar: đậm, nghiêng, gạch chân, gạch ngang, H1/H2/H3, danh sách chấm/gạch đầu dòng,
     **chèn bảng** + thêm/xoá hàng/cột, **chèn ảnh**, hoàn tác/làm lại.
   - Chèn ảnh: mở file picker → upload qua `/api/submissions/inline-image-upload-url`
     → `editor.chain().focus().setImage({ src: publicUrl })`.
   - `allowPaste=false`: chặn `paste` chứa nội dung (giữ luật hiện tại); **nút chèn ảnh
     vẫn hoạt động**.
   - `onUpdate` đẩy HTML ra ngoài; tránh vòng lặp set lại `value` khi không đổi.
2. Đảm bảo không rò rỉ listener khi unmount.

Kiểm chứng: `tsc`, `eslint`, `npm run build`.
Commit: `feat(submission): add tiptap rich text editor component`.

### Phiên 3 — Gắn vào ô nộp bài của học sinh

Phạm vi: `app/c/[token]/session/[sid]/student-submit.tsx`
1. Thay `<Textarea>` (dòng ~601-624) bằng `<RichTextEditor allowPaste={allowPaste} ... />`.
2. `text` state giữ nguyên tên nhưng chứa HTML:
   - `handleSubmit`: `textContent: isRichTextEmpty(text) ? null : text` (bỏ `text.trim()`).
   - auto-submit (~387-393): thay `!text.trim()` bằng `!isRichTextEmpty(text)`.
   - `submitted` summary (~402) không cần đổi.
3. Giữ cỡ chữ lớn khi soạn (min-height ~ 70vh, `font-size: 18px`) để hợp màn chiếu.
4. `app/actions.ts`: sanitize `textContent` trước khi lưu trong cả 2 action
   (`submitGroupReportAction`, `submitIndividualReportAction`).

Kiểm chứng: `tsc`, `eslint`, `npm run build`; thử tay: gõ chữ, chèn bảng, chèn ảnh,
nộp bài, tải lại xem còn nội dung.
Commit: `feat(submission): use rich text editor in student submit`.

### Phiên 4 — Render ở mọi nơi (giáo viên + kết quả)

Phạm vi: thay chỗ in `text_content` thuần bằng `<SubmissionText />`
1. `components/group-card.tsx:69` (`hasContent`) và `:160`.
2. `app/classes/[id]/individual/[sid]/individual-board.tsx:291`, `:313`.
3. `app/classes/[id]/sessions/[sid]/group-board.tsx:1088`.
4. `app/c/[token]/session/[sid]/results/results-viewer.tsx:156`.
5. `components/annotation-editor.tsx:934` (nhánh text khi chiếu/chấm).
6. `annotation-editor.tsx:313`-tương tự trong `group-board.tsx:890` chỉ truyền
   `textContent` xuống editor — kiểm tra editor đã render HTML đúng.
7. Giữ `truncate` cho các chỗ hiển thị nhỏ (thẻ nhóm, thumbnail) để không vỡ layout.

Kiểm chứng: `tsc`, `eslint`, `npm run build`; test tay có bảng + ảnh ở: màn chiếu GV,
thẻ nhóm, view cá nhân, trang kết quả HS, màn chấm bài.
Commit: `feat(submission): render rich text in teacher and results views`.

## 6. Kiểm chứng chung (chạy trước mỗi commit)

```bash
# Cài dependency nếu chưa có node_modules
npm install --no-package-lock --no-audit --no-fund --legacy-peer-deps

# Typecheck
npx tsc --noEmit

# Lint các file vừa đổi
npx eslint <danh-sach-file>

# Build
npm run build
```

## 7. Triển khai (deploy) — nhắc lại cho phiên cuối

1. Chạy `scripts/100_submission_media_bucket.sql` trong Supabase SQL Editor (tạo bucket
   public + policy). Nếu chưa chạy, chèn ảnh sẽ lỗi upload.
2. Không cần migration cho `text_content` (đã là `text`).

## 8. Rủi ro / lưu ý

- **Tương thích ngược**: bài đã nộp là plain text. Nếu render thẳng HTML sẽ mất xuống
  dòng → bắt buộc dùng `submissionToRenderableHtml()`.
- **XSS**: không được render HTML thô; luôn qua `sanitizeSubmissionHtml()`.
- **Autosave/auto-submit**: đổi điều kiện "rỗng" phải dùng `isRichTextEmpty()`, nếu không
  bài chỉ có bảng/ảnh sẽ bị coi là rỗng.
- **Ảnh trong bài cũ** (tab Tệp/Ảnh) vẫn dùng signed URL 7 ngày — **không thuộc phạm vi**
  lần này, không sửa.
- **Giới hạn kích thước ảnh chèn**: nên chặn > ~5 MB và nén phía client nếu tiện (ghi nhận,
  có thể làm ở phiên 2 nếu còn thời gian).

## 9. Nhật ký tiến độ

> Cập nhật sau mỗi phiên. Đánh dấu `[x]` khi xong, ghi rõ commit hash + việc còn dở.

### Trạng thái tổng

| Phiên | Nội dung | Trạng thái | Commit |
|-------|----------|-----------|--------|
| 1 | Nền tảng: deps, sanitize, renderer, bucket ảnh | CHƯA LÀM | — |
| 2 | Component editor Tiptap | CHƯA LÀM | — |
| 3 | Gắn vào ô nộp bài học sinh | CHƯA LÀM | — |
| 4 | Render ở màn giáo viên + kết quả | CHƯA LÀM | — |

### Chi tiết từng phiên

#### Phiên 1 — Nền tảng
- [ ] Cài Tiptap + isomorphic-dompurify
- [ ] `lib/rich-text.ts` (isRichTextEmpty, sanitize, plainTextToHtml, submissionToRenderableHtml, htmlToPlainText)
- [ ] `components/submission-text.tsx`
- [ ] Style `.submission-rich-text` trong `app/globals.css`
- [ ] `scripts/100_submission_media_bucket.sql` + cập nhật `one-click-supabase.sql`
- [ ] `app/api/submissions/inline-image-upload-url/route.ts`
- [ ] Chạy tsc/eslint/build
- [ ] Commit + push
- Ghi chú: —

#### Phiên 2 — Editor
- [ ] `components/rich-text-editor.tsx` (toolbar, bảng, ảnh, allowPaste, placeholder)
- [ ] Chặn dán nội dung khi `allowPaste=false`, vẫn cho chèn ảnh
- [ ] Chạy tsc/eslint/build
- [ ] Commit + push
- Ghi chú: —

#### Phiên 3 — Ô nộp bài HS
- [ ] Thay Textarea bằng RichTextEditor
- [ ] Đổi điều kiện rỗng sang `isRichTextEmpty`
- [ ] Sanitize trong 2 server action ở `app/actions.ts`
- [ ] Chạy tsc/eslint/build + test tay
- [ ] Commit + push
- Ghi chú: —

#### Phiên 4 — Render toàn bộ
- [ ] `group-card.tsx`, `individual-board.tsx`, `group-board.tsx`, `results-viewer.tsx`, `annotation-editor.tsx`
- [ ] Chạy tsc/eslint/build + test tay có bảng/ảnh
- [ ] Commit + push
- Ghi chú: —

## 10. Quy ước git

- Nhánh dùng chung: `260915-feat-submission-rich-text-editor` (tạo từ `origin/main`).
- Mỗi phiên commit 1 lần với message ở trên, push lên cùng nhánh (PR tự gộp).
- Không commit file rác `lib/ensure-presentations-bucket.ts` (leftover, không liên quan).
