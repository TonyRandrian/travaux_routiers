const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireManager, optionalAuth, requireUser } = require('../middleware/auth');
const NotificationService = require('../services/notificationService');

// ============================================
// ROUTES PUBLIQUES (Visiteurs + Utilisateurs)
// ============================================

// GET - Récupérer tous les signalements avec détails (accessible à tous)
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
        s.id_statut_signalement,
        s.id_entreprise,
        s.pourcentage_completion,
        s.type_reparation,
        ss.code as statut_code,
        ss.libelle as statut,
        e.nom as entreprise,
        e.contact as entreprise_contact,
        u.email as signale_par,
        u.nom as utilisateur_nom,
        u.prenom as utilisateur_prenom,
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'id', p.id,
              'url', p.url,
              'nom_fichier', p.nom_fichier,
              'ordre', p.ordre
            ) ORDER BY p.ordre
          )
          FROM photo_signalement p
          WHERE p.id_signalement = s.id
          ), '[]'
        ) as photos
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

// GET - Statistiques de traitement par entreprise (Dashboard)
// IMPORTANT: Cette route doit être AVANT /:id pour ne pas être interceptée
router.get('/statistiques/traitement', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        entreprise_id,
        entreprise_nom,
        nombre_signalements_termines,
        ROUND(delai_moyen_jours::numeric, 2) as delai_moyen_jours,
        delai_min_jours,
        delai_max_jours,
        budget_total,
        surface_totale_m2,
        ROUND(avancement_moyen::numeric, 2) as avancement_moyen
      FROM v_statistiques_traitement
      ORDER BY entreprise_nom
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur récupération statistiques traitement:', err);
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

// ============================================
// ROUTES PROTÉGÉES (Utilisateurs connectés)
// ============================================

// POST - Créer un nouveau signalement (utilisateurs connectés)
router.post('/', authenticateToken, requireUser, async (req, res) => {
  try {
    const { titre, description, latitude, longitude, surface_m2, budget, type_reparation, id_utilisateur, id_entreprise } = req.body;
    
    // Récupérer l'ID du statut "NOUVEAU"
    const statutResult = await pool.query(
      `SELECT id FROM statut_signalement WHERE code = 'NOUVEAU'`
    );
    const id_statut = statutResult.rows[0]?.id || 1;
    
    // Nouveau signalement = 0% d'avancement
    const pourcentage_completion = 0;
    // Niveau par défaut = 0 si non fourni
    const niveau = type_reparation !== undefined ? type_reparation : 0;
    
    const result = await pool.query(`
      INSERT INTO signalement (titre, description, latitude, longitude, surface_m2, budget, type_reparation, id_statut_signalement, id_utilisateur, id_entreprise, pourcentage_completion)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [titre, description, latitude, longitude, surface_m2, budget, niveau, id_statut, id_utilisateur, id_entreprise, pourcentage_completion]);
    
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

// ============================================
// ROUTES MANAGER UNIQUEMENT
// ============================================

// PUT - Mettre à jour un signalement (Manager uniquement)
router.put('/:id', authenticateToken, requireManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { titre, description, surface_m2, budget, id_statut_signalement, id_entreprise, type_reparation } = req.body;
    
    // Récupérer le statut actuel et les infos du signalement
    const currentResult = await pool.query(`
      SELECT s.id_statut_signalement, s.titre, s.firebase_id, u.email as utilisateur_email
      FROM signalement s
      LEFT JOIN utilisateur u ON s.id_utilisateur = u.id
      WHERE s.id = $1
    `, [id]);
    const currentStatut = currentResult.rows[0]?.id_statut_signalement;
    const signalementTitre = currentResult.rows[0]?.titre;
    let utilisateurEmail = currentResult.rows[0]?.utilisateur_email;
    const firebaseId = currentResult.rows[0]?.firebase_id;
    
    // [COMMENTÉ] Les notifications ne doivent pas être envoyées ici.
    // Le projet web utilise uniquement la base locale (PostgreSQL).
    // Les échanges avec Firebase se font uniquement via les boutons de synchro.
    // // Fallback: si pas d'email dans PostgreSQL, chercher dans Firestore
    // if (!utilisateurEmail && firebaseId) {
    //   try {
    //     const { getFirestore, isFirebaseAvailable } = require('../config/firebase');
    //     if (isFirebaseAvailable()) {
    //       const db = getFirestore();
    //       const fsDoc = await db.collection('signalements').doc(firebaseId).get();
    //       if (fsDoc.exists) {
    //         const fsData = fsDoc.data();
    //         utilisateurEmail = fsData.utilisateur_email || (fsData.utilisateur && fsData.utilisateur.email) || null;
    //         if (utilisateurEmail) {
    //           console.log('[PUT NOTIF] Fallback email depuis Firestore:', utilisateurEmail);
    //         }
    //       }
    //     }
    //   } catch (fbErr) {
    //     console.error('[PUT NOTIF] Erreur fallback email Firestore:', fbErr.message);
    //   }
    // }
    
    // === Auto-calcul du budget si type_reparation est fourni ===
    let computedBudget = budget; // utilise la valeur fournie par défaut
    if (type_reparation !== undefined && type_reparation !== null) {
      // Récupérer les infos du signalement pour surface_m2 et date_signalement
      const sigInfo = await pool.query(
        'SELECT surface_m2, date_signalement FROM signalement WHERE id = $1', [id]
      );
      if (sigInfo.rows.length > 0) {
        const surface = sigInfo.rows[0].surface_m2 || 0;
        const dateSignalement = sigInfo.rows[0].date_signalement || new Date().toISOString().split('T')[0];
        
        // Chercher le prix_m2 applicable selon la date du signalement
        const prixResult = await pool.query(
          `SELECT prix FROM config_prix_m2
           WHERE date_debut <= $1
           ORDER BY date_debut DESC
           LIMIT 1`,
          [dateSignalement]
        );
        if (prixResult.rows.length > 0) {
          const prix_m2 = parseFloat(prixResult.rows[0].prix);
          computedBudget = prix_m2 * parseInt(type_reparation) * surface;
        }
      }
    }

    // Déterminer le pourcentage d'avancement selon le statut
    let pourcentage_completion = null;
    let newStatutCode = null;
    if (id_statut_signalement) {
      const statutInfo = await pool.query('SELECT code FROM statut_signalement WHERE id = $1', [id_statut_signalement]);
      newStatutCode = statutInfo.rows[0]?.code;
      
      if (newStatutCode === 'NOUVEAU') {
        pourcentage_completion = 0;
      } else if (newStatutCode === 'EN_COURS') {
        pourcentage_completion = 50;
      } else if (newStatutCode === 'TERMINE') {
        pourcentage_completion = 100;
      }
    }
    
    // Récupérer le nom de l'entreprise si assignée
    let entrepriseNom = null;
    if (id_entreprise) {
      const entrepriseResult = await pool.query('SELECT nom FROM entreprise WHERE id = $1', [id_entreprise]);
      entrepriseNom = entrepriseResult.rows[0]?.nom;
    }
    
    const result = await pool.query(`
      UPDATE signalement 
      SET titre = COALESCE($1, titre),
          description = COALESCE($2, description),
          surface_m2 = COALESCE($3, surface_m2),
          budget = COALESCE($4, budget),
          id_statut_signalement = COALESCE($5, id_statut_signalement),
          id_entreprise = COALESCE($6, id_entreprise),
          pourcentage_completion = COALESCE($7, pourcentage_completion),
          type_reparation = COALESCE($9, type_reparation)
      WHERE id = $8
      RETURNING *
    `, [titre, description, surface_m2, computedBudget, id_statut_signalement, id_entreprise, pourcentage_completion, id, type_reparation]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Signalement non trouvé' });
    }
    
    // Si le statut a changé, ajouter à l'historique et envoyer une notification
    if (id_statut_signalement && id_statut_signalement !== currentStatut) {
      await pool.query(`
        INSERT INTO signalement_statut (id_signalement, id_statut_signalement)
        VALUES ($1, $2)
      `, [id, id_statut_signalement]);
      
      // [COMMENTÉ] Les notifications sont envoyées uniquement lors de la synchro (boutons Exporter/Synchroniser).
      // Le PUT ne fait que modifier la base locale PostgreSQL, pas d'échange Firebase ici.
      // // Envoyer une notification push à l'utilisateur
      // if (utilisateurEmail && newStatutCode && newStatutCode !== 'NOUVEAU') {
      //   try {
      //     console.log('[PUT NOTIF] Envoi notification à', utilisateurEmail, 'statut:', newStatutCode, 'entreprise:', entrepriseNom);
      //     const notifResult = await NotificationService.notifyStatusChange(
      //       utilisateurEmail,
      //       { id, titre: signalementTitre || titre },
      //       newStatutCode,
      //       entrepriseNom
      //     );
      //     console.log('[PUT NOTIF] Résultat:', JSON.stringify(notifResult));
      //   } catch (notifError) {
      //     console.error('[PUT NOTIF] ❌ Erreur envoi notification:', notifError);
      //     // Ne pas bloquer la mise à jour si la notification échoue
      //   }
      // } else {
      //   console.log('[PUT NOTIF] Notification non envoyée - email:', utilisateurEmail, 'statut:', newStatutCode);
      // }
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur mise à jour signalement:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Supprimer un signalement (Manager uniquement)
router.delete('/:id', authenticateToken, requireManager, async (req, res) => {
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

// ============================================
// ROUTES DE CONFIGURATION (Publiques en lecture)
// ============================================

// GET - Récupérer le prix au m² applicable pour une date donnée
router.get('/config/prix-m2', async (req, res) => {
  try {
    const { date } = req.query; // format YYYY-MM-DD
    let queryDate = date || new Date().toISOString().split('T')[0];
    
    const result = await pool.query(
      `SELECT prix FROM config_prix_m2
       WHERE date_debut <= $1
       ORDER BY date_debut DESC
       LIMIT 1`,
      [queryDate]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Aucun prix configuré pour cette date' });
    }
    
    res.json({ prix_m2: parseFloat(result.rows[0].prix), date_reference: queryDate });
  } catch (err) {
    console.error('Erreur récupération prix m²:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET - Récupérer tous les statuts disponibles (public)
router.get('/config/statuts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM statut_signalement ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur récupération statuts:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET - Récupérer toutes les entreprises (public)
router.get('/config/entreprises', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM entreprise ORDER BY nom');
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur récupération entreprises:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST - Créer une entreprise (Manager uniquement)
router.post('/config/entreprises', authenticateToken, requireManager, async (req, res) => {
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

// ============================================
// ROUTES CONFIG PRIX M2
// ============================================

// GET - Récupérer tous les prix m² (public)
router.get('/config/prix-m2', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM config_prix_m2 ORDER BY date_debut DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur récupération prix m²:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST - Ajouter un prix m² (Manager uniquement)
router.post('/config/prix-m2', authenticateToken, requireManager, async (req, res) => {
  try {
    const { prix, date_debut } = req.body;
    if (!prix || !date_debut) {
      return res.status(400).json({ error: 'Le prix et la date de début sont requis' });
    }
    const result = await pool.query(
      'INSERT INTO config_prix_m2 (prix, date_debut) VALUES ($1, $2) RETURNING *',
      [prix, date_debut]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur création prix m²:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Supprimer un prix m² (Manager uniquement)
router.delete('/config/prix-m2/:id', authenticateToken, requireManager, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM config_prix_m2 WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prix non trouvé' });
    }
    res.json({ message: 'Prix supprimé', data: result.rows[0] });
  } catch (err) {
    console.error('Erreur suppression prix m²:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
