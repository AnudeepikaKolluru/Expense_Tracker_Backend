FROM python:3.10-slim


RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libtesseract-dev \
    libleptonica-dev \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*


WORKDIR /app


COPY . .


RUN pip install --no-cache-dir -r requirements.txt


EXPOSE 8000

# Run the app
CMD ["python", "ocr_server.py"]
