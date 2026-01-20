const express = require('express');
const router = express.Router();
const SyncService = require('../services/syncService');
const { authenticateToken, requireManager } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Synchronisation
 *   description: API de synchronisation Firestore <-> PostgreSQL
 */

/**
 * @swagger
 * /api/sync/status:
 *   get:
 *     summary: Vérifier le statut de la synchronisation
 *     tags: [Synchronisation]
 *     responses:
 *       200:
 *         description: Statut de la synchronisation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available:
 *                   type: boolean
 *                 lastSync:
 *                   type: object
 */
router.get('/status', async (req, res) => {
  try {
    const status = await SyncService.getLastSyncStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/sync/from-firestore:
 *   post:
 *     summary: Synchroniser depuis Firestore vers PostgreSQL (Manager uniquement)
 *     description: Récupère les nouveaux signalements créés depuis l'application mobile
 *     tags: [Synchronisation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Résultat de la synchronisation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 imported:
 *                   type: integer
 *                 updated:
 *                   type: integer
 *                 errors:
 *                   type: array
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès refusé (Manager requis)
 *       503:
 *         description: Firebase non configuré
 */
router.post('/from-firestore', authenticateToken, requireManager, async (req, res) => {
  try {
    if (!SyncService.isAvailable()) {
      return res.status(503).json({ 
        error: 'Firebase non configuré',
        message: 'Veuillez configurer les credentials Firebase dans les variables d\'environnement'
      });
    }

    const results = await SyncService.syncFromFirestore();
    res.json({
      success: true,
      message: `Synchronisation depuis Firestore terminée`,
      results
    });
  } catch (error) {
    console.error('Erreur sync from Firestore:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/sync/to-firestore:
 *   post:
 *     summary: Synchroniser depuis PostgreSQL vers Firestore (Manager uniquement)
 *     description: Envoie les mises à jour vers Firebase pour l'application mobile
 *     tags: [Synchronisation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Résultat de la synchronisation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exported:
 *                   type: integer
 *                 updated:
 *                   type: integer
 *                 errors:
 *                   type: array
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès refusé (Manager requis)
 *       503:
 *         description: Firebase non configuré
 */
router.post('/to-firestore', authenticateToken, requireManager, async (req, res) => {
  try {
    if (!SyncService.isAvailable()) {
      return res.status(503).json({ 
        error: 'Firebase non configuré',
        message: 'Veuillez configurer les credentials Firebase dans les variables d\'environnement'
      });
    }

    const results = await SyncService.syncToFirestore();
    res.json({
      success: true,
      message: `Synchronisation vers Firestore terminée`,
      results
    });
  } catch (error) {
    console.error('Erreur sync to Firestore:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/sync/all:
 *   post:
 *     summary: Synchronisation bidirectionnelle complète (Manager uniquement)
 *     description: |
 *       Effectue une synchronisation bidirectionnelle :
 *       1. Récupère les nouveaux signalements depuis Firestore (mobile)
 *       2. Envoie les mises à jour vers Firestore (pour le mobile)
 *     tags: [Synchronisation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Résultat de la synchronisation complète
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 fromFirestore:
 *                   type: object
 *                 toFirestore:
 *                   type: object
 *                 timestamp:
 *                   type: string
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès refusé (Manager requis)
 *       503:
 *         description: Firebase non configuré
 */
router.post('/all', authenticateToken, requireManager, async (req, res) => {
  try {
    if (!SyncService.isAvailable()) {
      return res.status(503).json({ 
        error: 'Firebase non configuré',
        message: 'Veuillez configurer les credentials Firebase dans les variables d\'environnement'
      });
    }

    const results = await SyncService.syncAll();
    
    const totalImported = results.fromFirestore?.imported || 0;
    const totalExported = results.toFirestore?.exported || 0;
    const totalUpdated = (results.fromFirestore?.updated || 0) + (results.toFirestore?.updated || 0);

    res.json({
      success: true,
      message: `Synchronisation complète terminée: ${totalImported} importés, ${totalExported} exportés, ${totalUpdated} mis à jour`,
      results
    });
  } catch (error) {
    console.error('Erreur sync all:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
