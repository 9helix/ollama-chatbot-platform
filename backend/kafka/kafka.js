const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'backend-' + (process.env.HOSTNAME || 'local'),
  brokers: [process.env.KAFKA_BROKERS || 'kafka:9092']
});

const producer = kafka.producer();
// Each backend instance needs its own unique group ID to receive responses for its own requests
// or we use a single group and check correlation IDs. But with Kafka consumer groups, 
// messages are distributed. So if we use the same group ID, only one backend will get the response.
// If backend A sends a request, and Kafka sends the response to backend B, backend A will never resolve.
// Thus, we need either:
// 1. Each instance has its own group ID (so every instance sees every response).
// 2. We use a more complex routing.
// For simplicity, unique group ID per instance.
const consumer = kafka.consumer({ 
  groupId: 'sentiment-response-group-' + (Math.random().toString(36).substring(7)) 
});

const pendingRequests = new Map();

async function initKafka() {
    await producer.connect();
    await consumer.connect();
    await consumer.subscribe({ topic: 'sentiment_responses', fromBeginning: false });

    await consumer.run({
        eachMessage: async ({ message }) => {
            try {
                const data = JSON.parse(message.value.toString());
                const { correlation_id, sentiment } = data;
                console.log(`Received Kafka sentiment response for correlation_id: ${correlation_id}`);
                if (pendingRequests.has(correlation_id)) {
                    const { resolve } = pendingRequests.get(correlation_id);
                    resolve(sentiment);
                    pendingRequests.delete(correlation_id);
                }
            } catch (err) {
                console.error("Error processing Kafka message", err);
            }
        },
    });
}

async function requestSentiment(message) {
    const correlation_id = Date.now().toString() + Math.random().toString(36).substring(2);
    console.log(`Sending Kafka sentiment request for correlation_id: ${correlation_id}`);
    
    return new Promise(async (resolve, reject) => {
        const timeout = setTimeout(() => {
            if (pendingRequests.has(correlation_id)) {
                pendingRequests.delete(correlation_id);
                reject(new Error("Sentiment request timed out"));
            }
        }, 10000);

        pendingRequests.set(correlation_id, { 
            resolve: (val) => {
                clearTimeout(timeout);
                resolve(val);
            } 
        });

        try {
            await producer.send({
                topic: 'sentiment_requests',
                messages: [
                    { value: JSON.stringify({ correlation_id, message }) }
                ],
            });
        } catch (err) {
            clearTimeout(timeout);
            pendingRequests.delete(correlation_id);
            reject(err);
        }
    });
}

module.exports = {
    initKafka,
    requestSentiment,
    producer
};