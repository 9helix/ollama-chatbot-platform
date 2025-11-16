const mongoose = require("mongoose");

const url =
    process.env.MONGO_URL ||
    "mongodb://mongo1:27017,mongo2:27017,mongo3:27017/test?replicaSet=rs0";

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

const seedData = [
    {
        model_name: "granite3.3:latest",
        label: "Granite 3.3",
        description: "Great for summarizing stuff.",
    },
    {
        model_name: "llama3.1:latest",
        label: "Llama 3.1",
        description: "General purpose language model.",
    },
        {
        model_name: "mistral:latest ",
        label: "Mistral",
        description: "Good for programming tasks.",
    },
    // Add more models here
];

async function seed() {
    try {
        await mongoose.connect(url);
        console.log("Connected to MongoDB");

        const Model = mongoose.model("Model", modelSchema);
        await Model.createIndexes();

        // Use insertMany with ordered: false to continue on duplicates
        const result = await Model.insertMany(seedData, { 
            ordered: false,
            rawResult: true 
        }).catch(err => {
            // Handle bulk write errors (duplicates)
            if (err.code === 11000) {
                console.log(`Skipped ${err.writeErrors?.length || 0} duplicate entries`);
                return { insertedCount: seedData.length - (err.writeErrors?.length || 0) };
            }
            throw err;
        });

        console.log(`Seeded ${result.insertedCount || 0} models successfully`);
    } catch (error) {
        console.error("Seed error:", error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
    }
}

seed();
