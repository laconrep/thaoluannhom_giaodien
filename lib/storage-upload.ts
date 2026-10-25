export const PRESENTATIONS_BUCKET = "presentations"
export const MAX_PRESENTATION_BYTES = 200 * 1024 * 1024

export function powerpointContentType(fileName: string, fileType?: string): string {
  const type = fileType || ""
  if (
    type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    type === "application/vnd.ms-powerpoint" ||
    type === "application/zip"
  ) {
    return type
  }
  if (/\.ppt$/i.test(fileName) && !/\.pptx$/i.test(fileName)) {
    return "application/vnd.ms-powerpoint"
  }
  return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
}

export function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`
}

export function friendlyStorageError(message: string, fileSize?: number): string {
  if (/exceeded the maximum allowed size/i.test(message) || /maximum allowed size/i.test(message)) {
    const size = fileSize ? ` File đang tải: ${formatMegabytes(fileSize)}.` : ""
    return `File vượt dung lượng tối đa của kho lưu trữ.${size} Hạn mức file bài giảng là 200 MB.`
  }
  if (/mime type/i.test(message) || /not allowed/i.test(message)) {
    return "Kho lưu trữ đang chặn định dạng PowerPoint. Hãy kiểm tra lại cấu hình kho lưu trữ."
  }
  return message
}
