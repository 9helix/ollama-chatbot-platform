const mongoose = require("mongoose");
const { User, Model, Chat, Message } = require("./models");
const { Ollama } = require('ollama');
const { client, createIndex } = require("./elasticsearch");

// Initialize Ollama client with host from environment variable
const ollama = new Ollama({
    host: process.env.OLLAMA_HOST || 'http://localhost:11434'
});

// Connection URL
const url =
    process.env.MONGO_URL ||
    "mongodb://mongo1:27017,mongo2:27017,mongo3:27017/?replicaSet=rs0";

async function main() {
    await mongoose.connect(url);
    console.log("Connected successfully to server!");

    // Ensure indexes are created
    await Model.createIndexes();
    await User.createIndexes();

    // Ensure Elasticsearch index exists before server handles messages
    await createIndex();
    console.log("Elasticsearch index initialized");

    // Start Express server to expose API to frontend
    const express = require("express");
    const cors = require("cors");
    const app = express();

    app.use(cors());
    app.use(express.json());

    // GET /api/models
    app.get("/api/models", async (req, res) => {
        try {
            const models = await get_available_models();
            res.json(models);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "internal_error" });
        }
    });

    // POST /api/chats - create chat with initial message
    app.post("/api/chats", async (req, res) => {
        const { user_id, model_id, title, initial_message } = req.body;
        if (!user_id || !model_id || !initial_message) {
            return res.status(400).json({ error: "missing_fields" });
        }
        try {
            const chat = await create_chat(
                user_id,
                model_id,
                title || "",
                initial_message
            );
            res.status(201).json(chat);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "internal_error" });
        }
    });

    // GET /api/chats/:chatId/messages
    app.get("/api/chats/:chatId/messages", async (req, res) => {
        try {
            const chatId = new mongoose.Types.ObjectId(req.params.chatId);
            const messages = await get_chat_messages(chatId);
            res.json(messages);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "internal_error" });
        }
    });

    // POST /api/chats/:chatId/messages - send message and stream response
    app.post("/api/chats/:chatId/messages", async (req, res) => {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: "missing_message" });
        }
        try {
            const chatId = new mongoose.Types.ObjectId(req.params.chatId);
            const chat = await Chat.findById(chatId);
            if (!chat) {
                return res.status(404).json({ error: "chat_not_found" });
            }

            // Save user message
            await create_message(chatId, "user", message);

            const model_name = (await Model.findById(chat.model_id)).model_name;
            // Stream the response
            const response = await get_response(model_name, chat._id, message);
            res.status(201).json({ chat: chat, response: response });

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "internal_error" });
        }
    });

    // GET /api/users/:userId/chats
    app.get("/api/users/:userId/chats", async (req, res) => {
        try {
            const chats = await list_user_chats(req.params.userId);
            res.json(chats);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "internal_error" });
        }
    });

    // POST /api/login
    app.post("/api/login", async (req, res) => {
        const { username, password } = req.body;
        if (!username || !password)
            return res.status(400).json({ error: "missing_fields" });
        try {
            const user = await login(username, password);
            if (!user)
                return res.status(401).json({ error: "invalid_credentials" });
            res.json({ user });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "internal_error" });
        }
    });

    app.delete("/api/chats/:chatId", async (req, res) => {
        try {
            const chatId = new mongoose.Types.ObjectId(req.params.chatId);
            await delete_chat(chatId);
            res.status(204).send();
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "internal_error" });
        }
    });

    // GET /api/search?query=text
    app.get("/api/search", async (req, res) => {
        const q = req.query.q;
        const result = await client.search({
            index: "messages",
            query: {
                match: { content: q }
            }
        });

        res.json(result.hits.hits.map(hit => ({
            id: hit._id,
            chat_id: hit._source.chat_id,
            content: hit._source.content,
        })));
    });

    const port = process.env.PORT || 4000;
    app.listen(port, () => console.log(`API listening on ${port}`));

    return "server_started";
}

async function get_available_models() {
    // No need to connect again if already connected
    const models = await Model.find({}, "label model_name description");
    console.log("Found models:", models.length);
    return models;
}

/**
 * @param {string} user_id
 * @param {string} model_id
 * @param {string} title
 * @param {string} initial_message
 */
async function create_chat(user_id, model_id, title, initial_message) {
    const chat = await Chat.create({
        user_id: user_id,
        model_id: model_id,
        title: title,
    });
    const model=await Model.findById(model_id);
    await create_message(chat._id, "user", initial_message);
    const response=await get_response(model.model_name, chat._id, initial_message);
    return { chat:chat,response:response };
}
/**
 * @param {mongoose.Types.ObjectId} chat_id
 * @param {string} role
 * @param {string} content
 */
async function create_message(chat_id, role, content) {
    await Message.create({
        chat_id: chat_id,
        role: role,
        content: content,
    }).then(msg => {
       // Prevent backend crash if ES is offline / delayed startup
       client.index({
           index: "messages",
           document: {
               chat_id: msg.chat_id.toString(),
               role: msg.role,
               content: msg.content,
               created_at: msg.created_at
           }
       }).catch(err => console.error("Elasticsearch indexing failed:", err));
    });
}
/**
 * @param {import("mongoose").Types.ObjectId} chat_id
 */
async function get_chat_messages(chat_id) {
    const messages = await Message.find({ chat_id: chat_id }).sort({
        created_at: 1,
    });
    return messages;
}
/**
 * @param {string} user_id
 */
async function list_user_chats(user_id) {
    const chats = await Chat.find({ user_id: user_id }).sort({
        updated_at: -1,
    });
    return chats;
}
/**
 * @param {string} username
 * @param {string} password
 */

async function login(username, password) {
    const user = await User.findOne({
        username: username,
        password: password,
    }).exec();
    return user;
}

/**
 * @param {string} model_name
 * @param {import("mongoose").Types.ObjectId} chat_id
 * @param {string} message
 * from https://docs.ollama.com/capabilities/streaming#javascript
 */
async function get_response(model_name, chat_id, message) {
    const messages = await get_chat_messages(chat_id);
    let processed_messages = [];
    for (const message of messages) {
        const filter_message = (({ role, content }) => ({ role, content }))(
            message
        );
        processed_messages.push(filter_message);
    }
    processed_messages.push({ role: "user", content: message });
    const stream = await ollama.chat({
        model: model_name,
        messages: processed_messages,
        //stream: true,
    });

    let content = stream.message.content;

    /*for await (const chunk of stream) {
        process.stdout.write(chunk.message.content);
        // accumulate the partial content
        content += chunk.message.content;
    }*/

    // Save the complete response
    await create_message(chat_id, "assistant", content);
    
    return content;
}
async function delete_chat(chat_id) {
    console.log("Deleting chat:", chat_id);
    await Message.deleteMany({ chat_id: chat_id });
    await Chat.deleteOne({ _id: chat_id });
}
// Start the application
main()
    .then(console.log)
    .catch(console.error);

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing MongoDB connection...');
    await mongoose.connection.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, closing MongoDB connection...');
    await mongoose.connection.close();
    process.exit(0);
});
