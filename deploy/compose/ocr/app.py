"""Offline OCR sidecar (D-13 / R-5). RapidOCR (PaddleOCR models on ONNX Runtime),
CPU-only, licence-clean. Accepts an image or PDF and returns extracted text.
No cloud, no LLM. Tesseract is the documented fallback engine (swap this service)."""
import io
import os

import numpy as np
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from pdf2image import convert_from_bytes
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
    file: UploadFile = File(...),
    x_ocr_secret: str | None = Header(default=None, alias="X-OCR-Secret"),
) -> dict:
    if not OCR_SHARED_SECRET:
        raise HTTPException(status_code=503, detail="ocr secret not configured")
    if not x_ocr_secret or x_ocr_secret != OCR_SHARED_SECRET:
        raise HTTPException(status_code=401, detail="unauthorized")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty file")
    ct = (file.content_type or "").lower()
    try:
        if ct == "application/pdf" or (file.filename or "").lower().endswith(".pdf"):
            pages = convert_from_bytes(data, dpi=200)
            texts = [_ocr_image(p) for p in pages]
            return {"text": "\n".join(texts), "engine": "rapidocr", "pages": len(pages)}
        img = Image.open(io.BytesIO(data))
        return {"text": _ocr_image(img), "engine": "rapidocr", "pages": 1}
    except Exception as exc:  # noqa: BLE001 — surface any decode/OCR failure as 500
        raise HTTPException(status_code=500, detail=f"ocr failed: {exc}") from exc
