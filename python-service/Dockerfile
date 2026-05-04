FROM python:3.11-slim

WORKDIR /app

# System libs required by OpenCV
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libglib2.0-0 libsm6 libxext6 libxrender1 ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch first so ultralytics doesn't pull the GPU wheel
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
