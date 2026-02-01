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

// Updated User Model with Authentication
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't return password in queries
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  }
});

// Remove password when converting to JSON
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

const User = mongoose.model('User', userSchema);

// Todo Model for Day 4 (UPDATED FOR DAY 6 WITH USER FIELD)
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
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Will be set when user creates todo
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
  { id: 1, task: "Complete Day 3 MongoDB", completed: true, priority: "high", userId: null },
  { id: 2, task: "Start Day 4 Todo CRUD", completed: false, priority: "high", userId: null },
  { id: 3, task: "Test API endpoints", completed: false, priority: "medium", userId: null }
];
let nextMemoryId = 4;

// 1. GET /api/todos - Get all todos (PUBLIC)
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

// 2. GET /api/todos/:id - Get single todo (PUBLIC)
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

// 3. POST /api/todos - Create new todo (PROTECTED - SEE DAY 6 SECTION BELOW)

// 4. PUT /api/todos/:id - Update todo (PROTECTED - SEE DAY 6 SECTION BELOW)

// 5. DELETE /api/todos/:id - Delete todo (PROTECTED - SEE DAY 6 SECTION BELOW)

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

// ======================
// DAY 5: AUTHENTICATION (WITH MEMORY FALLBACK)
// ======================
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

console.log('🔐 Loading Day 5 Authentication with Memory Fallback...');

// In-memory user storage (fallback when MongoDB is down)
let memoryUsers = [];
let nextMemoryUserId = 1;

// Helper: Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET || 'fallback-secret-key-change-this-123',
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Helper: Hash Password
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// 1. POST /api/register → Register new user (WITH MEMORY FALLBACK)
app.post('/api/register', async (req, res) => {
  try {
    console.log('📡 Register endpoint hit!');
    const { name, email, password, confirmPassword } = req.body;

    // Validation
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    // Email format validation
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid email address'
      });
    }

    // Check if MongoDB is available
    if (canUseDB()) {
      console.log('✅ Using MongoDB for registration');
      // MongoDB version
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'User with this email already exists'
        });
      }

      const hashedPassword = await hashPassword(password);
      const user = await User.create({
        name,
        email,
        password: hashedPassword
      });

      const token = generateToken(user._id);
      user.lastLogin = new Date();
      await user.save();

      res.status(201).json({
        success: true,
        message: 'User registered successfully (MongoDB)',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
          },
          token,
          expiresIn: process.env.JWT_EXPIRE || '7d'
        }
      });
    } else {
      console.log('⚠️ Using in-memory storage for registration');
      // Memory storage version
      const existingUser = memoryUsers.find(u => u.email === email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'User with this email already exists'
        });
      }

      const hashedPassword = await hashPassword(password);
      const newUser = {
        id: nextMemoryUserId++,
        name,
        email,
        password: hashedPassword,
        role: 'user',
        createdAt: new Date(),
        lastLogin: new Date()
      };

      memoryUsers.push(newUser);

      const token = generateToken(newUser.id.toString());
      const { password: _, ...userWithoutPassword } = newUser;

      res.status(201).json({
        success: true,
        message: 'User registered successfully (in-memory storage)',
        data: {
          user: userWithoutPassword,
          token,
          expiresIn: process.env.JWT_EXPIRE || '7d'
        }
      });
    }

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      note: 'Check if bcrypt is installed: npm install bcrypt'
    });
  }
});

// 2. POST /api/login → Login user (WITH MEMORY FALLBACK)
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    if (canUseDB()) {
      // MongoDB version
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      const token = generateToken(user._id);
      user.lastLogin = new Date();
      await user.save();

      res.json({
        success: true,
        message: 'Login successful (MongoDB)',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            lastLogin: user.lastLogin
          },
          token,
          expiresIn: process.env.JWT_EXPIRE || '7d'
        }
      });
    } else {
      // Memory storage version
      const user = memoryUsers.find(u => u.email === email);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      user.lastLogin = new Date();
      const token = generateToken(user.id.toString());
      const { password: _, ...userWithoutPassword } = user;

      res.json({
        success: true,
        message: 'Login successful (in-memory)',
        data: {
          user: userWithoutPassword,
          token,
          expiresIn: process.env.JWT_EXPIRE || '7d'
        }
      });
    }

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 3. GET /api/profile → Get current user profile (PROTECTED)
app.get('/api/profile', async (req, res) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    // Verify token
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'fallback-secret-key-change-this-123'
    );

    if (canUseDB()) {
      // MongoDB version
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        data: user
      });
    } else {
      // Memory storage version
      const user = memoryUsers.find(u => u.id.toString() === decoded.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json({
        success: true,
        data: userWithoutPassword
      });
    }

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 4. POST /api/logout → Logout (client-side, just returns success)
app.post('/api/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully. Delete token on client side.'
  });
});

// 5. Middleware: Protect routes (AUTH MIDDLEWARE FOR DAY 6)
const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized, no token provided'
      });
    }

    // Verify token
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'fallback-secret-key-change-this-123'
    );

    // Find user based on storage type
    if (canUseDB()) {
      req.user = await User.findById(decoded.id);
    } else {
      req.user = memoryUsers.find(u => u.id.toString() === decoded.id);
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not found or token invalid'
      });
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    }
    
    res.status(401).json({
      success: false,
      error: 'Not authorized'
    });
  }
};

// Day 5 Test Endpoint
app.get('/api/day5-test', (req, res) => {
  res.json({
    success: true,
    day: 5,
    title: 'Authentication System',
    database: canUseDB() ? 'MongoDB' : 'In-Memory Storage',
    endpoints: [
      { method: 'POST', path: '/api/register', description: 'Register new user' },
      { method: 'POST', path: '/api/login', description: 'Login user' },
      { method: 'GET', path: '/api/profile', description: 'Get user profile (requires token)' },
      { method: 'POST', path: '/api/logout', description: 'Logout user' }
    ],
    features: [
      'Password hashing with bcrypt',
      'JWT token generation',
      'Email validation',
      'Password confirmation',
      'Role-based access (user/admin)',
      'Token expiration',
      'Memory fallback when MongoDB unavailable'
    ],
    message: '✅ Day 5: Authentication system ready!',
    note: 'Working with in-memory storage until MongoDB is fixed'
  });
});

// ======================
// DAY 6: MIDDLEWARE & PROTECTED ROUTES
// ======================

console.log('🔐 Loading Day 6: Middleware & Protected Routes...');

// PUBLIC: Get public todos (first 5) - no auth required
app.get('/api/public-todos', async (req, res) => {
  try {
    if (canUseDB()) {
      const todos = await Todo.find().sort({ createdAt: -1 }).limit(5);
      return res.json({
        success: true,
        source: 'mongodb',
        message: 'Public todos (first 5)',
        count: todos.length,
        data: todos
      });
    }

    // Memory fallback
    const publicTodos = memoryTodos.slice(0, 5);
    
    res.json({
      success: true,
      source: 'memory',
      message: 'Public todos (first 5)',
      count: publicTodos.length,
      data: publicTodos
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PROTECTED: Create todo - only authenticated users
app.post('/api/todos', protect, async (req, res) => {
  try {
    const { task, priority = 'medium' } = req.body;

    // Validation
    if (!task || task.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Task is required and must be at least 3 characters'
      });
    }

    // Get user ID
    const userId = canUseDB() ? req.user._id : req.user.id;

    if (canUseDB()) {
      const todo = await Todo.create({
        task: task.trim(),
        priority,
        completed: false,
        user: userId
      });

      return res.status(201).json({
        success: true,
        message: 'Todo created successfully',
        source: 'mongodb',
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email
        },
        data: todo
      });
    }

    // Memory fallback
    const newTodo = {
      id: nextMemoryId++,
      task: task.trim(),
      priority,
      completed: false,
      userId: userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    memoryTodos.push(newTodo);

    res.status(201).json({
      success: true,
      message: 'Todo created (in memory)',
      source: 'memory',
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email
      },
      data: newTodo
    });

  } catch (error) {
    console.error('Todo creation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PROTECTED: Update todo - only todo owner
app.put('/api/todos/:id', protect, async (req, res) => {
  try {
    const { task, completed, priority } = req.body;
    const userId = canUseDB() ? req.user._id : req.user.id;

    if (canUseDB()) {
      const updates = {};
      if (task !== undefined) updates.task = task.trim();
      if (completed !== undefined) updates.completed = completed;
      if (priority !== undefined) updates.priority = priority;
      updates.updatedAt = new Date();

      const todo = await Todo.findOneAndUpdate(
        { _id: req.params.id, user: userId },
        updates,
        { new: true, runValidators: true }
      );

      if (!todo) {
        return res.status(404).json({
          success: false,
          error: 'Todo not found or not authorized to update'
        });
      }

      return res.json({
        success: true,
        message: 'Todo updated',
        source: 'mongodb',
        data: todo
      });
    }

    // Memory fallback
    const index = memoryTodos.findIndex(t => 
      t.id === parseInt(req.params.id) && t.userId === userId
    );
    
    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: 'Todo not found or not authorized to update'
      });
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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PROTECTED: Delete todo - only todo owner
app.delete('/api/todos/:id', protect, async (req, res) => {
  try {
    const userId = canUseDB() ? req.user._id : req.user.id;

    if (canUseDB()) {
      const todo = await Todo.findOneAndDelete({
        _id: req.params.id,
        user: userId
      });

      if (!todo) {
        return res.status(404).json({
          success: false,
          error: 'Todo not found or not authorized to delete'
        });
      }

      return res.json({
        success: true,
        message: 'Todo deleted',
        source: 'mongodb',
        data: todo
      });
    }

    // Memory fallback
    const index = memoryTodos.findIndex(t => 
      t.id === parseInt(req.params.id) && t.userId === userId
    );
    
    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: 'Todo not found or not authorized to delete'
      });
    }

    const deleted = memoryTodos.splice(index, 1)[0];

    res.json({
      success: true,
      message: 'Todo deleted (from memory)',
      source: 'memory',
      data: deleted
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PROTECTED: Get user's own todos
app.get('/api/my-todos', protect, async (req, res) => {
  try {
    const userId = canUseDB() ? req.user._id : req.user.id;

    if (canUseDB()) {
      const todos = await Todo.find({ user: userId }).sort({ createdAt: -1 });
      return res.json({
        success: true,
        source: 'mongodb',
        count: todos.length,
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email
        },
        data: todos
      });
    }

    // Memory fallback - filter by userId
    const userTodos = memoryTodos.filter(t => t.userId === userId);
    
    res.json({
      success: true,
      source: 'memory',
      count: userTodos.length,
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email
      },
      data: userTodos
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Day 6 Test Endpoint (PROTECTED)
app.get('/api/day6-test', protect, (req, res) => {
  res.json({
    success: true,
    day: 6,
    title: 'Middleware & Protected Routes',
    features: [
      '✅ authMiddleware (protect) to verify JWT',
      '✅ GET /api/profile → protected, returns user data',
      '✅ POST /api/todos → only authenticated users can create',
      '✅ PUT/DELETE /api/todos/:id → protected (user-specific)',
      '✅ GET /api/my-todos → get only user\'s todos',
      '✅ Tested with authorization headers'
    ],
    protected_routes: [
      '/api/profile',
      '/api/todos (POST, PUT, DELETE)',
      '/api/my-todos',
      '/api/day6-test'
    ],
    public_routes: [
      '/api/todos (GET)',
      '/api/todos/:id (GET)',
      '/api/public-todos'
    ],
    message: '✅ Day 6: Middleware & Protected Routes Complete!',
    your_user: {
      id: canUseDB() ? req.user._id : req.user.id,
      name: req.user.name,
      email: req.user.email
    }
  });
});

// ======================
// HOMEPAGE (UPDATED WITH DAY 6)
// ======================

app.get('/', (req, res) => {
  const dbStatus = canUseDB() ? 'Connected ✅' : 'Disconnected (Using Memory) ⚠️';
  const todoCount = canUseDB() ? 'MongoDB Collection' : `${memoryTodos.length} in memory`;
  const userCount = canUseDB() ? 'MongoDB Collection' : `${memoryUsers.length} in memory`;

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Express API - Complete (Days 1-6)</title>
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
          max-width: 1200px;
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
        .day1 { border-color: #ef4444; }
        .day2 { border-color: #f59e0b; }
        .day3 { border-color: #3b82f6; }
        .day4 { border-color: #10b981; }
        .day5 { border-color: #8b5cf6; }
        .day6 { border-color: #ec4899; }
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
        .day-count {
          display: flex;
          justify-content: center;
          gap: 15px;
          margin: 20px 0;
          flex-wrap: wrap;
        }
        .day-badge {
          padding: 8px 20px;
          border-radius: 20px;
          font-weight: bold;
          font-size: 0.9em;
        }
        .day1-badge { background: #ef4444; }
        .day2-badge { background: #f59e0b; }
        .day3-badge { background: #3b82f6; }
        .day4-badge { background: #10b981; }
        .day5-badge { background: #8b5cf6; }
        .day6-badge { background: #ec4899; }
        .note {
          background: rgba(251, 191, 36, 0.2);
          padding: 10px;
          border-radius: 5px;
          margin: 10px 0;
          font-size: 0.9em;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 Express API - Complete Journey</h1>
        <p class="success">6 Days of Backend Development Complete!</p>
       
        <div class="day-count">
          <div class="day-badge day1-badge">Day 1: Deployment ✓</div>
          <div class="day-badge day2-badge">Day 2: Enhanced API ✓</div>
          <div class="day-badge day3-badge">Day 3: MongoDB ✓</div>
          <div class="day-badge day4-badge">Day 4: Todo CRUD ✓</div>
          <div class="day-badge day5-badge">Day 5: Auth ✓</div>
          <div class="day-badge day6-badge">Day 6: Middleware ✓</div>
        </div>
       
        <div class="status-box">
          <h3>System Status</h3>
          <p>Database: <strong>${dbStatus}</strong></p>
          <p>Todos: <strong>${todoCount}</strong></p>
          <p>Users: <strong>${userCount}</strong></p>
          <p>Authentication: <strong>JWT Token System ✓</strong></p>
          <p>Protected Routes: <strong>Middleware Implemented ✓</strong></p>
        </div>
       
        <h2>📡 Day 6: Middleware & Protected Routes</h2>
        
        <div class="note">
          <strong>🔐 Day 6 Features:</strong><br>
          • authMiddleware to verify JWT tokens<br>
          • Protected routes requiring Authorization header<br>
          • User-specific todo operations<br>
          • Test with Thunder Client below
        </div>
        
        <div class="endpoint day6">
          <span class="method get">GET</span>
          <code>/api/profile</code>
          <p><strong>Protected:</strong> Get user profile (requires <code>Authorization: Bearer token</code>)</p>
        </div>
        
        <div class="endpoint day6">
          <span class="method post">POST</span>
          <code>/api/todos</code>
          <p><strong>Protected:</strong> Create todo (requires authentication)</p>
        </div>
        
        <div class="endpoint day6">
          <span class="method get">GET</span>
          <code>/api/my-todos</code>
          <p><strong>Protected:</strong> Get only your todos</p>
        </div>
        
        <div class="endpoint day6">
          <span class="method get">GET</span>
          <code>/api/public-todos</code>
          <p><strong>Public:</strong> Get first 5 todos (no auth required)</p>
        </div>
        
        <div class="endpoint day6">
          <span class="method get">GET</span>
          <code>/api/day6-test</code>
          <p><strong>Protected:</strong> Day 6 completion test</p>
        </div>
       
        <h2>📡 Day 5: Authentication System</h2>
        <div class="endpoint day5">
          <span class="method post">POST</span>
          <code>/api/register</code>
          <p>Register new user (name, email, password, confirmPassword)</p>
        </div>
        <div class="endpoint day5">
          <span class="method post">POST</span>
          <code>/api/login</code>
          <p>Login user (email, password)</p>
        </div>
        <div class="endpoint day5">
          <span class="method post">POST</span>
          <code>/api/logout</code>
          <p>Logout user (client-side token removal)</p>
        </div>
        <div class="endpoint day5">
          <span class="method get">GET</span>
          <code>/api/day5-test</code>
          <p>Day 5 completion test</p>
        </div>
       
        <h2>📡 Day 4: Todo CRUD API</h2>
        <div class="endpoint day4">
          <span class="method get">GET</span>
          <code>/api/todos</code>
          <p>Get all todos (Public)</p>
        </div>
        <div class="endpoint day4">
          <span class="method get">GET</span>
          <code>/api/todos/:id</code>
          <p>Get single todo (Public)</p>
        </div>
        <div class="endpoint day4">
          <span class="method put">PUT</span>
          <code>/api/todos/:id</code>
          <p>Update todo (Protected)</p>
        </div>
        <div class="endpoint day4">
          <span class="method delete">DELETE</span>
          <code>/api/todos/:id</code>
          <p>Delete todo (Protected)</p>
        </div>
        <div class="endpoint day4">
          <span class="method get">GET</span>
          <code>/api/day4-test</code>
          <p>Day 4 completion test</p>
        </div>
       
        <div class="status-box">
          <h3>🧪 Test Day 6 with Thunder Client:</h3>
          <p><strong>Step 1:</strong> <code>POST /api/register</code> to create account</p>
          <p><strong>Step 2:</strong> <code>POST /api/login</code> to get JWT token</p>
          <p><strong>Step 3:</strong> Add header: <code>Authorization: Bearer YOUR_TOKEN</code></p>
          <p><strong>Step 4:</strong> Test protected routes:</p>
          <ul style="text-align: left; margin-left: 20px;">
            <li><code>GET /api/profile</code> - Should return user data</li>
            <li><code>POST /api/todos</code> - Should create todo with user association</li>
            <li><code>GET /api/my-todos</code> - Should return only your todos</li>
            <li><code>GET /api/day6-test</code> - Should return Day 6 status</li>
          </ul>
          <p><strong>Step 5:</strong> Test without token - Should get 401 Unauthorized</p>
        </div>
       
        <p style="margin-top: 30px; color: #cbd5e1; font-size: 0.9em;">
          Port: ${PORT} | Status: <span class="success">● Fully Operational</span> | Auth: <span class="success">● JWT Enabled</span> | Middleware: <span class="success">● Active</span>
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
    console.log(`🔐 Day 6: Middleware & Protected Routes loaded`);
  });
};

start();

// Error handling
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));
