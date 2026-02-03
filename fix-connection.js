const { MongoClient } = require('mongodb');

// Option 1: Try this (non-SRV - what VS Code actually uses)
const uri1 = "mongodb://Express:Express123@cluster0.ffg9quz.mongodb.net:27017/expressdb?directConnection=true&ssl=true";

// Option 2: Or this (simpler non-SRV)
const uri2 = "mongodb://Express:Express123@cluster0.ffg9quz.mongodb.net:27017/?directConnection=true&ssl=true";

async function testConnection(uri, name) {
    console.log(`\nTesting: ${name}`);
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    
    try {
        await client.connect();
        console.log("✓ CONNECTED!");
        const db = client.db("expressdb");
        const collections = await db.listCollections().toArray();
        console.log(`Collections: ${collections.map(c => c.name).join(', ')}`);
        return true;
    } catch (err) {
        console.log(`✗ ${err.message}`);
        return false;
    } finally {
        await client.close();
    }
}

async function runAllTests() {
    console.log("Testing different connection methods...");
    
    // Test non-SRV first (most likely to work)
    await testConnection(uri1, "Non-SRV with database");
    await testConnection(uri2, "Non-SRV without database");
    
    // If those fail, try with different options
    const uri3 = "mongodb://Express:Express123@cluster0.ffg9quz.mongodb.net:27017/?ssl=true&authSource=admin";
    await testConnection(uri3, "Non-SRV with authSource");
}

runAllTests();
