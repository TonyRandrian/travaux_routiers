const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const bcrypt = require('bcryptjs');

// Configuration par défaut
const MAX_TENTATIVES = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 3;

// GET - Récupérer tous les utilisateurs (pour Manager)
router.get('/', async (req, res) => {
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

// GET - Récupérer les utilisateurs bloqués
router.get('/bloques', async (req, res) => {
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

// POST - Inscription utilisateur
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

// POST - Connexion utilisateur
router.post('/login', async (req, res) => {
  try {
    const { email, mot_de_passe } = req.body;
    
    // Récupérer l'utilisateur
    const result = await pool.query(`
      SELECT u.*, r.code as role_code, r.libelle as role
      FROM utilisateur u
      LEFT JOIN role r ON u.id_role = r.id
      WHERE u.email = $1
    `, [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    
    const user = result.rows[0];
    
    // Vérifier si l'utilisateur est bloqué
    if (user.bloque) {
      return res.status(403).json({ 
        error: 'Compte bloqué. Contactez un administrateur.',
        bloque: true
      });
    }
    
    // Vérifier le mot de passe
    const validPassword = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
    
    if (!validPassword) {
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
    
    res.json({ 
      message: 'Connexion réussie',
      user: user
    });
  } catch (err) {
    console.error('Erreur connexion:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT - Débloquer un utilisateur (Manager)
router.put('/:id/debloquer', async (req, res) => {
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

// PUT - Modifier les informations d'un utilisateur
router.put('/:id', async (req, res) => {
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

// PUT - Changer le mot de passe
router.put('/:id/password', async (req, res) => {
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

// GET - Récupérer les rôles disponibles
router.get('/config/roles', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM role ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur récupération rôles:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
