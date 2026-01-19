const express = require('express');
const cors = require('cors');
const config = require('./config/config');
const pool = require('./config/database');

const app = express();

// Middlewares
app.use(cors(config.cors));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Hello from back-api!',
    environment: config.server.env,
    version: '1.0.0'
  });
});

app.get('/db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      message: 'Connected to DB', 
      time: result.rows[0],
      database: config.database.name
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Start server
app.listen(config.server.port, () => {
  console.log(`✓ Server running on port ${config.server.port} in ${config.server.env} mode`);
});