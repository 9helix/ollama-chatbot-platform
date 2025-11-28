const { Client } = require('@elastic/elasticsearch');
const client = new Client({ node: "http://elasticsearch:9200" });

async function createIndex() {
    const exists = await client.indices.exists({ index: "messages" });
    if (!exists) {
        await client.indices.create({
            index: "messages",
            mappings: {
                properties: {
                    chat_id: { type: "keyword" },
                    role: { type: "keyword" },
                    content: { type: "text" }, // full-text searchable
                    created_at: { type: "date" }
                }
            }
        });
        console.log("Elasticsearch index created");
    }
}

module.exports = { client, createIndex };
