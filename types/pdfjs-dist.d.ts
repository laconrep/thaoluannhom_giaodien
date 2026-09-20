declare module "pdfjs-dist" {
  export const GlobalWorkerOptions: { workerSrc: string }
  export function getDocument(src: { data: ArrayBuffer }): { promise: Promise<PDFDocumentProxy> }
  export type PDFDocumentProxy = {
    numPages: number
    getPage: (pageNumber: number) => Promise<PDFPageProxy>
  }
  export type PDFPageProxy = {
    getViewport: (params: { scale: number }) => PDFPageViewport
    render: (params: {
      canvasContext: CanvasRenderingContext2D
      viewport: PDFPageViewport
      canvas: HTMLCanvasElement
    }) => { promise: Promise<void> }
  }
  export type PDFPageViewport = {
    width: number
    height: number
  }
}
