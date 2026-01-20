const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const config = require('../config/config');
const bcrypt = require('bcryptjs');
const { 
  ROLES,
  generateAccessToken, 
  generateRefreshToken, 
  authenticateToken, 
  requireManager,
  requireUser,
  verifyRefreshToken 
} = require('../middleware/auth');

// Configuration depuis config.js
const MAX_TENTATIVES = config.auth.maxLoginAttempts;

/**
 * @swagger
 * /api/utilisateurs/config/auth:
 *   get:
 *     summary: Récupérer la configuration d'authentification
 *     tags: [Configuration]
 *     responses:
 *       200:
 *         description: Configuration d'authentification
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthConfig'
 */
router.get('/config/auth', (req, res) => {
  res.json({
    maxLoginAttempts: config.auth.maxLoginAttempts,
    sessionDuration: config.auth.sessionDuration,
    refreshTokenDuration: config.auth.refreshTokenDuration
  });
});

/**
 * @swagger
 * /api/utilisateurs/me:
 *   get:
 *     summary: Récupérer les informations de l'utilisateur connecté
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Informations de l'utilisateur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Utilisateur'
 *       401:
 *         description: Token manquant ou invalide
 *       404:
 *         description: Utilisateur non trouvé
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.nom,
        u.prenom,
        u.tentatives,
        u.bloque,
        u.created_at,
        r.code as role_code,
        r.libelle as role
      FROM utilisateur u
      LEFT JOIN role r ON u.id_role = r.id
      WHERE u.id = $1 OR u.email = $2
    `, [req.user.id, req.user.email]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur récupération profil:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/utilisateurs:
 *   get:
 *     summary: Récupérer tous les utilisateurs (Manager uniquement)
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des utilisateurs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Utilisateur'
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Accès refusé (Manager requis)
 */
router.get('/', authenticateToken, requireManager, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.nom,
        u.prenom,
        u.tentatives,
        u.bloque,
        u.created_at,
        r.code as role_code,
        r.libelle as role
      FROM utilisateur u
      LEFT JOIN role r ON u.id_role = r.id
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur récupération utilisateurs:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/utilisateurs/bloques:
 *   get:
 *     summary: Récupérer les utilisateurs bloqués (Manager uniquement)
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des utilisateurs bloqués
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Utilisateur'
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Accès refusé (Manager requis)
 */
router.get('/bloques', authenticateToken, requireManager, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.nom,
        u.prenom,
        u.tentatives,
        u.bloque,
        u.created_at,
        r.code as role_code,
        r.libelle as role
      FROM utilisateur u
      LEFT JOIN role r ON u.id_role = r.id
      WHERE u.bloque = true
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur récupération utilisateurs bloqués:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/utilisateurs/create:
 *   post:
 *     summary: Créer un utilisateur (Manager uniquement)
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - mot_de_passe
 *             properties:
 *               email:
 *                 type: string
 *               mot_de_passe:
 *                 type: string
 *               nom:
 *                 type: string
 *               prenom:
 *                 type: string
 *               role_code:
 *                 type: string
 *                 enum: [VISITEUR, USER, MANAGER]
 *     responses:
 *       201:
 *         description: Utilisateur créé avec succès
 *       400:
 *         description: Email déjà utilisé
 *       403:
 *         description: Accès refusé (Manager requis)
 */
router.post('/create', authenticateToken, requireManager, async (req, res) => {
  try {
    const { email, mot_de_passe, nom, prenom, role_code } = req.body;
    
    // Vérifier si l'email existe déjà
    const existingUser = await pool.query('SELECT id FROM utilisateur WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }
    
    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(mot_de_passe, salt);
    
    // Récupérer le rôle (par défaut USER si non spécifié)
    const roleToUse = role_code || 'USER';
    const roleResult = await pool.query(`SELECT id FROM role WHERE code = $1`, [roleToUse]);
    const id_role = roleResult.rows[0]?.id || 2;
    
    const result = await pool.query(`
      INSERT INTO utilisateur (email, mot_de_passe, nom, prenom, id_role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, nom, prenom, created_at
    `, [email, hashedPassword, nom, prenom, id_role]);
    
    res.status(201).json({
      message: 'Utilisateur créé avec succès',
      user: { ...result.rows[0], role_code: roleToUse }
    });
  } catch (err) {
    console.error('Erreur création utilisateur:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/utilisateurs/register:
 *   post:
 *     summary: Inscription d'un nouvel utilisateur
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Utilisateur créé avec succès
 *       400:
 *         description: Email déjà utilisé
 *       500:
 *         description: Erreur serveur
 */
router.post('/register', async (req, res) => {
  try {
    const { email, mot_de_passe, nom, prenom } = req.body;
    
    // Vérifier si l'email existe déjà
    const existingUser = await pool.query('SELECT id FROM utilisateur WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }
    
    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(mot_de_passe, salt);
    
    // Récupérer le rôle USER par défaut
    const roleResult = await pool.query(`SELECT id FROM role WHERE code = 'USER'`);
    const id_role = roleResult.rows[0]?.id || 2;
    
    const result = await pool.query(`
      INSERT INTO utilisateur (email, mot_de_passe, nom, prenom, id_role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, nom, prenom, created_at
    `, [email, hashedPassword, nom, prenom, id_role]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur inscription:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/utilisateurs/login:
 *   post:
 *     summary: Connexion utilisateur
 *     description: |
 *       Authentifie un utilisateur et retourne un token JWT.
 *       - Le compte est bloqué après un nombre configurable de tentatives échouées (par défaut 3)
 *       - Le token d'accès expire après une durée configurable (par défaut 1 heure)
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Connexion réussie
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: Email ou mot de passe incorrect
 *       403:
 *         description: Compte bloqué
 *       500:
 *         description: Erreur serveur
 */
router.post('/login', async (req, res) => {
  try {
    const { email, mot_de_passe } = req.body;
    
    console.log('=== LOGIN ATTEMPT ===');
    console.log('Email:', email);
    console.log('Password received:', mot_de_passe ? '***' : 'EMPTY');
    
    // Récupérer l'utilisateur
    const result = await pool.query(`
      SELECT u.*, r.code as role_code, r.libelle as role
      FROM utilisateur u
      LEFT JOIN role r ON u.id_role = r.id
      WHERE u.email = $1
    `, [email]);
    
    console.log('User found in DB:', result.rows.length > 0);
    
    if (result.rows.length === 0) {
      console.log('LOGIN FAILED: User not found');
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    
    const user = result.rows[0];
    console.log('User ID:', user.id);
    console.log('User role:', user.role_code);
    console.log('Password in DB:', user.mot_de_passe ? user.mot_de_passe.substring(0, 10) + '...' : 'NULL');
    console.log('User blocked:', user.bloque);
    
    // Vérifier si l'utilisateur est bloqué
    if (user.bloque) {
      console.log('LOGIN FAILED: User is blocked');
      return res.status(403).json({ 
        error: 'Compte bloqué. Contactez un administrateur.',
        bloque: true
      });
    }
    
    // Vérifier le mot de passe (essayer bcrypt puis comparaison directe)
    let validPassword = false;
    
    // 1. Essayer avec bcrypt (mot de passe hashé)
    try {
      validPassword = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
      console.log('Bcrypt compare result:', validPassword);
    } catch (err) {
      // Si bcrypt échoue (mot de passe non hashé), on continue
      console.log('Bcrypt compare failed:', err.message);
      validPassword = false;
    }
    
    // 2. Si bcrypt échoue, essayer comparaison directe (mot de passe en clair)
    if (!validPassword) {
      validPassword = (mot_de_passe === user.mot_de_passe);
      console.log('Direct compare result:', validPassword);
      console.log('Comparing:', `"${mot_de_passe}" === "${user.mot_de_passe}"`);
    }
    
    console.log('Final password valid:', validPassword);
    
    if (!validPassword) {
      console.log('LOGIN FAILED: Invalid password');
      // Incrémenter les tentatives
      const newTentatives = user.tentatives + 1;
      const doitBloquer = newTentatives >= MAX_TENTATIVES;
      
      await pool.query(
        'UPDATE utilisateur SET tentatives = $1, bloque = $2 WHERE id = $3',
        [newTentatives, doitBloquer, user.id]
      );
      
      if (doitBloquer) {
        return res.status(403).json({ 
          error: `Compte bloqué après ${MAX_TENTATIVES} tentatives échouées.`,
          bloque: true
        });
      }
      
      return res.status(401).json({ 
        error: 'Email ou mot de passe incorrect',
        tentatives_restantes: MAX_TENTATIVES - newTentatives
      });
    }
    
    // Réinitialiser les tentatives après connexion réussie
    await pool.query('UPDATE utilisateur SET tentatives = 0 WHERE id = $1', [user.id]);
    
    // Ne pas renvoyer le mot de passe
    delete user.mot_de_passe;
    
    // Générer les tokens JWT
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    res.json({ 
      message: 'Connexion réussie',
      user: user,
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresIn: config.auth.sessionDuration
    });
  } catch (err) {
    console.error('Erreur connexion:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/utilisateurs/refresh-token:
 *   post:
 *     summary: Rafraîchir le token d'accès
 *     description: Utilise un refresh token valide pour obtenir un nouveau token d'accès
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *     responses:
 *       200:
 *         description: Nouveau token d'accès généré
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 expiresIn:
 *                   type: integer
 *       401:
 *         description: Refresh token invalide ou expiré
 *       403:
 *         description: Compte bloqué
 */
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token requis' });
    }
    
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({ 
        error: 'Refresh token invalide ou expiré',
        code: 'REFRESH_TOKEN_INVALID'
      });
    }
    
    // Récupérer l'utilisateur
    const result = await pool.query(`
      SELECT u.*, r.code as role_code, r.libelle as role
      FROM utilisateur u
      LEFT JOIN role r ON u.id_role = r.id
      WHERE u.id = $1
    `, [decoded.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    const user = result.rows[0];
    
    // Vérifier si l'utilisateur est bloqué
    if (user.bloque) {
      return res.status(403).json({ 
        error: 'Compte bloqué',
        code: 'ACCOUNT_BLOCKED'
      });
    }
    
    // Générer un nouveau token d'accès
    const newAccessToken = generateAccessToken(user);
    
    res.json({
      accessToken: newAccessToken,
      expiresIn: config.auth.sessionDuration
    });
  } catch (err) {
    console.error('Erreur refresh token:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/utilisateurs/me:
 *   get:
 *     summary: Récupérer le profil de l'utilisateur connecté
 *     tags: [Authentification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profil utilisateur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Utilisateur'
 *       401:
 *         description: Token manquant ou invalide
 *       404:
 *         description: Utilisateur non trouvé
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.email, u.nom, u.prenom, u.created_at, r.code as role_code, r.libelle as role
      FROM utilisateur u
      LEFT JOIN role r ON u.id_role = r.id
      WHERE u.id = $1
    `, [req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur récupération profil:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/utilisateurs/{id}/debloquer:
 *   put:
 *     summary: Débloquer un utilisateur (Manager uniquement)
 *     description: Réinitialise le blocage d'un utilisateur et remet le compteur de tentatives à 0
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de l'utilisateur à débloquer
 *     responses:
 *       200:
 *         description: Utilisateur débloqué avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Utilisateur débloqué avec succès"
 *                 user:
 *                   $ref: '#/components/schemas/Utilisateur'
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Accès refusé (Manager requis)
 *       404:
 *         description: Utilisateur non trouvé
 */
router.put('/:id/debloquer', authenticateToken, requireManager, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      UPDATE utilisateur 
      SET bloque = false, tentatives = 0
      WHERE id = $1
      RETURNING id, email, nom, prenom, bloque, tentatives
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    res.json({ 
      message: 'Utilisateur débloqué avec succès',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('Erreur déblocage utilisateur:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/utilisateurs/{id}:
 *   put:
 *     summary: Modifier les informations d'un utilisateur
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de l'utilisateur
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nom:
 *                 type: string
 *               prenom:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Utilisateur modifié
 *       404:
 *         description: Utilisateur non trouvé
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, prenom, email } = req.body;
    
    const result = await pool.query(`
      UPDATE utilisateur 
      SET nom = COALESCE($1, nom),
          prenom = COALESCE($2, prenom),
          email = COALESCE($3, email)
      WHERE id = $4
      RETURNING id, email, nom, prenom, created_at
    `, [nom, prenom, email, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur mise à jour utilisateur:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/utilisateurs/{id}/password:
 *   put:
 *     summary: Changer le mot de passe d'un utilisateur
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de l'utilisateur
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ancien_mot_de_passe
 *               - nouveau_mot_de_passe
 *             properties:
 *               ancien_mot_de_passe:
 *                 type: string
 *               nouveau_mot_de_passe:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Mot de passe modifié avec succès
 *       401:
 *         description: Ancien mot de passe incorrect
 *       404:
 *         description: Utilisateur non trouvé
 */
router.put('/:id/password', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { ancien_mot_de_passe, nouveau_mot_de_passe } = req.body;
    
    // Récupérer l'utilisateur
    const userResult = await pool.query('SELECT mot_de_passe FROM utilisateur WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Vérifier l'ancien mot de passe
    const validPassword = await bcrypt.compare(ancien_mot_de_passe, userResult.rows[0].mot_de_passe);
    if (!validPassword) {
      return res.status(401).json({ error: 'Ancien mot de passe incorrect' });
    }
    
    // Hasher le nouveau mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(nouveau_mot_de_passe, salt);
    
    await pool.query('UPDATE utilisateur SET mot_de_passe = $1 WHERE id = $2', [hashedPassword, id]);
    
    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (err) {
    console.error('Erreur changement mot de passe:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/utilisateurs/config/roles:
 *   get:
 *     summary: Récupérer les rôles disponibles
 *     tags: [Configuration]
 *     responses:
 *       200:
 *         description: Liste des rôles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   code:
 *                     type: string
 *                   libelle:
 *                     type: string
 */
router.get('/config/roles', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM role ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur récupération rôles:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/utilisateurs/{id}/role:
 *   put:
 *     summary: Changer le rôle d'un utilisateur (Manager uniquement)
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de l'utilisateur
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role_code
 *             properties:
 *               role_code:
 *                 type: string
 *                 enum: [VISITEUR, USER, MANAGER]
 *     responses:
 *       200:
 *         description: Rôle modifié avec succès
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Utilisateur ou rôle non trouvé
 */
router.put('/:id/role', authenticateToken, requireManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { role_code } = req.body;
    
    // Vérifier que le rôle existe
    const roleResult = await pool.query('SELECT id FROM role WHERE code = $1', [role_code]);
    if (roleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Rôle non trouvé' });
    }
    
    const id_role = roleResult.rows[0].id;
    
    // Mettre à jour le rôle de l'utilisateur
    const result = await pool.query(`
      UPDATE utilisateur SET id_role = $1 WHERE id = $2
      RETURNING id, email, nom, prenom
    `, [id_role, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    res.json({ 
      message: 'Rôle modifié avec succès',
      user: result.rows[0],
      nouveau_role: role_code
    });
  } catch (err) {
    console.error('Erreur changement rôle:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;module.exports = router;
