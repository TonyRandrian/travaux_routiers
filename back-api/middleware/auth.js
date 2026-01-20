const jwt = require('jsonwebtoken');
const config = require('../config/config');

/**
 * Génère un token d'accès JWT
 * @param {Object} user - L'utilisateur
 * @returns {string} Token JWT
 */
function generateAccessToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email,
      role: user.role_code || 'USER'
    },
    config.auth.jwtSecret,
    { expiresIn: config.auth.sessionDuration }
  );
}

/**
 * Génère un refresh token JWT
 * @param {Object} user - L'utilisateur
 * @returns {string} Refresh token JWT
 */
function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id, type: 'refresh' },
    config.auth.jwtSecret,
    { expiresIn: config.auth.refreshTokenDuration }
  );
}

/**
 * Middleware de vérification du token JWT
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Token d\'authentification requis',
      code: 'TOKEN_REQUIRED'
    });
  }

  jwt.verify(token, config.auth.jwtSecret, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Session expirée. Veuillez vous reconnecter.',
          code: 'TOKEN_EXPIRED',
          expiredAt: err.expiredAt
        });
      }
      return res.status(403).json({ 
        error: 'Token invalide',
        code: 'TOKEN_INVALID'
      });
    }
    req.user = decoded;
    next();
  });
}

/**
 * Middleware pour vérifier le rôle Manager
 */
function requireManager(req, res, next) {
  if (req.user.role !== 'MANAGER') {
    return res.status(403).json({ 
      error: 'Accès refusé. Rôle Manager requis.',
      code: 'MANAGER_REQUIRED'
    });
  }
  next();
}

/**
 * Vérifie un refresh token et retourne les données décodées
 * @param {string} token - Le refresh token
 * @returns {Object|null} Données décodées ou null
 */
function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret);
    if (decoded.type !== 'refresh') {
      return null;
    }
    return decoded;
  } catch (err) {
    return null;
  }
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  authenticateToken,
  requireManager,
  verifyRefreshToken
};
