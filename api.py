from flask import Flask, request, jsonify
import joblib

app = Flask(__name__)

model = joblib.load("expense_categorizer_rf.pkl")

@app.route("/api/categorize", methods=["POST"])
@app.route("/api/categorize", methods=["POST"])
def categorize():
    data = request.json
    description = data.get("description", "")
    if not description:
        return jsonify({"error": "Description required"}), 400

    print(f" Received description: {description}")
    prediction = model.predict([description])[0]
    print(f" Categorized as: {prediction}")

    return jsonify({"category": prediction})


@app.route('/')
def index():
    return ' ML Categorization API is running (Random Forest)'

if __name__ == "_main_":
    print(" ML Categorization API running ")
    app.run(port=8001)