const jwt = require('jsonwebtoken');
const config = require('../config/config');
const pool = require('../config/database');

// Constantes des rôles
const ROLES = {
  VISITEUR: 'VISITEUR',
  USER: 'USER',
  MANAGER: 'MANAGER'
};

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
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Token d\'authentification requis',
      code: 'TOKEN_REQUIRED'
    });
  }

  // 1) Essayer de vérifier un JWT généré par le backend
  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret);
    req.user = decoded;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Session expirée. Veuillez vous reconnecter.',
        code: 'TOKEN_EXPIRED',
        expiredAt: err.expiredAt
      });
    }
    // Sinon, essayer comme token Firebase
  }

  // 2) Essayer de vérifier comme Firebase ID Token
  try {
    const { admin } = require('../config/firebase');
    if (!admin || !admin.auth) {
      return res.status(503).json({ error: 'Firebase non configuré sur le serveur' });
    }

    const decodedFirebase = await admin.auth().verifyIdToken(token);
    const userEmail = decodedFirebase.email;

    if (!userEmail) {
      return res.status(403).json({ error: 'Token Firebase invalide (email manquant)', code: 'TOKEN_INVALID' });
    }

    // Rechercher l'utilisateur en base par email
    const userResult = await pool.query(`
      SELECT u.id, u.email, r.code as role_code, r.libelle as role
      FROM utilisateur u
      LEFT JOIN role r ON u.id_role = r.id
      WHERE u.email = $1
    `, [userEmail]);

    if (userResult.rows.length === 0) {
      return res.status(403).json({ error: 'Utilisateur non trouvé. Veuillez créer un compte.' });
    }

    const user = userResult.rows[0];
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role_code || user.role || 'USER'
    };

    return next();
  } catch (fbErr) {
    console.error('Erreur vérification token:', fbErr && fbErr.message ? fbErr.message : fbErr);
    return res.status(403).json({ error: 'Token invalide', code: 'TOKEN_INVALID' });
  }
}

/**
 * Middleware pour vérifier le rôle Manager
 */
function requireManager(req, res, next) {
  if (req.user.role !== ROLES.MANAGER) {
    return res.status(403).json({ 
      error: 'Accès refusé. Rôle Manager requis.',
      code: 'MANAGER_REQUIRED'
    });
  }
  next();
}

/**
 * Middleware pour vérifier que l'utilisateur est au moins connecté (USER ou MANAGER)
 */
function requireUser(req, res, next) {
  if (req.user.role !== ROLES.USER && req.user.role !== ROLES.MANAGER) {
    return res.status(403).json({ 
      error: 'Accès refusé. Connexion requise.',
      code: 'USER_REQUIRED'
    });
  }
  next();
}

/**
 * Middleware optionnel d'authentification pour les visiteurs
 * Permet l'accès même sans token, mais enrichit req.user si un token est présent
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // Si pas de token, continuer en mode visiteur
  if (!token) {
    req.user = { role: ROLES.VISITEUR, isVisitor: true };
    return next();
  }

  // Essayer de vérifier le token JWT
  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret);
    req.user = decoded;
    return next();
  } catch (err) {
    // Si le token est expiré ou invalide, continuer en mode visiteur
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      req.user = { role: ROLES.VISITEUR, isVisitor: true };
      return next();
    }
  }

  // Essayer Firebase
  try {
    const { admin } = require('../config/firebase');
    if (admin && admin.auth) {
      const decodedFirebase = await admin.auth().verifyIdToken(token);
      const userEmail = decodedFirebase.email;

      if (userEmail) {
        const userResult = await pool.query(`
          SELECT u.id, u.email, r.code as role_code, r.libelle as role
          FROM utilisateur u
          LEFT JOIN role r ON u.id_role = r.id
          WHERE u.email = $1
        `, [userEmail]);

        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          req.user = {
            id: user.id,
            email: user.email,
            role: user.role_code || ROLES.USER
          };
          return next();
        }
      }
    }
  } catch (fbErr) {
    // Ignorer les erreurs Firebase et continuer en mode visiteur
  }

  // Par défaut, mode visiteur
  req.user = { role: ROLES.VISITEUR, isVisitor: true };
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
  ROLES,
  generateAccessToken,
  generateRefreshToken,
  authenticateToken,
  optionalAuth,
  requireManager,
  requireUser,
  verifyRefreshToken
};
