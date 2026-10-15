// Khai báo types tối thiểu cho mammoth (package không bundle types).
declare module "mammoth" {
  export function convertToHtml(
    input: { arrayBuffer: ArrayBuffer },
    options?: unknown,
  ): Promise<{ value: string; messages: unknown[] }>
  export function extractRawText(
    input: { arrayBuffer: ArrayBuffer },
    options?: unknown,
  ): Promise<{ value: string; messages: unknown[] }>
}
