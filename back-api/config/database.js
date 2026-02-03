const config = require('../config/config');
const { Pool } = require('pg');

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
});

// Test de connexion
pool.on('connect', () => {
  console.log('✓ Connected to database');
});

pool.on('error', (err) => {
  console.error('✗ Database connection error:', err);
});

module.exports = pool;
