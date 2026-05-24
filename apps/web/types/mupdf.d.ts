/**
 * Minimal type shim for the `mupdf` npm package (v1.x WASM build).
 *
 * The package ships ESM-only types that require moduleResolution "bundler" or
 * "node16" to resolve automatically.  Rather than changing the project-wide
 * moduleResolution (which breaks dompurify and other CJS packages), we declare
 * exactly the subset of the API used by lib/pdf-renderer.ts here.
 *
 * If you add new mupdf calls, extend these declarations accordingly.
 */
declare module 'mupdf' {
  class Pixmap {
    asPNG(): Uint8Array
    getWidth(): number
    getHeight(): number
    destroy(): void
  }

  class Page {
    toPixmap(
      matrix: Matrix,
      colorspace: ColorSpace,
      alpha: boolean,
      antialias: boolean,
    ): Pixmap
    destroy(): void
  }

  class Matrix {
    static scale(sx: number, sy: number): Matrix
  }

  class ColorSpace {
    static DeviceRGB: ColorSpace
  }

  class Document {
    static openDocument(data: Uint8Array, mimeType: string): Document
    countPages(): number
    loadPage(index: number): Page
    destroy(): void
  }
}
