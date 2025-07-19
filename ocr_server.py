from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import pytesseract
import os
import re
import requests

app = Flask(__name__)
CORS(app)

# Use system Tesseract binary (installed in Docker)
pytesseract.pytesseract.tesseract_cmd = 'tesseract'

@app.route('/api/ocr-upload', methods=['POST'])
def ocr_upload():
    print("Received OCR request")
    print("Content-Type:", request.content_type)
    print("Files:", request.files)

    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400

    try:
        image_file = request.files['image']
        image = Image.open(image_file)

        # Perform OCR
        text = pytesseract.image_to_string(image)
        print("OCR Output:\n", text)

        # Extract text lines
        lines = text.split('\n')
        amount = None
        description = None

        # Try to extract amount
        for line in lines:
            if re.search(r'\b(total|total amount|total payable)\b', line, re.IGNORECASE):
                for part in line.split():
                    if '₹' in part or 'RS' in part or '$' in part:
                        match = re.search(r'[\d,]+(?:\.\d{1,2})?', part)
                        if match:
                            amount = match.group(0)
                            break
            elif re.search(r'\b(security|maintenance)\b', line, re.IGNORECASE):
                description = line.strip()

        # Fallback amount extraction
        if not amount:
            for line in lines:
                if '₹' in line or 'RS' in line or '$' in line:
                    parts = re.split(r'₹|RS|\$', line)
                    if len(parts) > 1:
                        match = re.search(r'[\d,]+(?:\.\d{1,2})?', parts[1].strip())
                        if match:
                            amount = match.group(0)
                            break

        # Fallback description
        desc_text = description or 'Bill Payment'

        # === Categorization via ML API ===
        try:
            response = requests.post(
                "https://apiservice-f6oq.onrender.com/api/categorize",
                json={"description": desc_text}
            )
            if response.status_code == 200:
                category = response.json().get("category", "Uncategorized")
            else:
                category = "Uncategorized"
        except Exception as e:
            print("ML API Error:", e)
            category = "Uncategorized"

        return jsonify({
            'amount': amount or '',
            'description': desc_text,
            'category': category
        })

    except Exception as e:
        print("OCR Error:", str(e))
        return jsonify({'error': 'Failed to process image'}), 500

@app.route('/')
def home():
    return 'OCR Server is running!'

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
