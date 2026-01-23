const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON in POST requests
app.use(express.json());

// Welcome route
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Enhanced Express API</title>
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
          max-width: 800px;
          margin: 0 auto;
        }
        h1 {
          font-size: 2.8em;
          margin-bottom: 20px;
          color: #fff;
        }
        h2 {
          color: #a5b4fc;
          margin-top: 40px;
        }
        .endpoint {
          background: rgba(0, 0, 0, 0.2);
          padding: 15px;
          border-radius: 8px;
          margin: 15px 0;
          text-align: left;
          border-left: 4px solid #4ade80;
        }
        code {
          background: rgba(0, 0, 0, 0.3);
          padding: 5px 10px;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          color: #fbbf24;
        }
        .method {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 4px;
          font-weight: bold;
          margin-right: 10px;
          font-size: 0.9em;
        }
        .get { background: #10b981; color: white; }
        .post { background: #f59e0b; color: white; }
        .success { color: #4ade80; font-weight: bold; }
        .instructions {
          background: rgba(255, 255, 255, 0.05);
          padding: 20px;
          border-radius: 10px;
          margin-top: 30px;
          text-align: left;
        }
        a {
          color: #a5b4fc;
          text-decoration: none;
        }
        a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 Enhanced Express API</h1>
        <p class="success">Day 2: Expanded API Endpoints Deployed!</p>
        
        <h2>📡 Available Endpoints</h2>
        
        <div class="endpoint">
          <span class="method get">GET</span>
          <code>/api/hello</code>
          <p>Returns a simple greeting message</p>
        </div>
        
        <div class="endpoint">
          <span class="method get">GET</span>
          <code>/api/time</code>
          <p>Returns current server time</p>
        </div>
        
        <div class="endpoint">
          <span class="method post">POST</span>
          <code>/api/echo</code>
          <p>Echoes back any JSON you send</p>
        </div>
        
        <div class="endpoint">
          <span class="method get">GET</span>
          <code>/api</code>
          <p>API information (existing)</p>
        </div>
        
        <div class="endpoint">
          <span class="method get">GET</span>
          <code>/health</code>
          <p>Health check (existing)</p>
        </div>
        
        <div class="instructions">
          <h3>🧪 How to Test:</h3>
          <p>1. Install "Thunder Client" extension in VS Code</p>
          <p>2. Test each endpoint with Thunder Client</p>
          <p>3. Your live URL: <code>https://my-express-server.onrender.com</code></p>
          <p>4. Or test locally: <code>http://localhost:${PORT}</code></p>
        </div>
        
        <p style="margin-top: 30px; color: #cbd5e1;">
          Server time: ${new Date().toLocaleTimeString()} | 
          Port: ${PORT} | 
          Status: <span class="success">● Live</span>
        </p>
      </div>
    </body>
    </html>
  `);
});

// API information endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Welcome to Enhanced Express API',
    version: '2.0',
    endpoints: [
      { method: 'GET', path: '/api/hello', description: 'Simple greeting' },
      { method: 'GET', path: '/api/time', description: 'Current server time' },
      { method: 'POST', path: '/api/echo', description: 'Echo back JSON data' },
      { method: 'GET', path: '/api', description: 'API information' },
      { method: 'GET', path: '/health', description: 'Health check' }
    ],
    documentation: 'Visit / for full documentation',
    timestamp: new Date().toISOString()
  });
});

// 1. GET /api/hello → returns { message: "Hello" }
app.get('/api/hello', (req, res) => {
  res.json({
    message: 'Hello',
    greeting: 'Welcome to the API!',
    timestamp: new Date().toISOString()
  });
});

// 2. GET /api/time → returns current server time
app.get('/api/time', (req, res) => {
  const now = new Date();
  res.json({
    timestamp: now.toISOString(),
    formatted: now.toLocaleString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    unix: Math.floor(now.getTime() / 1000),
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
    second: now.getSeconds()
  });
});

// 3. POST /api/echo → returns whatever JSON you send it
app.post('/api/echo', (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({
      error: 'No data provided',
      message: 'Please send JSON data in the request body',
      example: { "name": "John", "age": 30 }
    });
  }
  
  res.json({
    received: req.body,
    message: 'Successfully received your data!',
    timestamp: new Date().toISOString(),
    method: 'POST',
    headers: req.headers['content-type']
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Enhanced Express API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage()
  });
});

// Handle 404 - Route not found
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The route ${req.path} does not exist`,
    availableEndpoints: [
      '/api/hello',
      '/api/time', 
      '/api/echo',
      '/api',
      '/health'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Enhanced server running on http://localhost:${PORT}`);
  console.log(`📡 New endpoints available:`);
  console.log(`   GET  /api/hello`);
  console.log(`   GET  /api/time`);
  console.log(`   POST /api/echo`);
  console.log(`🌍 Deploy with: git push origin main`);
});
