module.exports = {
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'travaux_routiers',
    user: process.env.DB_USER || 'user',
    password: process.env.DB_PASSWORD || 'password'
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  },
  auth: {
    // Durée de vie des sessions (en secondes) - par défaut 1 heure
    sessionDuration: parseInt(process.env.SESSION_DURATION) || 3600,
    // Durée de vie du refresh token (en secondes) - par défaut 7 jours
    refreshTokenDuration: parseInt(process.env.REFRESH_TOKEN_DURATION) || 604800,
    // Clé secrète pour JWT
    jwtSecret: process.env.JWT_SECRET || 'travaux_routiers_secret_key_2026',
    // Nombre maximum de tentatives de connexion avant blocage
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 3
  }
};
