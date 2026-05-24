const axios = require("axios");

async function predictSentiment(message) {
    try{
        const response = await axios.post(
            "http://sentiment-service:5000/predict", { message }
        );
        return response.data.sentiment;
    }
    catch(err){
        console.error("Sentiment failed", err.message);
        return "NEUTRAL";
    }
}

module.exports = {
    predictSentiment
};