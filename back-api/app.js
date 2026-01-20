require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const config = require('./config/config');
const pool = require('./config/database');
const swaggerSpec = require('./config/swagger');

// Import des routes
const signalementsRoutes = require('./routes/signalements');
const utilisateursRoutes = require('./routes/utilisateurs');

const app = express();

// Middlewares
app.use(cors(config.cors));
app.use(express.json());

// Documentation Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'API Travaux Routiers - Documentation'
}));

// Route pour le JSON Swagger
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Routes API
app.use('/api/signalements', signalementsRoutes);
app.use('/api/utilisateurs', utilisateursRoutes);

// Routes de base
/**
 * @swagger
 * /:
 *   get:
 *     summary: Informations sur l'API
 *     tags: [Configuration]
 *     responses:
 *       200:
 *         description: Informations de l'API
 */
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Travaux Routiers - Antananarivo',
    environment: config.server.env,
    version: '1.0.0',
    documentation: '/api-docs',
    endpoints: {
      signalements: '/api/signalements',
      utilisateurs: '/api/utilisateurs',
      health: '/health',
      docs: '/api-docs'
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