const { MongoClient } = require('mongodb');

// Use this EXACT connection string
const uri = "mongodb+srv://Express:Express123@cluster0.ffg9quz.mongodb.net/test";

async function run() {
    const client = new MongoClient(uri);
    
    try {
        console.log("Trying to connect...");
        await client.connect();
        console.log("✓ CONNECTED SUCCESSFULLY!");
    } catch (err) {
        console.log("✗ ERROR: " + err.message);
    } finally {
        await client.close();
    }
}

run();
