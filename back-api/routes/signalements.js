const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET - Récupérer tous les signalements avec détails
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        s.id,
        s.titre,
        s.description,
        s.latitude,
        s.longitude,
        s.surface_m2,
        s.budget,
        s.date_signalement,
        ss.code as statut_code,
        ss.libelle as statut,
        e.nom as entreprise,
        e.contact as entreprise_contact,
        u.email as signale_par,
        u.nom as utilisateur_nom,
        u.prenom as utilisateur_prenom
      FROM signalement s
      LEFT JOIN statut_signalement ss ON s.id_statut_signalement = ss.id
      LEFT JOIN entreprise e ON s.id_entreprise = e.id
      LEFT JOIN utilisateur u ON s.id_utilisateur = u.id
      ORDER BY s.date_signalement DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur récupération signalements:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET - Statistiques récapitulatives
router.get('/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_signalements,
        COALESCE(SUM(surface_m2), 0) as surface_totale,
        COALESCE(SUM(budget), 0) as budget_total,
        COUNT(CASE WHEN ss.code = 'TERMINE' THEN 1 END) as termines,
        COUNT(CASE WHEN ss.code = 'EN_COURS' THEN 1 END) as en_cours,
        COUNT(CASE WHEN ss.code = 'NOUVEAU' THEN 1 END) as nouveaux
      FROM signalement s
      LEFT JOIN statut_signalement ss ON s.id_statut_signalement = ss.id
    `);
    
    const stats = result.rows[0];
    const total = parseInt(stats.total_signalements) || 0;
    const termines = parseInt(stats.termines) || 0;
    const avancement = total > 0 ? Math.round((termines / total) * 100) : 0;
    
    res.json({
      total_signalements: total,
      surface_totale: parseFloat(stats.surface_totale) || 0,
      budget_total: parseFloat(stats.budget_total) || 0,
      termines: termines,
      en_cours: parseInt(stats.en_cours) || 0,
      nouveaux: parseInt(stats.nouveaux) || 0,
      avancement_pourcentage: avancement
    });
  } catch (err) {
    console.error('Erreur récupération stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET - Récupérer un signalement par ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT 
        s.*,
        ss.code as statut_code,
        ss.libelle as statut,
        e.nom as entreprise,
        e.contact as entreprise_contact
      FROM signalement s
      LEFT JOIN statut_signalement ss ON s.id_statut_signalement = ss.id
      LEFT JOIN entreprise e ON s.id_entreprise = e.id
      WHERE s.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Signalement non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur récupération signalement:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST - Créer un nouveau signalement
router.post('/', async (req, res) => {
  try {
    const { titre, description, latitude, longitude, surface_m2, budget, id_utilisateur, id_entreprise } = req.body;
    
    // Récupérer l'ID du statut "NOUVEAU"
    const statutResult = await pool.query(
      `SELECT id FROM statut_signalement WHERE code = 'NOUVEAU'`
    );
    const id_statut = statutResult.rows[0]?.id || 1;
    
    const result = await pool.query(`
      INSERT INTO signalement (titre, description, latitude, longitude, surface_m2, budget, id_statut_signalement, id_utilisateur, id_entreprise)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [titre, description, latitude, longitude, surface_m2, budget, id_statut, id_utilisateur, id_entreprise]);
    
    // Ajouter l'historique du statut
    await pool.query(`
      INSERT INTO signalement_statut (id_signalement, id_statut_signalement)
      VALUES ($1, $2)
    `, [result.rows[0].id, id_statut]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur création signalement:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT - Mettre à jour un signalement (Manager)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { titre, description, surface_m2, budget, id_statut_signalement, id_entreprise } = req.body;
    
    // Récupérer le statut actuel
    const currentResult = await pool.query('SELECT id_statut_signalement FROM signalement WHERE id = $1', [id]);
    const currentStatut = currentResult.rows[0]?.id_statut_signalement;
    
    const result = await pool.query(`
      UPDATE signalement 
      SET titre = COALESCE($1, titre),
          description = COALESCE($2, description),
          surface_m2 = COALESCE($3, surface_m2),
          budget = COALESCE($4, budget),
          id_statut_signalement = COALESCE($5, id_statut_signalement),
          id_entreprise = COALESCE($6, id_entreprise)
      WHERE id = $7
      RETURNING *
    `, [titre, description, surface_m2, budget, id_statut_signalement, id_entreprise, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Signalement non trouvé' });
    }
    
    // Si le statut a changé, ajouter à l'historique
    if (id_statut_signalement && id_statut_signalement !== currentStatut) {
      await pool.query(`
        INSERT INTO signalement_statut (id_signalement, id_statut_signalement)
        VALUES ($1, $2)
      `, [id, id_statut_signalement]);
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur mise à jour signalement:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Supprimer un signalement
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Supprimer d'abord l'historique des statuts
    await pool.query('DELETE FROM signalement_statut WHERE id_signalement = $1', [id]);
    
    const result = await pool.query('DELETE FROM signalement WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Signalement non trouvé' });
    }
    res.json({ message: 'Signalement supprimé', signalement: result.rows[0] });
  } catch (err) {
    console.error('Erreur suppression signalement:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET - Récupérer tous les statuts disponibles
router.get('/config/statuts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM statut_signalement ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur récupération statuts:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET - Récupérer toutes les entreprises
router.get('/config/entreprises', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM entreprise ORDER BY nom');
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur récupération entreprises:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST - Créer une entreprise
router.post('/config/entreprises', async (req, res) => {
  try {
    const { nom, contact } = req.body;
    const result = await pool.query(
      'INSERT INTO entreprise (nom, contact) VALUES ($1, $2) RETURNING *',
      [nom, contact]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur création entreprise:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
