const mongoose = require("mongoose");
const { User, Model, Chat, Message } = require("./models");
const { Ollama } = require('ollama');
const { client, createIndex } = require("./elasticsearch");
const logger = require('./logger');
const redis = require('./redis-client');
const CACHE_TTL = 60 * 60; // 1 hour in seconds
const MODELS_CACHE_KEY = 'ollama:models:list';

// Initialize Ollama client with host from environment variable
const ollama = new Ollama({
    host: process.env.OLLAMA_HOST || 'http://localhost:11434'
});

// Connection URL
const url =
    process.env.MONGO_URL ||
    "mongodb://mongo1:27017,mongo2:27017,mongo3:27017/?replicaSet=rs0";

async function main() {
    logger.info('Starting application...', {
        mongo_url: url,
        ollama_host: process.env.OLLAMA_HOST,
        node_env: process.env.NODE_ENV
    });

    await mongoose.connect(url);
    logger.info("Connected successfully to MongoDB!");

    // Ensure indexes are created
    const indexStart = Date.now();
    await Model.createIndexes();
    await User.createIndexes();
    logger.logDbOperation('createIndexes', 'models+users', Date.now() - indexStart);

    // Ensure Elasticsearch index exists before server handles messages
    try {
        await createIndex();
        logger.info("Elasticsearch index initialized");
    } catch (err) {
        logger.error("Failed to initialize Elasticsearch index", { error: err.message });
    }

    // Start Express server to expose API to frontend
    const express = require("express");
    const cors = require("cors");
    const app = express();

    app.use(cors());
    app.use(express.json());
    
    // Add logging middleware
    app.use(logger.expressMiddleware());

    // GET /api/models
    app.get("/api/models", async (req, res) => {
        const start = Date.now();
        try {
            const models = await get_available_models();
            logger.logDbOperation('find', 'models', Date.now() - start, true);
            res.json(models);
        } catch (err) {
            logger.error("Error fetching models", { 
                error: err.message,
                stack: err.stack,
                request_id: req.id
            });
            res.status(500).json({ error: "internal_error" });
        }
    });

    // POST /api/chats - create chat with initial message
    app.post("/api/chats", async (req, res) => {
        const { user_id, model_id, title, initial_message } = req.body;
        logger.info("Creating new chat", {
            request_id: req.id,
            user_id,
            model_id,
            has_initial_message: !!initial_message
        });

        if (!user_id || !model_id || !initial_message) {
            logger.warn("Missing required fields for chat creation", { 
                request_id: req.id,
                user_id,
                model_id 
            });
            return res.status(400).json({ error: "missing_fields" });
        }

        const start = Date.now();
        try {
            const chat = await create_chat(
                user_id,
                model_id,
                title || "",
                initial_message,
                req.id
            );
            logger.info("Chat created successfully", {
                request_id: req.id,
                chat_id: chat.chat._id.toString(),
                user_id,
                duration_ms: Date.now() - start
            });
            res.status(201).json(chat);
        } catch (err) {
            logger.error("Error creating chat", {
                error: err.message,
                stack: err.stack,
                request_id: req.id,
                user_id,
                model_id
            });
            res.status(500).json({ error: "internal_error" });
        }
    });

    // GET /api/chats/:chatId/messages
    app.get("/api/chats/:chatId/messages", async (req, res) => {
        const start = Date.now();
        try {
            const chatId = new mongoose.Types.ObjectId(req.params.chatId);
            logger.info("Fetching chat messages", {
                request_id: req.id,
                chat_id: chatId.toString()
            });

            const messages = await get_chat_messages(chatId);
            logger.logDbOperation('find', 'messages', Date.now() - start, true);
            res.json(messages);
        } catch (err) {
            logger.error("Error fetching messages", {
                error: err.message,
                request_id: req.id,
                chat_id: req.params.chatId
            });
            res.status(500).json({ error: "internal_error" });
        }
    });

    // POST /api/chats/:chatId/messages - send message and stream response
    app.post("/api/chats/:chatId/messages", async (req, res) => {
        const { message } = req.body;
        const chatId = req.params.chatId;

        logger.info("New message received", {
            request_id: req.id,
            chat_id: chatId,
            message_length: message?.length
        });

        if (!message) {
            logger.warn("Missing message content", { request_id: req.id, chat_id: chatId });
            return res.status(400).json({ error: "missing_message" });
        }

        const start = Date.now();
        try {
            const chatIdObj = new mongoose.Types.ObjectId(chatId);
            const chat = await Chat.findById(chatIdObj);
            if (!chat) {
                logger.warn("Chat not found", { request_id: req.id, chat_id: chatId });
                return res.status(404).json({ error: "chat_not_found" });
            }

            // Save user message
            await create_message(chatIdObj, "user", message, req.id);

            const model_name = (await Model.findById(chat.model_id)).model_name;
            
            // Get response from Ollama
            const response = await get_response(model_name, chat._id, message, req.id);
            
            logger.info("Message processed successfully", {
                request_id: req.id,
                chat_id: chatId,
                model: model_name,
                response_length: response?.length,
                total_duration_ms: Date.now() - start
            });

            res.status(201).json({ chat: chat, response: response });

        } catch (err) {
            logger.error("Error processing message", {
                error: err.message,
                stack: err.stack,
                request_id: req.id,
                chat_id: chatId
            });
            res.status(500).json({ error: "internal_error" });
        }
    });

    // GET /api/users/:userId/chats
    app.get("/api/users/:userId/chats", async (req, res) => {
        const start = Date.now();
        try {
            logger.info("Fetching user chats", {
                request_id: req.id,
                user_id: req.params.userId
            });

            const chats = await list_user_chats(req.params.userId);
            logger.logDbOperation('find', 'chats', Date.now() - start, true);
            res.json(chats);
        } catch (err) {
            logger.error("Error fetching user chats", {
                error: err.message,
                request_id: req.id,
                user_id: req.params.userId
            });
            res.status(500).json({ error: "internal_error" });
        }
    });

    // POST /api/login
    app.post("/api/login", async (req, res) => {
        const { username, password } = req.body;
        logger.info("Login attempt", {
            request_id: req.id,
            username,
            has_password: !!password
        });

        if (!username || !password) {
            logger.warn("Missing login credentials", { request_id: req.id, username });
            return res.status(400).json({ error: "missing_fields" });
        }

        const start = Date.now();
        try {
            const user = await login(username, password);
            if (!user) {
                logger.warn("Invalid login credentials", {
                    request_id: req.id,
                    username
                });
                return res.status(401).json({ error: "invalid_credentials" });
            }

            logger.info("Login successful", {
                request_id: req.id,
                username,
                user_id: user._id.toString(),
                duration_ms: Date.now() - start
            });
            res.json({ user });
        } catch (err) {
            logger.error("Login error", {
                error: err.message,
                request_id: req.id,
                username
            });
            res.status(500).json({ error: "internal_error" });
        }
    });

    app.delete("/api/chats/:chatId", async (req, res) => {
        const start = Date.now();
        try {
            const chatId = new mongoose.Types.ObjectId(req.params.chatId);
            logger.info("Deleting chat", {
                request_id: req.id,
                chat_id: chatId.toString()
            });

            await delete_chat(chatId);
            logger.info("Chat deleted successfully", {
                request_id: req.id,
                chat_id: chatId.toString(),
                duration_ms: Date.now() - start
            });
            res.status(204).send();
        } catch (err) {
            logger.error("Error deleting chat", {
                error: err.message,
                request_id: req.id,
                chat_id: req.params.chatId
            });
            res.status(500).json({ error: "internal_error" });
        }
    });

    // GET /api/search?query=text
    app.get("/api/search", async (req, res) => {
        const q = req.query.q;
        logger.info("Search query", {
            request_id: req.id,
            query: q
        });

        const start = Date.now();
        try {
            const result = await client.search({
                index: "messages",
                query: {
                    multi_match: {
                        query: q,
                        fields: ["content"],
                        fuzziness: "AUTO",
                        operator: "and"
                    }
                }
            });

            logger.logElasticsearch('search', 'messages', true);
            logger.info("Search completed", {
                request_id: req.id,
                query: q,
                results_count: result.hits.hits.length,
                duration_ms: Date.now() - start
            });

            res.json(result.hits.hits.map(hit => ({
                id: hit._id,
                chat_id: hit._source.chat_id,
                content: hit._source.content,
            })));
        } catch (err) {
            logger.error("Search error", {
                error: err.message,
                request_id: req.id,
                query: q
            });
            logger.logElasticsearch('search', 'messages', false, err);
            res.status(500).json({ error: "internal_error" });
        }
    });

    const port = process.env.PORT || 4000;
    app.listen(port, () => {
        logger.info(`API server started and listening on port ${port}`, {
            port,
            node_env: process.env.NODE_ENV
        });
    });

    return "server_started";
}

async function get_available_models() {
    const cached = await redis.get(MODELS_CACHE_KEY);
    if (cached) {
        logger.info("Models fetched from cache", { count: JSON.parse(cached).length });
        return JSON.parse(cached);
    }
    const models = await Model.find({}, "label model_name description");
    logger.info("Models fetched from DB", { count: models.length });
    await redis.setex(
        MODELS_CACHE_KEY,
        CACHE_TTL,
        JSON.stringify(models)
      );
    return models;
}

async function create_chat(user_id, model_id, title, initial_message, request_id) {
    const start = Date.now();
    const chat = await Chat.create({
        user_id: user_id,
        model_id: model_id,
        title: title,
    });
    
    logger.logDbOperation('create', 'chat', Date.now() - start, true);
    
    const model = await Model.findById(model_id);
    await create_message(chat._id, "user", initial_message, request_id);
    const response = await get_response(model.model_name, chat._id, initial_message, request_id);
    
    return { chat: chat, response: response };
}

async function create_message(chat_id, role, content, request_id) {
    const start = Date.now();
    await Message.create({
        chat_id: chat_id,
        role: role,
        content: content,
    }).then(msg => {
        logger.logDbOperation('create', 'message', Date.now() - start, true);
        logger.info("Message saved", {
            request_id,
            chat_id: chat_id.toString(),
            role,
            content_length: content.length
        });

        // Index in Elasticsearch
        client.index({
            index: "messages",
            document: {
                chat_id: msg.chat_id.toString(),
                role: msg.role,
                content: msg.content,
                created_at: msg.created_at
            }
        }).then(() => {
            logger.logElasticsearch('index', 'messages', true);
        }).catch(err => {
            logger.logElasticsearch('index', 'messages', false, err);
        });
    });
}

async function get_chat_messages(chat_id) {
    const start = Date.now();
    const messages = await Message.find({ chat_id: chat_id }).sort({
        created_at: 1,
    });
    logger.logDbOperation('find', 'messages', Date.now() - start, true);
    return messages;
}

async function list_user_chats(user_id) {
    const start = Date.now();
    const chats = await Chat.find({ user_id: user_id }).sort({
        updated_at: -1,
    });
    logger.logDbOperation('find', 'chats', Date.now() - start, true);
    return chats;
}

async function login(username, password) {
    const start = Date.now();
    const user = await User.findOne({
        username: username,
        password: password,
    }).exec();
    logger.logDbOperation('findOne', 'users', Date.now() - start, true);
    return user;
}

async function get_response(model_name, chat_id, message, request_id) {
    const start = Date.now();
    logger.info("Calling Ollama API", {
        request_id,
        model: model_name,
        chat_id: chat_id.toString(),
        message_length: message.length
    });

    try {
        const messages = await get_chat_messages(chat_id);
        let processed_messages = [];
        for (const message of messages) {
            const filter_message = (({ role, content }) => ({ role, content }))(message);
            processed_messages.push(filter_message);
        }
        processed_messages.push({ role: "user", content: message });
        
        const stream = await ollama.chat({
            model: model_name,
            messages: processed_messages,
        });

        let content = stream.message.content;
        const duration = Date.now() - start;

        logger.logOllamaCall(model_name, chat_id, message.length, duration, true);

        // Save the complete response
        await create_message(chat_id, "assistant", content, request_id);
        
        return content;
    } catch (err) {
        const duration = Date.now() - start;
        logger.logOllamaCall(model_name, chat_id, message.length, duration, false, err);
        throw err;
    }
}

async function delete_chat(chat_id) {
    const start = Date.now();
    logger.info("Starting chat deletion", { chat_id: chat_id.toString() });
    
    await Message.deleteMany({ chat_id: chat_id });
    await Chat.deleteOne({ _id: chat_id });
    
    logger.logDbOperation('delete', 'chat+messages', Date.now() - start, true);
}

// Start the application
main()
    .then((result) => {
        logger.info("Application started successfully", { result });
    })
    .catch((err) => {
        logger.error("Application failed to start", {
            error: err.message,
            stack: err.stack
        });
        process.exit(1);
    });

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing MongoDB connection...');
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, closing MongoDB connection...');
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    process.exit(0);
});

// Log unhandled errors
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', {
        reason: reason,
        promise: promise
    });
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack
    });
    process.exit(1);
});