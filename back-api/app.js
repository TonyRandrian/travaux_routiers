const express = require('express');
const cors = require('cors');
const config = require('./config/config');
const pool = require('./config/database');

// Import des routes
const signalementsRoutes = require('./routes/signalements');
const utilisateursRoutes = require('./routes/utilisateurs');

const app = express();

// Middlewares
app.use(cors(config.cors));
app.use(express.json());

// Routes API
app.use('/api/signalements', signalementsRoutes);
app.use('/api/utilisateurs', utilisateursRoutes);

// Routes de base
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Travaux Routiers - Antananarivo',
    environment: config.server.env,
    version: '1.0.0',
    endpoints: {
      signalements: '/api/signalements',
      utilisateurs: '/api/utilisateurs',
      health: '/health'
    }
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
  console.log(`✓ API endpoints: /api/signalements, /api/utilisateurs`);
});