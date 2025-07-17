from flask import Flask, request, jsonify
import joblib

app = Flask(__name__)


model = joblib.load("expense_categorizer_rf.pkl")

@app.route("/api/categorize", methods=["POST"])
def categorize():
    data = request.json
    description = data.get("description", "")
    if not description:
        return jsonify({"error": "Description required"}), 400

    print(f"Received description: {description}")
    prediction = model.predict([description])[0]
    print(f"Categorized as: {prediction}")

    return jsonify({"category": prediction})

@app.route('/')
def index():
    return 'ML Categorization API is running (Random Forest)'


if __name__ == "__main__":
    print("ML Categorization API running")
    app.run(host="0.0.0.0", port=8001)
