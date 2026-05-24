from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer
import joblib
import json
import threading
from kafka import KafkaConsumer, KafkaProducer

app = Flask(__name__)

classifier = joblib.load("linear_svm_embeddings.pkl")
metadata = joblib.load("model_metadata.pkl")
embedder = SentenceTransformer(metadata["embedding_model"])

import time
import sys

def kafka_listener():
    print("Starting Kafka listener setup...", flush=True)
    consumer = None
    producer = None
    
    # Retry connecting to Kafka
    while consumer is None or producer is None:
        try:
            consumer = KafkaConsumer(
                'sentiment_requests',
                bootstrap_servers=['kafka:9092'],
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                group_id='sentiment_service_group',
                api_version=(0, 10)
            )

            producer = KafkaProducer(
                bootstrap_servers=['kafka:9092'],
                value_serializer=lambda m: json.dumps(m).encode('utf-8'),
                api_version=(0, 10)
            )
        except Exception as e:
            print(f"Error connecting to Kafka: {e}. Retrying in 5s...", flush=True)
            time.sleep(5)

    print("Kafka Sentiment Service listening on sentiment_requests...", flush=True)
    for message in consumer:
        try:
            data = message.value
            correlation_id = data.get('correlation_id')
            text = data.get('message', '')
            
            print(f"Received request for correlation_id: {correlation_id}", flush=True)
            
            embedding = embedder.encode([text])
            prediction = classifier.predict(embedding)[0]
            
            response = {
                'correlation_id': correlation_id,
                'sentiment': prediction
            }
            
            producer.send('sentiment_responses', response)
            producer.flush()
            print(f"Sent response for correlation_id: {correlation_id}", flush=True)
        except Exception as e:
            print(f"Error processing message: {e}", flush=True)

@app.route("/predict", methods=["POST"])
def predict():
    text = request.json.get("message","")
    embedding = embedder.encode([text])
    prediction = classifier.predict(embedding)[0]
    return jsonify({
        "sentiment": prediction
    })

if __name__ == "__main__":
    # Start Kafka listener in a background thread
    kafka_thread = threading.Thread(target=kafka_listener, daemon=True)
    kafka_thread.start()
    
    # Still start Flask for health checks or HTTP fallback
    app.run(
        host="0.0.0.0",
        port=5000
    )