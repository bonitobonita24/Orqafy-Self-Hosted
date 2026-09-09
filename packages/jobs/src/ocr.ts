// OCR HTTP client contract. The worker never runs OCR in-process (D-13/R-5): it
// POSTs bytes to a self-hosted OCR sidecar and receives extracted text. Task 2
// implements `createOcrClient`; this interface is the seam the processor depends on.

/** Text extracted from one document by the OCR sidecar. */
export interface OcrExtraction {
  text: string;
  /** Which engine produced it (diagnostics); e.g. 'rapidocr'. */
  engine: string;
  /** Page count the sidecar processed (PDFs rasterize to N pages). */
  pages: number;
}

/** The single OCR port the `ocr` processor depends on. */
export interface OcrClient {
  /** OCR one object's bytes. `contentType` lets the sidecar branch image vs PDF. */
  extract(input: { body: Uint8Array; contentType: string; filename: string }): Promise<OcrExtraction>;
}
