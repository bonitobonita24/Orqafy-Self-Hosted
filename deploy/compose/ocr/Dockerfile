FROM python:3.11-slim
# poppler-utils provides pdftoppm for pdf2image (PDF rasterisation before OCR).
# libgl1 + libglib2.0-0 provide libGL.so.1 for cv2 (opencv via rapidocr-onnxruntime).
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /usr/sbin/nologin appuser
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
RUN chown -R appuser:appuser /app
USER appuser
EXPOSE 9003
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "9003"]
