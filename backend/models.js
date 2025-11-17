const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true, unique: true },
    created_at: { type: Date, default: Date.now },
    //preferences: {
    //    default_model: String,
        //theme: String,
    //},
});

const modelSchema = new mongoose.Schema(
    {
        model_name: {
            type: String,
            required: [true, "Model name is required"],
            trim: true,
            unique: true,
        },
        label: {
            type: String,
            required: [true, "Instance name is required"],
            trim: true,
            maxlength: [100, "Instance name cannot exceed 100 characters"],
        },
        description: {
            type: String,
            maxlength: [500, "Description cannot exceed 500 characters"],
            trim: true,
        },
        usage_count: {
            type: Number,
            default: 0,
            min: [0, "Usage count cannot be negative"],
        },
        last_used_at: {
            type: Date,
            default: null,
        },
    },
    {
        collection: "models",
    }
);

const chatSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    model_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Model', required: true },
    title: String,
    created_at: { type: Date, default: Date.now }, 
    updated_at: { type: Date, default: Date.now },
    message_count: { type: Number, default: 0 },
})

const messageSchema = new mongoose.Schema({
    chat_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
    //token count
})

// Create and export models
const User = mongoose.model("User", userSchema);
const Model = mongoose.model("Model", modelSchema);
const Chat = mongoose.model("Chat", chatSchema);
const Message = mongoose.model("Message", messageSchema);

module.exports = { User, Model, Chat, Message };
