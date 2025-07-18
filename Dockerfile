# Use stable Python 3.10 base image
FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy all files to container
COPY . .

# Upgrade pip and install Python dependencies
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Expose port
EXPOSE 8000

# Run the Flask app
CMD ["python", "ocr_server.py"]
