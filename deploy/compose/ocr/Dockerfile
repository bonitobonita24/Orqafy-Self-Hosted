FROM python:3.11-slim
# poppler-utils provides pdftoppm for pdf2image (PDF rasterisation before OCR).
# libgl1 + libglib2.0-0 provide libGL.so.1 for cv2 (opencv via rapidocr-onnxruntime).
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends poppler-utils libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /usr/sbin/nologin appuser
WORKDIR /app
# Refresh pip/setuptools/wheel FIRST (audit H-5) — the base image's preinstalled
# setuptools vendors stale jaraco.context + wheel copies (CVE-2026-23949,
# CVE-2026-24049) under setuptools/_vendor/; a newer setuptools ships patched
# vendored copies.
RUN pip install --no-cache-dir --upgrade pip setuptools wheel
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
# Drop pip itself as the LAST install step (audit H-5) — pip vendors its own
# bundled urllib3 + msgpack copies (pip/_vendor/) at stale CVE-carrying
# versions, and never runs at runtime (uvicorn serves the app, not pip).
# Mirrors the npm-removal fix for the Node images.
RUN pip uninstall -y pip 2>/dev/null; \
    rm -rf /usr/local/lib/python3.11/site-packages/pip \
      /usr/local/lib/python3.11/site-packages/pip-*.dist-info \
      /usr/local/bin/pip /usr/local/bin/pip3 /usr/local/bin/pip3.11
RUN chown -R appuser:appuser /app
USER appuser
EXPOSE 9003
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "9003"]
