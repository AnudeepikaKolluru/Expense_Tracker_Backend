FROM python:3.10-slim

# Prevents prompts during package installs
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies, Tesseract, and build tools for scikit-learn
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    build-essential \
    python3-dev \
    cython \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Copy code
COPY . .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose port
EXPOSE 8000

# Start the Flask app
CMD ["python", "ocr_server.py"]
