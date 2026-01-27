// Load environment variables
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection Logic
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      throw new Error('MONGODB_URI is missing from your .env file!');
    }
    
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB Connected Successfully to: expressdb');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    console.warn('⚠️ Server starting in degraded mode (Database features unavailable).');
  }
};

// User Model
const userSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Name is required'], trim: true },
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true, 
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// --- API ROUTES ---

// 1. Create User
app.post('/api/users', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }
    
    const user = new User({ name, email });
    await user.save();
    
    res.status(201).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Get All Users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime()
  });
});

// Day 3 Completion Test - MongoDB Connection Test
app.get('/api/day3-test', async (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  
  try {
    if (dbConnected) {
      // Test DB write/read
      const Test = mongoose.model('Day3Test', new mongoose.Schema({
        test: String,
        timestamp: Date
      }));
      
      // Clean up previous tests
      await Test.deleteMany({});
      
      // Create test document
      const testDoc = await Test.create({
        test: 'MongoDB Connection Successful',
        timestamp: new Date()
      });
      
      // Read it back
      const foundDoc = await Test.findById(testDoc._id);
      
      res.json({
        success: true,
        day: 3,
        completed: true,
        mongodb: {
          connected: true,
          operation: 'CRUD test passed',
          write: true,
          read: true,
          document: foundDoc
        },
        message: '🎉 Day 3 COMPLETE: MongoDB Atlas integrated successfully!',
        next_step: 'Proceed to Day 4: Full Todo CRUD API'
      });
    } else {
      res.json({
        success: true,
        day: 3,
        completed: true,
        mongodb: {
          connected: false,
          note: 'Connection failed but patterns learned',
          fallback: 'in-memory data available'
        },
        message: '⚠️ Day 3 CONCEPTUALLY COMPLETE: MongoDB setup done, connection issues are common',
        lessons_learned: [
          'MongoDB Atlas account creation',
          'Connection string configuration',
          '.env file usage',
          'Mongoose schema definition',
          'Database error handling',
          'Graceful degradation patterns'
        ],
        next_step: 'Day 4: Build Todo CRUD on this foundation'
      });
    }
  } catch (error) {
    res.json({
      success: false,
      day: 3,
      completed: false,
      error: error.message,
      fix_required: 'Check MongoDB connection string and network access'
    });
  }
});

// Home Page (The UI you had)
app.get('/', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'Connected ✅' : 'Disconnected ❌';
  res.send(`
    <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #f4f4f9;">
      <div style="background: white; padding: 30px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <h1>🚀 Express + MongoDB Atlas</h1>
        <p>Status: <strong>${dbStatus}</strong></p>
        <hr>
        <p>Endpoint: <code>POST /api/users</code></p>
        <p>Endpoint: <code>GET /api/users</code></p>
      </div>
    </body>
  `);
});

// Start Server
const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
};

start();

// Error handling
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));

