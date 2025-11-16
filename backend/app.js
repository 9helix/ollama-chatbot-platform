const mongoose = require("mongoose");
const { User, Model } = require("./models");

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

    // TODO: Start your actual application logic here (Express server, etc.)

    return "done.";
}

async function get_available_models() {
    // No need to connect again if already connected
    const models = await Model.find({}, "label model_name description");
    console.log("Found models:", models.length);
    return models;
}
main()
    .then(console.log)
    .catch(console.error)
    .finally(() => mongoose.connection.close());
