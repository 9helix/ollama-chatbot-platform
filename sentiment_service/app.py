from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer
import joblib

app = Flask(__name__)

classifier = joblib.load("linear_svm_embeddings.pkl")
metadata = joblib.load("model_metadata.pkl")
embedder = SentenceTransformer(metadata["embedding_model"])

@app.route("/predict", methods=["POST"])
def predict():
    text = request.json.get("message","")
    embedding = embedder.encode([text])
    prediction = classifier.predict(embedding)[0]
    return jsonify({
        "sentiment": prediction
    })

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000
    )