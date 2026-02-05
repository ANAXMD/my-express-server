// ============================================
// DAY 7: PRODUCTION-READY TODO API
// ============================================
// Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const app = express();

// SQLite Database
const { getInstance: getSQLiteDB } = require('./sqlite-db');

// ======================
// ENVIRONMENT CONFIG
// ======================
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

console.log(`🚀 Starting server in ${NODE_ENV} mode...`);

// ======================
// SECURITY MIDDLEWARE
// ======================

// 1. Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: !isProduction ? false : undefined,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 2. CORS configuration
const allowedOrigins = [
  'http://localhost:3000',                    // React dev
  'http://localhost:5173',                    // Vite dev
  'https://my-express-server-rvkq.onrender.com', // Your API
  'https://your-react-frontend.vercel.app',   // Your future frontend
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if the origin is in the allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      // In development, be more permissive
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Allowing origin in dev: ${origin}`);
        return callback(null, true);
      }
      // In production, be strict
      console.log(`Blocked by CORS: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization'], // Expose Authorization header
}));

// Handle preflight requests manually
/* app.options('/*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', isProduction 
    ? process.env.FRONTEND_URL || 'https://your-frontend.vercel.app'
    : 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.status(204).end(); // No content for OPTIONS
});
*/
// 3. Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  }
});
if (isProduction) {
  app.use('/api/', limiter);
}

// 4. Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 5. Static files
app.use(express.static('public'));

// ======================
// DATABASE CONNECTION
// ======================
let sqliteDB = null; // SQLite instance

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      console.log('ℹ️  No MongoDB URI provided. Using SQLite fallback.');
      if (typeof getSQLiteDB === 'function') {
        sqliteDB = getSQLiteDB();
      } else {
        sqliteDB = getSQLiteDB;
      }
      return true;
    }

    // Production connection settings
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(mongoURI, options);
    
    console.log('✅ MongoDB Connected Successfully');
    console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
    
    return true;
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    
    // Fallback to SQLite
    console.log('🔄 Falling back to SQLite database...');
    if (typeof getSQLiteDB === 'function') {
      sqliteDB = getSQLiteDB();
    } else {
      sqliteDB = getSQLiteDB;
    }
    
    return true; // Return true because SQLite is available
  }
};

// Helper to check DB connection
const canUseDB = () => {
  // Check MongoDB connection
  if (mongoose.connection.readyState === 1) {
    return { type: 'mongodb', connected: true };
  }
  
  // Check SQLite connection
  if (sqliteDB !== null) {
    return { type: 'sqlite', connected: true };
  }
  
  return { type: 'none', connected: false };
};

// ======================
// DATA MODELS (MongoDB Only)
// ======================

// User Model
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    index: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

const User = mongoose.model('User', userSchema);

// Todo Model
const todoSchema = new mongoose.Schema({
  task: {
    type: String,
    required: [true, 'Task is required'],
    trim: true,
    minlength: [3, 'Task must be at least 3 characters'],
    maxlength: [500, 'Task cannot exceed 500 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
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
  dueDate: {
    type: Date
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Index for efficient queries
todoSchema.index({ user: 1, completed: 1, createdAt: -1 });
todoSchema.index({ user: 1, dueDate: 1 });

const Todo = mongoose.model('Todo', todoSchema);

// ======================
// UTILITY FUNCTIONS
// ======================

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET || 'fallback-secret-change-in-production',
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Hash Password
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12);
  return await bcrypt.hash(password, salt);
};

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^\S+@\S+\.\S+$/;
  return emailRegex.test(email);
};

// ======================
// MIDDLEWARE
// ======================

// 1. Error Handling Middleware
const errorHandler = (err, req, res, next) => {
  console.error('🔥 Error:', {
    message: err.message,
    stack: isProduction ? null : err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  const statusCode = err.statusCode || 500;
  const message = isProduction && statusCode === 500 
    ? 'Internal server error' 
    : err.message;

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(!isProduction && { stack: err.stack })
  });
};

// 2. Authentication Middleware
const protect = async (req, res, next) => {
  try {
    let token;
    
    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized. Please provide a token.'
      });
    }

    // Verify token
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'fallback-secret-change-in-production'
    );

    // Find user based on database type
    const dbStatus = canUseDB();
    let user;
    
    if (dbStatus.type === 'mongodb') {
      user = await User.findById(decoded.id).select('-__v');
    } else if (dbStatus.type === 'sqlite') {
      user = await sqliteDB.findUserById(decoded.id);
    } else {
      return res.status(500).json({
        success: false,
        error: 'Database not available.'
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found or token is invalid.'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'User account is deactivated.'
      });
    }

    req.user = user;
    req.dbType = dbStatus.type; // Pass db type to routes
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired. Please login again.'
      });
    }
    next(error);
  }
};

// 3. Role-based Authorization
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Role ${req.user.role} is not authorized to access this resource.`
      });
    }

    next();
  };
};

// ======================
// AUTHENTICATION ROUTES
// ======================

// Register User
app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // Validation
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required.'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters.'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid email address.'
      });
    }

    // Check database type
    const dbStatus = canUseDB();
    if (!dbStatus.connected) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable.'
      });
    }

    // Check if user exists
    let existingUser;
    if (dbStatus.type === 'mongodb') {
      existingUser = await User.findOne({ email });
    } else {
      existingUser = await sqliteDB.findUserByEmail(email);
    }

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists.'
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    let user;
    if (dbStatus.type === 'mongodb') {
      user = await User.create({
        name,
        email,
        password: hashedPassword
      });
      user = user.toObject();
      user.id = user._id.toString();
    } else {
      user = await sqliteDB.createUser({
        name,
        email,
        password: hashedPassword
      });
      await sqliteDB.updateUserLastLogin(user.id);
    }

    // Generate token
    const token = generateToken(user.id);

    // Update last login for SQLite (MongoDB does this in pre-save)
    if (dbStatus.type === 'sqlite') {
      await sqliteDB.updateUserLastLogin(user.id);
    }

    // Remove password from response
    delete user.password;

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      data: {
        user,
        token,
        expiresIn: process.env.JWT_EXPIRE || '7d'
      }
    });
  } catch (error) {
    next(error);
  }
});

// Login User
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required.'
      });
    }

    const dbStatus = canUseDB();
    if (!dbStatus.connected) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable.'
      });
    }

    let user;
    if (dbStatus.type === 'mongodb') {
      user = await User.findOne({ email }).select('+password');
      if (user) user = user.toObject();
    } else {
      user = await sqliteDB.findUserByEmail(email);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials.'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials.'
      });
    }

    // Update last login
    if (dbStatus.type === 'mongodb') {
      await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });
    } else {
      await sqliteDB.updateUserLastLogin(user.id);
    }

    // Generate token
    const token = generateToken(dbStatus.type === 'mongodb' ? user._id : user.id);

    // Remove password from response
    delete user.password;
    if (user._id) {
      user.id = user._id.toString();
      delete user._id;
    }

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        user,
        token,
        expiresIn: process.env.JWT_EXPIRE || '7d'
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get Current User Profile
app.get('/api/auth/profile', protect, async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: req.user
    });
  } catch (error) {
    next(error);
  }
});

// Update Profile
app.put('/api/auth/profile', protect, async (req, res, next) => {
  try {
    const { name } = req.body;

    if (name && name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Name must be at least 2 characters.'
      });
    }

    let updatedUser;
    if (req.dbType === 'mongodb') {
      updatedUser = await User.findByIdAndUpdate(
        req.user._id || req.user.id,
        { name: name || req.user.name },
        { new: true, runValidators: true }
      );
      updatedUser = updatedUser.toObject();
      delete updatedUser.password;
    } else {
      await sqliteDB.updateUserName(req.user.id, name || req.user.name);
      updatedUser = await sqliteDB.findUserById(req.user.id);
    }

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
});

// Logout (Client-side)
app.post('/api/auth/logout', protect, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully. Please remove the token from client storage.'
  });
});

// ======================
// TODO ROUTES (PROTECTED)
// ======================

// Create Todo
app.post('/api/todos', protect, async (req, res, next) => {
  try {
    const { task, description, priority, dueDate, tags } = req.body;

    if (!task || task.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Task is required and must be at least 3 characters.'
      });
    }

    const userId = req.user._id || req.user.id;

    let todo;
    if (req.dbType === 'mongodb') {
      todo = await Todo.create({
        task: task.trim(),
        description: description ? description.trim() : undefined,
        priority: priority || 'medium',
        dueDate: dueDate ? new Date(dueDate) : undefined,
        tags: tags && Array.isArray(tags) ? tags.map(tag => tag.trim()) : [],
        user: userId
      });
      todo = todo.toObject();
    } else {
      todo = await sqliteDB.createTodo({
        task: task.trim(),
        description: description ? description.trim() : undefined,
        priority: priority || 'medium',
        dueDate: dueDate ? new Date(dueDate) : undefined,
        userId: userId,
        tags: tags && Array.isArray(tags) ? tags.map(tag => tag.trim()) : []
      });
    }

    res.status(201).json({
      success: true,
      message: 'Todo created successfully.',
      data: todo
    });
  } catch (error) {
    next(error);
  }
});

// Get User's Todos (with pagination, filtering, sorting)
app.get('/api/todos', protect, async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      completed, 
      priority, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      search 
    } = req.query;

    const userId = req.user._id || req.user.id;

    let todos, total;
    if (req.dbType === 'mongodb') {
      // Build query
      const query = { user: userId };
      if (completed !== undefined) query.completed = completed === 'true';
      if (priority) query.priority = priority;
      if (search) query.task = { $regex: search, $options: 'i' };

      // MongoDB query
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      todos = await Todo.find(query)
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      total = await Todo.countDocuments(query);
    } else {
      // SQLite query
      const filters = {
        page: parseInt(page),
        limit: parseInt(limit),
        completed,
        priority,
        sortBy,
        sortOrder,
        search
      };
      
      todos = await sqliteDB.getTodosByUser(userId, filters);
      
      // For total count, we need a separate query
      const allTodos = await sqliteDB.getTodosByUser(userId, {});
      total = allTodos.length;
    }

    res.json({
      success: true,
      data: todos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get Single Todo
app.get('/api/todos/:id', protect, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;

    let todo;
    if (req.dbType === 'mongodb') {
      todo = await Todo.findOne({ _id: id, user: userId }).lean();
    } else {
      todo = await sqliteDB.getTodoById(id, userId);
    }

    if (!todo) {
      return res.status(404).json({
        success: false,
        error: 'Todo not found or you do not have permission to view it.'
      });
    }

    res.json({
      success: true,
      data: todo
    });
  } catch (error) {
    next(error);
  }
});

// Update Todo
app.put('/api/todos/:id', protect, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { task, description, completed, priority, dueDate, tags } = req.body;
    const userId = req.user._id || req.user.id;

    // Validation
    if (task && task.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Task must be at least 3 characters.'
      });
    }

    let todo;
    if (req.dbType === 'mongodb') {
      const updates = {};
      if (task !== undefined) updates.task = task.trim();
      if (description !== undefined) updates.description = description.trim();
      if (completed !== undefined) updates.completed = completed;
      if (priority !== undefined) updates.priority = priority;
      if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
      if (tags !== undefined) updates.tags = Array.isArray(tags) ? tags.map(tag => tag.trim()) : [];

      todo = await Todo.findOneAndUpdate(
        { _id: id, user: userId },
        updates,
        { new: true, runValidators: true }
      ).lean();
    } else {
      const updates = {};
      if (task !== undefined) updates.task = task.trim();
      if (description !== undefined) updates.description = description.trim();
      if (completed !== undefined) updates.completed = completed;
      if (priority !== undefined) updates.priority = priority;
      if (dueDate !== undefined) updates.dueDate = dueDate;
      if (tags !== undefined) updates.tags = tags;

      todo = await sqliteDB.updateTodo(id, userId, updates);
    }

    if (!todo) {
      return res.status(404).json({
        success: false,
        error: 'Todo not found or you do not have permission to update it.'
      });
    }

    res.json({
      success: true,
      message: 'Todo updated successfully.',
      data: todo
    });
  } catch (error) {
    next(error);
  }
});

// Delete Todo
app.delete('/api/todos/:id', protect, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;

    let deleted;
    if (req.dbType === 'mongodb') {
      const todo = await Todo.findOneAndDelete({ _id: id, user: userId }).lean();
      deleted = !!todo;
    } else {
      deleted = await sqliteDB.deleteTodo(id, userId);
    }

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Todo not found or you do not have permission to delete it.'
      });
    }

    res.json({
      success: true,
      message: 'Todo deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
});

// ======================
// STATISTICS & ANALYTICS
// ======================

// Get Todo Statistics
app.get('/api/todos/stats', protect, async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;

    let stats;
    if (req.dbType === 'mongodb') {
      const result = await Todo.aggregate([
        { $match: { user: userId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: { $sum: { $cond: ['$completed', 1, 0] } },
            pending: { $sum: { $cond: ['$completed', 0, 1] } },
            highPriority: { $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] } },
            mediumPriority: { $sum: { $cond: [{ $eq: ['$priority', 'medium'] }, 1, 0] } },
            lowPriority: { $sum: { $cond: [{ $eq: ['$priority', 'low'] }, 1, 0] } }
          }
        }
      ]);

      stats = result[0] || {
        total: 0, completed: 0, pending: 0,
        highPriority: 0, mediumPriority: 0, lowPriority: 0
      };
    } else {
      stats = await sqliteDB.getTodoStats(userId);
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

// ======================
// ADMIN ROUTES
// ======================

// Get All Users (Admin only)
app.get('/api/admin/users', protect, authorize('admin'), async (req, res, next) => {
  try {
    let users;
    if (req.dbType === 'mongodb') {
      users = await User.find().select('-password -__v').sort({ createdAt: -1 }).lean();
    } else {
      users = await sqliteDB.getAllUsers();
    }

    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
});

// Get All Todos (Admin only)
app.get('/api/admin/todos', protect, authorize('admin'), async (req, res, next) => {
  try {
    let todos;
    if (req.dbType === 'mongodb') {
      todos = await Todo.find().populate('user', 'name email').sort({ createdAt: -1 }).lean();
    } else {
      todos = await sqliteDB.getAllTodos();
    }

    res.json({
      success: true,
      count: todos.length,
      data: todos
    });
  } catch (error) {
    next(error);
  }
});

// ======================
// HEALTH & STATUS
// ======================

// Health Check
app.get('/api/health', (req, res) => {
  const dbStatus = canUseDB();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      type: dbStatus.type,
      connected: dbStatus.connected
    },
    memory: {
      rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`
    },
    environment: NODE_ENV
  };

  res.json({
    success: true,
    data: health
  });
});

// API Status
app.get('/api/status', (req, res) => {
  const dbStatus = canUseDB();
  res.json({
    success: true,
    data: {
      api: 'Todo API v1.0',
      version: '1.0.0',
      status: 'operational',
      database: {
        type: dbStatus.type,
        connected: dbStatus.connected
      },
      features: [
        'User Authentication (JWT)',
        'Todo CRUD Operations',
        'User-specific Data',
        'Pagination & Filtering',
        'Statistics & Analytics',
        'Admin Dashboard',
        'CORS Enabled',
        'Rate Limiting',
        'Security Headers'
      ],
      endpoints: {
        auth: ['/api/auth/register', '/api/auth/login', '/api/auth/profile'],
        todos: ['/api/todos', '/api/todos/:id', '/api/todos/stats'],
        admin: ['/api/admin/users', '/api/admin/todos']
      },
      documentation: 'See README for API documentation'
    }
  });
});

// ======================
// HOMEPAGE
// ======================
app.get('/', (req, res) => {
  const dbStatus = canUseDB();
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Production-Ready Todo API</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          margin: 0;
          padding: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          color: white;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        header {
          text-align: center;
          margin-bottom: 50px;
        }
        h1 {
          font-size: 3.5rem;
          margin-bottom: 10px;
          background: linear-gradient(45deg, #fff, #fbbf24);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .tagline {
          font-size: 1.2rem;
          opacity: 0.9;
          margin-bottom: 30px;
        }
        .status-badge {
          display: inline-block;
          padding: 8px 16px;
          background: rgba(34, 197, 94, 0.2);
          border: 2px solid #22c55e;
          border-radius: 20px;
          font-weight: bold;
          margin-bottom: 30px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 30px;
          margin-bottom: 50px;
        }
        .card {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border-radius: 15px;
          padding: 30px;
          transition: transform 0.3s ease;
        }
        .card:hover {
          transform: translateY(-5px);
        }
        .card h3 {
          margin-top: 0;
          color: #fbbf24;
          font-size: 1.5rem;
        }
        .endpoint-list {
          list-style: none;
          padding: 0;
        }
        .endpoint-list li {
          margin: 15px 0;
          padding: 15px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
          font-family: 'Courier New', monospace;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .method {
          padding: 4px 12px;
          border-radius: 4px;
          font-weight: bold;
          font-size: 0.9rem;
        }
        .get { background: #10b981; }
        .post { background: #f59e0b; }
        .put { background: #3b82f6; }
        .delete { background: #ef4444; }
        .endpoint {
          color: #fbbf24;
        }
        .deploy-section {
          text-align: center;
          margin-top: 50px;
          padding: 40px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 15px;
        }
        .btn {
          display: inline-block;
          padding: 15px 30px;
          background: linear-gradient(45deg, #3b82f6, #8b5cf6);
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: bold;
          margin: 10px;
          transition: transform 0.3s ease;
        }
        .btn:hover {
          transform: scale(1.05);
        }
        footer {
          text-align: center;
          margin-top: 50px;
          padding-top: 30px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          opacity: 0.8;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <h1>🚀 Production-Ready Todo API</h1>
          <p class="tagline">A complete, secure, and scalable Todo API with user authentication</p>
          <div class="status-badge">Status: ${dbStatus.connected ? `✅ Connected to ${dbStatus.type}` : '⚠️ Database Unavailable'}</div>
        </header>

        <div class="grid">
          <div class="card">
            <h3>🔐 Authentication</h3>
            <ul class="endpoint-list">
              <li>
                <span class="method post">POST</span>
                <span class="endpoint">/api/auth/register</span>
              </li>
              <li>
                <span class="method post">POST</span>
                <span class="endpoint">/api/auth/login</span>
              </li>
              <li>
                <span class="method get">GET</span>
                <span class="endpoint">/api/auth/profile</span>
              </li>
              <li>
                <span class="method put">PUT</span>
                <span class="endpoint">/api/auth/profile</span>
              </li>
              <li>
                <span class="method post">POST</span>
                <span class="endpoint">/api/auth/logout</span>
              </li>
            </ul>
          </div>

          <div class="card">
            <h3>✅ Todo Management</h3>
            <ul class="endpoint-list">
              <li>
                <span class="method get">GET</span>
                <span class="endpoint">/api/todos</span>
              </li>
              <li>
                <span class="method post">POST</span>
                <span class="endpoint">/api/todos</span>
              </li>
              <li>
                <span class="method get">GET</span>
                <span class="endpoint">/api/todos/:id</span>
              </li>
              <li>
                <span class="method put">PUT</span>
                <span class="endpoint">/api/todos/:id</span>
              </li>
              <li>
                <span class="method delete">DELETE</span>
                <span class="endpoint">/api/todos/:id</span>
              </li>
              <li>
                <span class="method get">GET</span>
                <span class="endpoint">/api/todos/stats</span>
              </li>
            </ul>
          </div>

          <div class="card">
            <h3>📊 Admin & System</h3>
            <ul class="endpoint-list">
              <li>
                <span class="method get">GET</span>
                <span class="endpoint">/api/admin/users</span>
              </li>
              <li>
                <span class="method get">GET</span>
                <span class="endpoint">/api/admin/todos</span>
              </li>
              <li>
                <span class="method get">GET</span>
                <span class="endpoint">/api/health</span>
              </li>
              <li>
                <span class="method get">GET</span>
                <span class="endpoint">/api/status</span>
              </li>
            </ul>
          </div>
        </div>

        <div class="deploy-section">
          <h2>🚀 Deploy to Render</h2>
          <p>This API is production-ready and can be deployed to Render with one click!</p>
          <div>
            <a href="#deploy" class="btn" onclick="showDeploySteps()">View Deployment Steps</a>
            <a href="https://render.com" target="_blank" class="btn">Deploy Now</a>
          </div>
          <div id="deploy-steps" style="display: none; text-align: left; margin-top: 30px; background: rgba(0,0,0,0.3); padding: 20px; border-radius: 10px;">
            <h3>Deployment Steps:</h3>
            <ol>
              <li>Push this code to GitHub</li>
              <li>Create a new Web Service on Render</li>
              <li>Connect your GitHub repository</li>
              <li>Set environment variables (see below)</li>
              <li>Deploy!</li>
            </ol>
            <h4>Required Environment Variables:</h4>
            <pre style="background: rgba(0,0,0,0.5); padding: 15px; border-radius: 5px;">
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRE=7d
NODE_ENV=production
PORT=10000
FRONTEND_URL=https://your-frontend.vercel.app
            </pre>
          </div>
        </div>

        <footer>
          <p>Built with Node.js, Express, MongoDB/SQLite, and ❤️</p>
          <p>Version 1.0.0 | Environment: ${NODE_ENV} | Port: ${PORT} | Database: ${dbStatus.type}</p>
        </footer>
      </div>

      <script>
        function showDeploySteps() {
          const steps = document.getElementById('deploy-steps');
          steps.style.display = steps.style.display === 'none' ? 'block' : 'none';
          return false;
        }
      </script>
    </body>
    </html>
  `);
});

// ======================
// ERROR HANDLING
// ======================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found.`
  });
});

// Global Error Handler
app.use(errorHandler);

// ======================
// START SERVER
// ======================
const startServer = async () => {
  try {
    // Connect to database
    const dbConnected = await connectDB();
    
    if (!dbConnected && isProduction) {
      console.error('🚨 FATAL: Cannot connect to any database in production mode');
      process.exit(1);
    }

    const dbStatus = canUseDB();
    console.log(`✅ Database: ${dbStatus.type.toUpperCase()} (${dbStatus.connected ? 'Connected' : 'Disconnected'})`);
    
    // Start server
    const server = app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${NODE_ENV}`);
      console.log(`🔗 Local: http://localhost:${PORT}`);
      console.log(`🔐 Authentication: JWT Enabled`);
      console.log(`🛡️  CORS: Enabled for frontend`);
      console.log(`📊 Database: ${dbStatus.type} ${dbStatus.connected ? 'Connected' : 'Disconnected'}`);
      console.log(`📈 Rate Limiting: ${isProduction ? 'Enabled' : 'Disabled in dev'}`);
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      console.log(`\n🔄 Received ${signal}. Shutting down gracefully...`);
      server.close(() => {
        console.log('✅ Server closed');
        if (mongoose.connection.readyState === 1) {
          mongoose.connection.close(false, () => {
            console.log('✅ MongoDB connection closed');
          });
        }
        if (sqliteDB) {
          sqliteDB.close();
          console.log('✅ SQLite connection closed');
        }
        setTimeout(() => process.exit(0), 1000);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('⏰ Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('🚨 Uncaught Exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
    });

  } catch (error) {
    console.error('🚨 Failed to start server:', error);
    process.exit(1);
  }
};

// Start the application
startServer();
