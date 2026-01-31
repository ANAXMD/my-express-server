const { MongoClient } = require('mongodb');
require('dotenv').config();

// Use your EXACT connection string
const uri = 'mongodb+srv://expressuser:ExpressUser123@express-cluster.ffg9quz.mongodb.net/myexpressdb?retryWrites=true&w=majority&appName=Cluster0';

async function test() {
  console.log('🚀 Testing MongoDB Connection...');
  console.log('Using URI from your screenshot');
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ SUCCESS! Connected to MongoDB Atlas!');
    
    // Test by listing databases
    const adminDb = client.db().admin();
    const result = await adminDb.listDatabases();
    
    console.log('\n📊 Available Databases:');
    result.databases.forEach(db => {
      console.log(`   - ${db.name} (${db.sizeOnDisk} bytes)`);
    });
    
    // Try to create a collection
    const db = client.db('myexpressdb');
    await db.collection('test').insertOne({ message: 'Test from Node.js', date: new Date() });
    console.log('\n✅ Successfully inserted test document!');
    
    // Read it back
    const doc = await db.collection('test').findOne();
    console.log('📄 Test document:', doc);
    
  } catch (err) {
    console.error('❌ CONNECTION FAILED:', err.message);
    console.log('\n🔧 Quick Fixes:');
    console.log('1. Go to MongoDB Atlas → Network Access');
    console.log('2. Click "Add IP Address"');
    console.log('3. Click "Allow Access from Anywhere" (0.0.0.0/0)');
    console.log('4. Wait 1 minute, then try again');
    console.log('\n💡 Current URI being used:');
    console.log(uri.replace(/:[^:@]*@/, ':****@'));
  } finally {
    await client.close();
    console.log('\n🔚 Test complete.');
  }
}

test();
