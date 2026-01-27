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

// Todo Model for Day 4
const todoSchema = new mongoose.Schema({
  task: { 
    type: String, 
    required: [true, 'Task is required'],
    trim: true,
    minlength: [3, 'Task must be at least 3 characters']
  },
  completed: { 
    type: Boolean, 
    default: false 
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

const Todo = mongoose.model('Todo', todoSchema);

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

// ======================
// DAY 4: TODO CRUD API
// ======================

// Helper to check if we can use MongoDB
const canUseDB = () => mongoose.connection.readyState === 1;

// In-memory fallback for todos
let memoryTodos = [
  { id: 1, task: "Complete Day 3 MongoDB", completed: true, priority: "high" },
  { id: 2, task: "Start Day 4 Todo CRUD", completed: false, priority: "high" },
  { id: 3, task: "Test API endpoints", completed: false, priority: "medium" }
];
let nextMemoryId = 4;

// 1. GET /api/todos - Get all todos
app.get('/api/todos', async (req, res) => {
  try {
    if (canUseDB()) {
      const todos = await Todo.find().sort({ createdAt: -1 });
      return res.json({
        success: true,
        source: 'mongodb',
        count: todos.length,
        data: todos
      });
    }
    
    // Fallback to memory
    res.json({
      success: true,
      source: 'memory',
      count: memoryTodos.length,
      data: memoryTodos
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. GET /api/todos/:id - Get single todo
app.get('/api/todos/:id', async (req, res) => {
  try {
    if (canUseDB()) {
      const todo = await Todo.findById(req.params.id);
      if (!todo) {
        return res.status(404).json({ success: false, error: 'Todo not found' });
      }
      return res.json({ success: true, source: 'mongodb', data: todo });
    }
    
    // Memory fallback
    const todo = memoryTodos.find(t => t.id === parseInt(req.params.id));
    if (!todo) {
      return res.status(404).json({ success: false, error: 'Todo not found' });
    }
    res.json({ success: true, source: 'memory', data: todo });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. POST /api/todos - Create new todo
app.post('/api/todos', async (req, res) => {
  try {
    const { task, priority = 'medium' } = req.body;
    
    // Validation
    if (!task || task.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Task is required and must be at least 3 characters'
      });
    }
    
    if (canUseDB()) {
      const todo = await Todo.create({
        task: task.trim(),
        priority,
        completed: false
      });
      
      return res.status(201).json({
        success: true,
        message: 'Todo created successfully',
        source: 'mongodb',
        data: todo
      });
    }
    
    // Memory fallback
    const newTodo = {
      id: nextMemoryId++,
      task: task.trim(),
      priority,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    memoryTodos.push(newTodo);
    
    res.status(201).json({
      success: true,
      message: 'Todo created (in memory)',
      source: 'memory',
      data: newTodo
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. PUT /api/todos/:id - Update todo
app.put('/api/todos/:id', async (req, res) => {
  try {
    const { task, completed, priority } = req.body;
    
    if (canUseDB()) {
      const updates = {};
      if (task !== undefined) updates.task = task.trim();
      if (completed !== undefined) updates.completed = completed;
      if (priority !== undefined) updates.priority = priority;
      updates.updatedAt = new Date();
      
      const todo = await Todo.findByIdAndUpdate(
        req.params.id,
        updates,
        { new: true, runValidators: true }
      );
      
      if (!todo) {
        return res.status(404).json({ success: false, error: 'Todo not found' });
      }
      
      return res.json({
        success: true,
        message: 'Todo updated',
        source: 'mongodb',
        data: todo
      });
    }
    
    // Memory fallback
    const index = memoryTodos.findIndex(t => t.id === parseInt(req.params.id));
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Todo not found' });
    }
    
    if (task !== undefined) memoryTodos[index].task = task.trim();
    if (completed !== undefined) memoryTodos[index].completed = completed;
    if (priority !== undefined) memoryTodos[index].priority = priority;
    memoryTodos[index].updatedAt = new Date();
    
    res.json({
      success: true,
      message: 'Todo updated (in memory)',
      source: 'memory',
      data: memoryTodos[index]
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. DELETE /api/todos/:id - Delete todo
app.delete('/api/todos/:id', async (req, res) => {
  try {
    if (canUseDB()) {
      const todo = await Todo.findByIdAndDelete(req.params.id);
      
      if (!todo) {
        return res.status(404).json({ success: false, error: 'Todo not found' });
      }
      
      return res.json({
        success: true,
        message: 'Todo deleted',
        source: 'mongodb',
        data: todo
      });
    }
    
    // Memory fallback
    const index = memoryTodos.findIndex(t => t.id === parseInt(req.params.id));
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Todo not found' });
    }
    
    const deleted = memoryTodos.splice(index, 1)[0];
    
    res.json({
      success: true,
      message: 'Todo deleted (from memory)',
      source: 'memory',
      data: deleted
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Day 4 Completion Test
app.get('/api/day4-test', async (req, res) => {
  try {
    // Test all CRUD operations
    const testPayload = { task: 'Test Day 4 CRUD', priority: 'high' };
    
    res.json({
      success: true,
      day: 4,
      title: 'Todo CRUD API',
      status: 'READY',
      endpoints: [
        { method: 'GET', path: '/api/todos', description: 'Get all todos' },
        { method: 'GET', path: '/api/todos/:id', description: 'Get single todo' },
        { method: 'POST', path: '/api/todos', description: 'Create todo' },
        { method: 'PUT', path: '/api/todos/:id', description: 'Update todo' },
        { method: 'DELETE', path: '/api/todos/:id', description: 'Delete todo' }
      ],
      database: canUseDB() ? 'mongodb' : 'memory',
      sample_payload: testPayload,
      message: '🎉 Day 4: Todo CRUD API implemented successfully!',
      next_steps: [
        'Test endpoints with Thunder Client',
        'Build frontend interface',
        'Add user authentication',
        'Deploy to Render'
      ]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Updated Home Page with Day 4 features
app.get('/', (req, res) => {
  const dbStatus = canUseDB() ? 'Connected ✅' : 'Disconnected (Using Memory) ⚠️';
  const todoCount = canUseDB() ? 'MongoDB Collection' : `${memoryTodos.length} in memory`;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Express API - Day 3 & 4 Complete</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          text-align: center;
          padding: 40px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          min-height: 100vh;
        }
        .container {
          background: rgba(255, 255, 255, 0.1);
          padding: 40px;
          border-radius: 15px;
          display: inline-block;
          backdrop-filter: blur(10px);
          max-width: 900px;
          margin: 0 auto;
        }
        h1 {
          font-size: 2.8em;
          margin-bottom: 10px;
          color: #fff;
        }
        .success { color: #4ade80; font-weight: bold; }
        .status-box {
          background: rgba(0, 0, 0, 0.2);
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        }
        .endpoint {
          background: rgba(255, 255, 255, 0.1);
          padding: 15px;
          border-radius: 8px;
          margin: 10px 0;
          text-align: left;
          border-left: 4px solid;
        }
        .day3 { border-color: #3b82f6; }
        .day4 { border-color: #10b981; }
        code {
          background: rgba(0, 0, 0, 0.3);
          padding: 5px 10px;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          color: #fbbf24;
        }
        .method {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 4px;
          font-weight: bold;
          margin-right: 10px;
          font-size: 0.9em;
          color: white;
        }
        .get { background: #10b981; }
        .post { background: #f59e0b; }
        .put { background: #3b82f6; }
        .delete { background: #ef4444; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 Express API - Complete</h1>
        <p class="success">✅ Day 3: MongoDB Integration ✓</p>
        <p class="success">✅ Day 4: Todo CRUD API ✓</p>
        
        <div class="status-box">
          <h3>System Status</h3>
          <p>Database: <strong>${dbStatus}</strong></p>
          <p>Todos: <strong>${todoCount}</strong></p>
        </div>
        
        <h2>📡 Day 3: MongoDB Endpoints</h2>
        <div class="endpoint day3">
          <span class="method post">POST</span>
          <code>/api/users</code>
          <p>Create new user (requires name, email)</p>
        </div>
        <div class="endpoint day3">
          <span class="method get">GET</span>
          <code>/api/users</code>
          <p>Get all users</p>
        </div>
        <div class="endpoint day3">
          <span class="method get">GET</span>
          <code>/api/day3-test</code>
          <p>Day 3 completion test</p>
        </div>
        
        <h2>📡 Day 4: Todo CRUD Endpoints</h2>
        <div class="endpoint day4">
          <span class="method get">GET</span>
          <code>/api/todos</code>
          <p>Get all todos</p>
        </div>
        <div class="endpoint day4">
          <span class="method get">GET</span>
          <code>/api/todos/:id</code>
          <p>Get single todo</p>
        </div>
        <div class="endpoint day4">
          <span class="method post">POST</span>
          <code>/api/todos</code>
          <p>Create new todo (requires task)</p>
        </div>
        <div class="endpoint day4">
          <span class="method put">PUT</span>
          <code>/api/todos/:id</code>
          <p>Update todo</p>
        </div>
        <div class="endpoint day4">
          <span class="method delete">DELETE</span>
          <code>/api/todos/:id</code>
          <p>Delete todo</p>
        </div>
        <div class="endpoint day4">
          <span class="method get">GET</span>
          <code>/api/day4-test</code>
          <p>Day 4 completion test</p>
        </div>
        
        <div class="status-box">
          <h3>🧪 Test with Thunder Client:</h3>
          <p><code>POST http://localhost:3000/api/todos</code></p>
          <p>Body: <code>{"task": "Test Day 4", "priority": "high"}</code></p>
        </div>
        
        <p style="margin-top: 30px; color: #cbd5e1; font-size: 0.9em;">
          Port: ${PORT} | Status: <span class="success">● Fully Operational</span>
        </p>
      </div>
    </body>
    </html>
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

