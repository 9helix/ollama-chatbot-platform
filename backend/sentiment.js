const { requestSentiment } = require("./kafka/kafka");
const logger = require("./logger");

async function predictSentiment(message) {
    try {
        const sentiment = await requestSentiment(message);
        return sentiment || "NEUTRAL";
    } catch (err) {
        logger.error("Sentiment prediction failed via Kafka", {
            error: err.message,
            message: message.substring(0, 50) + (message.length > 50 ? "..." : "")
        });
        return "NEUTRAL";
    }
}

module.exports = {
    predictSentiment
};