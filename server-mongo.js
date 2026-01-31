require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Your connection string
const uri = 'mongodb+srv://expressuser:ExpressUser123@express-cluster.ffg9quz.mongodb.net/myexpressdb?retryWrites=true&w=majority&appName=Cluster0';
let client;
let db;

// Connect to MongoDB
async function connectDB() {
  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db('myexpressdb');
    console.log('✅ MongoDB Connected!');
    
    // Create todos collection if it doesn't exist
    const collections = await db.listCollections().toArray();
    const hasTodos = collections.some(c => c.name === 'todos');
    if (!hasTodos) {
      await db.createCollection('todos');
      console.log('✅ Created todos collection');
    }
    
    return true;
  } catch (err) {
    console.error('❌ MongoDB Connection Failed:', err.message);
    return false;
  }
}

// CRUD Routes
app.get('/api/todos', async (req, res) => {
  try {
    const todos = await db.collection('todos').find().toArray();
    res.json({ success: true, data: todos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/todos', async (req, res) => {
  try {
    const { task, completed = false } = req.body;
    
    if (!task) {
      return res.status(400).json({ success: false, error: 'Task is required' });
    }
    
    const result = await db.collection('todos').insertOne({
      task,
      completed,
      createdAt: new Date()
    });
    
    const newTodo = { id: result.insertedId, task, completed };
    res.status(201).json({ success: true, data: newTodo });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/health', async (req, res) => {
  const connected = client && client.topology && client.topology.isConnected();
  res.json({
    status: connected ? 'healthy' : 'degraded',
    database: connected ? 'connected' : 'disconnected',
    service: 'Todo API',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>MongoDB Test</title></head>
    <body>
      <h1>MongoDB Todo API</h1>
      <p>Test these endpoints:</p>
      <ul>
        <li>GET <a href="/api/todos">/api/todos</a></li>
        <li>POST /api/todos (with JSON body)</li>
        <li>GET <a href="/api/health">/api/health</a></li>
      </ul>
    </body>
    </html>
  `);
});

// Start server
async function start() {
  const connected = await connectDB();
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running: http://localhost:${PORT}`);
    console.log(`📊 MongoDB: ${connected ? '✅ Connected' : '❌ Disconnected'}`);
    console.log(`📝 Try: POST /api/todos with { "task": "Test", "completed": false }`);
  });
}

start();
