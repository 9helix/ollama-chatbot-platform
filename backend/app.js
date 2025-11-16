const mongoose = require("mongoose");

// or as an es module:
// import { MongoClient } from 'mongodb'

// Connection URL
const url =
    process.env.MONGO_URL ||
    "mongodb://mongo1:27017,mongo2:27017,mongo3:27017/?replicaSet=rs0";
//you can specify db name before ?replicaSet=rs0
// Database Name
//const dbName = "project";

async function main() {
    await mongoose.connect(url);

    console.log("Connected successfully to server!");

    const userSchema = new mongoose.Schema({
        username: { type: String, required: true, unique: true },
        email: { type: String, required: true, unique: true },
        created_at: { type: Date, default: Date.now },
        preferences: {
            default_model: String,
            theme: String,
        },
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
    const Model = mongoose.model("Model", modelSchema);
    
    // Ensure indexes are created
    await Model.createIndexes();
    
    // TODO: Start your actual application logic here (Express server, etc.)
    
    return "done.";
}

main()
    .then(console.log)
    .catch(console.error)
    .finally(() => mongoose.connection.close());
