"""Offline OCR sidecar (D-13 / R-5). RapidOCR (PaddleOCR models on ONNX Runtime),
CPU-only, licence-clean. Accepts an image or PDF and returns extracted text.
No cloud, no LLM. Tesseract is the documented fallback engine (swap this service)."""
import hmac
import io
import os

import numpy as np
from fastapi import FastAPI, File, Header, HTTPException, Request, UploadFile
from pdf2image import convert_from_bytes, pdfinfo_from_bytes
from PIL import Image
from rapidocr_onnxruntime import RapidOCR

# Decompression-bomb guard (audit H-4) — PIL defaults to ~89M pixels; cap it
# explicitly so a crafted image can't force an unbounded in-memory decode.
Image.MAX_IMAGE_PIXELS = 64_000_000

app = FastAPI(title="Orqafy OCR sidecar")
engine = RapidOCR()

# Shared-secret auth (audit H-4) — the sidecar has no host port exposure in
# compose, but defense-in-depth requires callers to prove they hold the
# secret the worker (packages/jobs/src/ocr.ts via runtime-deps.ts) was given.
# Fails CLOSED: an unset/empty secret rejects every /ocr call rather than
# silently allowing all callers.
OCR_SHARED_SECRET = os.environ.get("OCR_SHARED_SECRET", "")

# Own input caps (defense-in-depth, independent of any upstream proxy limit).
MAX_OCR_BYTES = int(os.environ.get("MAX_OCR_BYTES", str(50 * 1024 * 1024)))
MAX_OCR_PAGES = int(os.environ.get("MAX_OCR_PAGES", "50"))


def _ocr_image(img: Image.Image) -> str:
    result, _ = engine(np.array(img.convert("RGB")))
    if not result:
        return ""
    return "\n".join(line[1] for line in result)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/ocr")
async def ocr(
    request: Request,
    file: UploadFile = File(...),
    x_ocr_secret: str | None = Header(default=None, alias="X-OCR-Secret"),
) -> dict:
    if not OCR_SHARED_SECRET:
        raise HTTPException(status_code=503, detail="ocr secret not configured")
    # Constant-time compare (audit follow-up) — a plain `!=` leaks timing
    # information proportional to the matching prefix length. Guard the
    # missing-header case first so hmac.compare_digest never sees None.
    if x_ocr_secret is None or not hmac.compare_digest(x_ocr_secret, OCR_SHARED_SECRET):
        raise HTTPException(status_code=401, detail="unauthorized")

    # Own size cap (audit follow-up) — don't rely solely on an upstream
    # proxy/limit. Check the declared Content-Length first (cheap reject),
    # then bound the actual read so a missing/lying Content-Length can't
    # bypass the cap: read one byte past the cap and reject if we got it.
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            if int(content_length) > MAX_OCR_BYTES:
                raise HTTPException(status_code=413, detail="file too large")
        except ValueError:
            pass  # malformed header — fall through to the bounded read below
    data = await file.read(MAX_OCR_BYTES + 1)
    if len(data) > MAX_OCR_BYTES:
        raise HTTPException(status_code=413, detail="file too large")
    if not data:
        raise HTTPException(status_code=400, detail="empty file")
    ct = (file.content_type or "").lower()
    try:
        if ct == "application/pdf" or (file.filename or "").lower().endswith(".pdf"):
            # Page cap (audit follow-up): probe the page count via poppler's
            # pdfinfo FIRST (cheap — no rasterisation) and reject oversize
            # PDFs outright with 413, rather than silently truncating to
            # MAX_OCR_PAGES — a caller expecting N pages of text should never
            # get a silently-partial result back with a 200.
            info = pdfinfo_from_bytes(data)
            page_count = info.get("Pages", 0)
            if page_count > MAX_OCR_PAGES:
                raise HTTPException(
                    status_code=413,
                    detail=f"too many pages ({page_count} > {MAX_OCR_PAGES})",
                )
            pages = convert_from_bytes(
                data, dpi=200, first_page=1, last_page=MAX_OCR_PAGES
            )
            texts = [_ocr_image(p) for p in pages]
            return {"text": "\n".join(texts), "engine": "rapidocr", "pages": len(pages)}
        img = Image.open(io.BytesIO(data))
        return {"text": _ocr_image(img), "engine": "rapidocr", "pages": 1}
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 — surface any decode/OCR failure as 500
        raise HTTPException(status_code=500, detail=f"ocr failed: {exc}") from exc
