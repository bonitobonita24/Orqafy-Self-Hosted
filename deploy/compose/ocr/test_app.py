"""Tests for the OCR sidecar hardening (audit follow-up): constant-time auth
compare + own MAX_OCR_BYTES / MAX_OCR_PAGES input caps.

rapidocr_onnxruntime is stubbed in sys.modules BEFORE importing app — it is a
heavy ONNX/model-download dependency we never want tests to require.
pdf2image/PIL/numpy/fastapi stay real (lightweight, no poppler binary needed
for these tests since convert_from_bytes/pdfinfo_from_bytes are monkeypatched
per-test).
"""

import io
import os
import sys
import types

import pytest
from fastapi.testclient import TestClient

# --- stub the heavy OCR engine BEFORE importing app ------------------------
os.environ.setdefault("OCR_SHARED_SECRET", "test-secret-value")


class _FakeEngine:
    def __call__(self, arr):
        return ([], None)


_fake_rapidocr = types.ModuleType("rapidocr_onnxruntime")
_fake_rapidocr.RapidOCR = lambda *a, **kw: _FakeEngine()
sys.modules.setdefault("rapidocr_onnxruntime", _fake_rapidocr)

import app as ocr_app  # noqa: E402 — import after the stub + env setup above


@pytest.fixture
def client():
    return TestClient(ocr_app.app)


@pytest.fixture(autouse=True)
def _reset_secret(monkeypatch):
    monkeypatch.setattr(ocr_app, "OCR_SHARED_SECRET", "test-secret-value")


def _tiny_png_bytes() -> bytes:
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (4, 4), color="white").save(buf, format="PNG")
    return buf.getvalue()


# --- auth ---------------------------------------------------------------


def test_wrong_secret_rejected(client):
    resp = client.post(
        "/ocr",
        headers={"X-OCR-Secret": "not-the-secret"},
        files={"file": ("x.png", _tiny_png_bytes(), "image/png")},
    )
    assert resp.status_code == 401


def test_missing_secret_header_rejected(client):
    resp = client.post(
        "/ocr",
        files={"file": ("x.png", _tiny_png_bytes(), "image/png")},
    )
    assert resp.status_code == 401


def test_unconfigured_secret_rejects_everything(client, monkeypatch):
    monkeypatch.setattr(ocr_app, "OCR_SHARED_SECRET", "")
    resp = client.post(
        "/ocr",
        headers={"X-OCR-Secret": "anything"},
        files={"file": ("x.png", _tiny_png_bytes(), "image/png")},
    )
    assert resp.status_code == 503


def test_correct_secret_accepted(client, monkeypatch):
    monkeypatch.setattr(ocr_app, "_ocr_image", lambda img: "hello")
    resp = client.post(
        "/ocr",
        headers={"X-OCR-Secret": "test-secret-value"},
        files={"file": ("x.png", _tiny_png_bytes(), "image/png")},
    )
    assert resp.status_code == 200
    assert resp.json()["text"] == "hello"


# --- size cap -------------------------------------------------------------


def test_oversize_body_rejected_413(client, monkeypatch):
    monkeypatch.setattr(ocr_app, "MAX_OCR_BYTES", 10)
    resp = client.post(
        "/ocr",
        headers={"X-OCR-Secret": "test-secret-value"},
        files={"file": ("x.png", b"x" * 100, "image/png")},
    )
    assert resp.status_code == 413


def test_body_within_cap_proceeds_past_size_check(client, monkeypatch):
    monkeypatch.setattr(ocr_app, "MAX_OCR_BYTES", 10 * 1024 * 1024)
    monkeypatch.setattr(ocr_app, "_ocr_image", lambda img: "ok")
    resp = client.post(
        "/ocr",
        headers={"X-OCR-Secret": "test-secret-value"},
        files={"file": ("x.png", _tiny_png_bytes(), "image/png")},
    )
    assert resp.status_code == 200


# --- page cap (PDF) --------------------------------------------------------


def test_pdf_over_page_cap_rejected_413(client, monkeypatch):
    monkeypatch.setattr(ocr_app, "MAX_OCR_PAGES", 2)
    monkeypatch.setattr(
        ocr_app, "pdfinfo_from_bytes", lambda data: {"Pages": 5}
    )

    def _fail_convert(*a, **kw):
        raise AssertionError("convert_from_bytes must not run past the page-cap reject")

    monkeypatch.setattr(ocr_app, "convert_from_bytes", _fail_convert)

    resp = client.post(
        "/ocr",
        headers={"X-OCR-Secret": "test-secret-value"},
        files={"file": ("doc.pdf", b"%PDF-fake", "application/pdf")},
    )
    assert resp.status_code == 413
    assert "too many pages" in resp.json()["detail"]


def test_pdf_within_page_cap_accepted(client, monkeypatch):
    from PIL import Image

    monkeypatch.setattr(ocr_app, "MAX_OCR_PAGES", 50)
    monkeypatch.setattr(ocr_app, "pdfinfo_from_bytes", lambda data: {"Pages": 2})
    fake_pages = [Image.new("RGB", (4, 4)), Image.new("RGB", (4, 4))]

    captured = {}

    def _fake_convert(data, dpi, first_page, last_page):
        captured["first_page"] = first_page
        captured["last_page"] = last_page
        return fake_pages

    monkeypatch.setattr(ocr_app, "convert_from_bytes", _fake_convert)
    monkeypatch.setattr(ocr_app, "_ocr_image", lambda img: "page-text")

    resp = client.post(
        "/ocr",
        headers={"X-OCR-Secret": "test-secret-value"},
        files={"file": ("doc.pdf", b"%PDF-fake", "application/pdf")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["pages"] == 2
    assert body["text"] == "page-text\npage-text"
    # first_page/last_page passed through to bound the actual rasterisation too
    assert captured["first_page"] == 1
    assert captured["last_page"] == 50


def test_empty_file_rejected_400(client):
    resp = client.post(
        "/ocr",
        headers={"X-OCR-Secret": "test-secret-value"},
        files={"file": ("x.png", b"", "image/png")},
    )
    assert resp.status_code == 400
