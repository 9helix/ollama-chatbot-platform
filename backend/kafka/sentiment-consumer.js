const { Kafka } = require('kafkajs');
const axios = require('axios');

const kafka = new Kafka({
  clientId: 'sentiment-consumer',
  brokers: ['kafka:9092']
});

const consumer = kafka.consumer({
  groupId: 'sentiment-group'
});

await consumer.connect();

await consumer.subscribe({
  topic: 'messages'
});

await consumer.run({
  eachMessage: async ({ message }) => {
    const data = JSON.parse(message.value.toString());

    const response = await axios.post(
      'http://sentiment-service:5000/predict',
      {
        message: data.content
      }
    );

    console.log(response.data);
  }
});