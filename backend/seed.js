const mongoose = require("mongoose");
const { Model, User } = require("./models");

const url =
    process.env.MONGO_URL ||
    "mongodb://mongo1:27017,mongo2:27017,mongo3:27017/test?replicaSet=rs0";

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
        model_name: "mistral:latest",
        label: "Mistral",
        description: "Good for programming tasks.",
    },
    // Add more models here
];

const default_user = {
    username: "admin",
    password: "admin123",
};

async function seed() {
    try {
        await mongoose.connect(url);
        console.log("Connected to MongoDB");

        await Model.createIndexes();
        await User.createIndexes();

        // Seed models
        const result = await Model.insertMany(seedData, {
            ordered: false,
            rawResult: true,
        }).catch((err) => {
            // Handle bulk write errors (duplicates)
            if (err.code === 11000) {
                console.log(
                    `Skipped ${err.writeErrors?.length || 0} duplicate model entries`
                );
                return {
                    insertedCount:
                        seedData.length - (err.writeErrors?.length || 0),
                };
            }
            throw err;
        });

        console.log(`Seeded ${result.insertedCount || 0} models successfully`);

        // Seed default user
        try {
            const existingUser = await User.findOne({ username: default_user.username });
            if (!existingUser) {
                await User.create(default_user);
                console.log(`Successfully created admin user.`);
            } else {
                console.log(`Admin user already exists.`);
            }
        } catch (err) {
            if (err.code === 11000) {
                console.log(`Admin user already exists.`);
            } else {
                throw err;
            }
        }
    } catch (error) {
        console.error("Seed error:", error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
    }
}

seed();