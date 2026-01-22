const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Basic route
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>My Express Server</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 50px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .container {
          background: rgba(255, 255, 255, 0.1);
          padding: 30px;
          border-radius: 10px;
          display: inline-block;
          backdrop-filter: blur(10px);
        }
        h1 {
          font-size: 2.5em;
          margin-bottom: 20px;
        }
        p {
          font-size: 1.2em;
          margin: 10px 0;
        }
        .success {
          color: #4ade80;
          font-weight: bold;
          font-size: 1.3em;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 Success! Your Express Server is Running</h1>
        <p class="success">Deployed to Render!</p>
        <p>Server is live and working</p>
        <p>Port: ${PORT}</p>
        <p>Time: ${new Date().toLocaleTimeString()}</p>
        <p>Try visiting <a href="/api" style="color: #a5b4fc;">/api</a> endpoint</p>
      </div>
    </body>
    </html>
  `);
});

// API endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Hello from Express API!',
    timestamp: new Date().toISOString(),
    status: 'success',
    endpoints: ['GET /', 'GET /api', 'GET /health']
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api`);
  console.log(`🩺 Health check: http://localhost:${PORT}/health`);
});
