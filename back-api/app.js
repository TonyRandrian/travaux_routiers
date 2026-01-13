const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'travaux_routiers',
  user: process.env.DB_USER || 'user',
  password: process.env.DB_PASSWORD || 'password',
});

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello from back-api!');
});

app.get('/db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ message: 'Connected to DB', time: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});