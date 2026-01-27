const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://expressuser:ExpressUser123@cluster0.ffg9quz.mongodb.net/myexpressdb?retryWrites=true&w=majority&appName=Cluster0';

async function run() {
  console.log('Testing Atlas connection...');
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ SUCCESS: Connected to MongoDB Atlas!');
    
    const db = client.db('myexpressdb');
    const collections = await db.listCollections().toArray();
    console.log('Database is ready!');
    
  } catch (err) {
    console.error('❌ FAILED:', err.message);
    console.log('\nTROUBLESHOOTING:');
    console.log('1. Go to MongoDB Atlas → Network Access');
    console.log('2. Click "Add IP Address"');
    console.log('3. Click "Allow Access from Anywhere"');
    console.log('4. Wait 2 minutes');
    console.log('5. Try again');
  } finally {
    await client.close();
  }
}

run();
