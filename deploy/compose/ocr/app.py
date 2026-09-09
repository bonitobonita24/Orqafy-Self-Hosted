"""Offline OCR sidecar (D-13 / R-5). RapidOCR (PaddleOCR models on ONNX Runtime),
CPU-only, licence-clean. Accepts an image or PDF and returns extracted text.
No cloud, no LLM. Tesseract is the documented fallback engine (swap this service)."""
import io

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from pdf2image import convert_from_bytes
from PIL import Image
from rapidocr_onnxruntime import RapidOCR

app = FastAPI(title="Orqafy OCR sidecar")
engine = RapidOCR()


def _ocr_image(img: Image.Image) -> str:
    result, _ = engine(np.array(img.convert("RGB")))
    if not result:
        return ""
    return "\n".join(line[1] for line in result)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/ocr")
async def ocr(file: UploadFile = File(...)) -> dict:
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
