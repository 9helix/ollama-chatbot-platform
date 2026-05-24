const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'backend',
  brokers: ['kafka:9092']
});

const producer = kafka.producer();

await producer.connect();

await producer.send({
  topic: 'messages',
  messages: [
    {
      value: JSON.stringify({
        event: 'message.created',
        chat_id,
        content: message
      })
    }
  ]
});