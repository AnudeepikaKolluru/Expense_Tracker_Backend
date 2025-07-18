from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import pytesseract
import os
import re
import requests  # To call ML API

app = Flask(__name__)
CORS(app)

# Use system tesseract (default inside Docker/Render)
pytesseract.pytesseract.tesseract_cmd = 'tesseract'

@app.route('/api/ocr-upload', methods=['POST'])
def ocr_upload():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400

    image_file = request.files['image']
    image = Image.open(image_file)

    # Perform OCR
    text = pytesseract.image_to_string(image)
    print("OCR Output:\n", text)

    # Try to extract amount and description
    lines = text.split('\n')
    amount = None
    description = None

    # Case insensitive check for "total"
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

    if not amount:
        for line in lines:
            if '₹' in line or 'RS' in line or '$' in line:
                if '₹' in line:
                    parts = line.split('₹')
                elif 'RS' in line:
                    parts = line.split('RS')
                elif '$' in line:
                    parts = line.split('$')
                if len(parts) > 1:
                    match = re.search(r'[\d,]+(?:\.\d{1,2})?', parts[1].strip())
                    if match:
                        amount = match.group(0)
                        break

    # Fallback description
    desc_text = description or 'Bill Payment'

    # === ML Categorization API Call ===
    try:
        ml_response = requests.post(
            "https://apiservice-qzuu.onrender.com/api/categorize",  
            json={"description": desc_text}
        )
        if ml_response.status_code == 200:
            category = ml_response.json().get("category", "Uncategorized")
        else:
            category = "Uncategorized"
    except Exception as e:
        print("Error calling ML categorization API:", e)
        category = "Uncategorized"

    return jsonify({
        'amount': amount or '',
        'description': desc_text,
        'category': category
    })

@app.route('/')
def index():
    return 'OCR server is up and running!'

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8000))
    app.run(host='0.0.0.0', port=port, debug=True)
