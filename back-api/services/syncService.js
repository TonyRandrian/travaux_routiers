const pool = require('../config/database');
const { getFirestore, isFirebaseAvailable } = require('../config/firebase');
const bcrypt = require('bcryptjs');

// Collection Firestore pour les signalements
const SIGNALEMENTS_COLLECTION = 'signalements';
const USERS_COLLECTION = 'users';
const SYNC_META_COLLECTION = 'sync_metadata';

/**
 * Service de synchronisation Firestore <-> PostgreSQL
 */
class SyncService {
  
  /**
   * Vérifier si la synchronisation est disponible
   */
  static isAvailable() {
    return isFirebaseAvailable();
  }

  /**
   * Récupérer les statuts depuis PostgreSQL
   */
  static async getStatuts() {
    const result = await pool.query('SELECT * FROM statut_signalement');
    return result.rows.reduce((acc, row) => {
      acc[row.code] = row.id;
      acc[row.id] = row.code;
      return acc;
    }, {});
  }

  /**
   * Récupérer les entreprises depuis PostgreSQL
   */
  static async getEntreprises() {
    const result = await pool.query('SELECT * FROM entreprise');
    return result.rows.reduce((acc, row) => {
      acc[row.nom] = row.id;
      acc[row.id] = row.nom;
      return acc;
    }, {});
  }

  /**
   * Synchroniser les signalements depuis Firestore vers PostgreSQL
   * (Récupérer les nouveaux signalements créés depuis l'app mobile)
   */
  static async syncFromFirestore() {
    if (!this.isAvailable()) {
      throw new Error('Firebase non configuré');
    }

    const db = getFirestore();
    const results = {
      imported: 0,
      updated: 0,
      errors: [],
      details: []
    };

    try {
      // Récupérer tous les signalements de Firestore
      const snapshot = await db.collection(SIGNALEMENTS_COLLECTION).get();
      
      if (snapshot.empty) {
        return { ...results, message: 'Aucun signalement dans Firestore' };
      }

      const statuts = await this.getStatuts();
      const entreprises = await this.getEntreprises();

      for (const doc of snapshot.docs) {
        try {
          const firestoreData = doc.data();
          const firestoreId = doc.id;

          // Vérifier si ce signalement existe déjà (via firebase_id)
          const existingResult = await pool.query(
            'SELECT id FROM signalement WHERE firebase_id = $1',
            [firestoreId]
          );

          // Mapper les données Firestore vers PostgreSQL
          const pgData = this.mapFirestoreToPostgres(firestoreData, firestoreId, statuts, entreprises);

          if (existingResult.rows.length > 0) {
            // Mise à jour si le signalement existe
            // Ne pas écraser les données modifiées côté serveur (statut, budget, etc.)
            // On ne met à jour que si last_sync_from_firebase est plus ancien
            results.details.push({
              action: 'skipped',
              firebase_id: firestoreId,
              reason: 'Déjà synchronisé'
            });
          } else {
            // Créer un nouveau signalement
            const insertResult = await pool.query(`
              INSERT INTO signalement (
                titre, description, latitude, longitude, 
                surface_m2, budget, id_statut_signalement, 
                id_utilisateur, id_entreprise, firebase_id, 
                date_signalement, synced_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
              RETURNING id
            `, [
              pgData.titre,
              pgData.description,
              pgData.latitude,
              pgData.longitude,
              pgData.surface_m2,
              pgData.budget,
              pgData.id_statut_signalement,
              pgData.id_utilisateur,
              pgData.id_entreprise,
              firestoreId,
              pgData.date_signalement
            ]);

            // Ajouter l'historique du statut
            if (insertResult.rows[0]?.id) {
              await pool.query(`
                INSERT INTO signalement_statut (id_signalement, id_statut_signalement)
                VALUES ($1, $2)
              `, [insertResult.rows[0].id, pgData.id_statut_signalement || statuts['NOUVEAU']]);
            }

            results.imported++;
            results.details.push({
              action: 'imported',
              firebase_id: firestoreId,
              pg_id: insertResult.rows[0]?.id,
              titre: pgData.titre
            });
          }
        } catch (docError) {
          results.errors.push({
            firebase_id: doc.id,
            error: docError.message
          });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Erreur synchronisation depuis Firestore: ${error.message}`);
    }
  }

  /**
   * Synchroniser les signalements depuis PostgreSQL vers Firestore
   * (Envoyer les mises à jour vers l'app mobile)
   */
  static async syncToFirestore() {
    if (!this.isAvailable()) {
      throw new Error('Firebase non configuré');
    }

    const db = getFirestore();
    const results = {
      exported: 0,
      updated: 0,
      errors: [],
      details: []
    };

    try {
      // Récupérer tous les signalements de PostgreSQL avec leurs détails
      const pgResult = await pool.query(`
        SELECT 
          s.id,
          s.titre,
          s.description,
          s.latitude,
          s.longitude,
          s.surface_m2,
          s.budget,
          s.date_signalement,
          s.firebase_id,
          s.synced_at,
          ss.code as statut_code,
          ss.libelle as statut,
          e.nom as entreprise,
          e.contact as entreprise_contact,
          u.email as utilisateur_email
        FROM signalement s
        LEFT JOIN statut_signalement ss ON s.id_statut_signalement = ss.id
        LEFT JOIN entreprise e ON s.id_entreprise = e.id
        LEFT JOIN utilisateur u ON s.id_utilisateur = u.id
        ORDER BY s.date_signalement DESC
      `);

      const batch = db.batch();
      let batchCount = 0;
      const BATCH_LIMIT = 500; // Limite Firestore

      for (const row of pgResult.rows) {
        try {
          // Mapper les données PostgreSQL vers Firestore
          const firestoreData = this.mapPostgresToFirestore(row);

          let docRef;
          if (row.firebase_id) {
            // Mettre à jour le document existant
            docRef = db.collection(SIGNALEMENTS_COLLECTION).doc(row.firebase_id);
            batch.set(docRef, firestoreData, { merge: true });
            results.updated++;
            results.details.push({
              action: 'updated',
              pg_id: row.id,
              firebase_id: row.firebase_id,
              titre: row.titre
            });
          } else {
            // Créer un nouveau document
            docRef = db.collection(SIGNALEMENTS_COLLECTION).doc();
            batch.set(docRef, firestoreData);
            
            // Mettre à jour le firebase_id dans PostgreSQL
            await pool.query(
              'UPDATE signalement SET firebase_id = $1, synced_at = NOW() WHERE id = $2',
              [docRef.id, row.id]
            );

            results.exported++;
            results.details.push({
              action: 'exported',
              pg_id: row.id,
              firebase_id: docRef.id,
              titre: row.titre
            });
          }

          batchCount++;

          // Commit par lots de 500 (limite Firestore)
          if (batchCount >= BATCH_LIMIT) {
            await batch.commit();
            batchCount = 0;
          }
        } catch (rowError) {
          results.errors.push({
            pg_id: row.id,
            error: rowError.message
          });
        }
      }

      // Commit final si des documents restants
      if (batchCount > 0) {
        await batch.commit();
      }

      // Mettre à jour les métadonnées de synchronisation
      await db.collection(SYNC_META_COLLECTION).doc('last_sync').set({
        timestamp: new Date().toISOString(),
        exported: results.exported,
        updated: results.updated,
        total: pgResult.rows.length
      });

      return results;
    } catch (error) {
      throw new Error(`Erreur synchronisation vers Firestore: ${error.message}`);
    }
  }

  /**
   * Synchronisation bidirectionnelle complète
   */
  static async syncAll() {
    const results = {
      fromFirestore: null,
      toFirestore: null,
      users: null,
      timestamp: new Date().toISOString()
    };

    // 1. D'abord récupérer depuis Firestore (nouveaux signalements mobiles)
    try {
      results.fromFirestore = await this.syncFromFirestore();
    } catch (error) {
      results.fromFirestore = { error: error.message };
    }

    // 2. Ensuite envoyer vers Firestore (mises à jour serveur)
    try {
      results.toFirestore = await this.syncToFirestore();
    } catch (error) {
      results.toFirestore = { error: error.message };
    }

    // 3. Synchroniser les utilisateurs
    try {
      results.users = await this.syncUsers();
    } catch (error) {
      results.users = { error: error.message };
    }

    return results;
  }

  /**
   * Synchroniser les utilisateurs entre Firebase et PostgreSQL
   */
  static async syncUsers() {
    if (!this.isAvailable()) {
      throw new Error('Firebase non configuré');
    }

    const db = getFirestore();
    const results = {
      imported: 0,
      exported: 0,
      errors: [],
      details: []
    };

    try {
      // 1. Récupérer les utilisateurs de Firestore
      const snapshot = await db.collection(USERS_COLLECTION).get();
      
      // Récupérer le rôle USER par défaut
      const roleResult = await pool.query(`SELECT id FROM role WHERE code = 'USER'`);
      const defaultRoleId = roleResult.rows[0]?.id || 2;

      for (const doc of snapshot.docs) {
        try {
          const firestoreUser = doc.data();
          const firebaseUid = doc.id;
          const email = firestoreUser.email;

          if (!email) continue;

          // Vérifier si l'utilisateur existe déjà dans PostgreSQL
          const existingResult = await pool.query(
            'SELECT id FROM utilisateur WHERE email = $1',
            [email]
          );

          if (existingResult.rows.length === 0) {
            // Créer l'utilisateur dans PostgreSQL
            // Générer un mot de passe par défaut hashé (l'utilisateur utilise Firebase pour se connecter)
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('firebase_user_' + firebaseUid.substring(0, 8), salt);
            
            const displayName = firestoreUser.displayName || '';
            const nameParts = displayName.split(' ');
            const prenom = nameParts[0] || '';
            const nom = nameParts.slice(1).join(' ') || '';

            await pool.query(`
              INSERT INTO utilisateur (email, mot_de_passe, nom, prenom, id_role, firebase_uid)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [email, hashedPassword, nom, prenom, defaultRoleId, firebaseUid]);

            results.imported++;
            results.details.push({
              action: 'imported',
              email: email,
              source: 'firebase'
            });
          }
        } catch (userError) {
          results.errors.push({
            email: doc.data().email,
            error: userError.message
          });
        }
      }

      // 2. Exporter les utilisateurs PostgreSQL vers Firestore (sauf ceux déjà liés)
      const pgUsers = await pool.query(`
        SELECT u.*, r.code as role_code 
        FROM utilisateur u
        LEFT JOIN role r ON u.id_role = r.id
        WHERE u.firebase_uid IS NULL
      `);

      for (const user of pgUsers.rows) {
        try {
          // Créer un document dans Firestore pour référence
          const userDocRef = db.collection(USERS_COLLECTION).doc(`pg_${user.id}`);
          await userDocRef.set({
            email: user.email,
            displayName: `${user.prenom || ''} ${user.nom || ''}`.trim() || user.email,
            role: user.role_code || 'USER',
            pg_id: user.id,
            createdAt: user.created_at ? user.created_at.toISOString() : new Date().toISOString(),
            syncedFromServer: true
          }, { merge: true });

          // Mettre à jour le firebase_uid dans PostgreSQL
          await pool.query(
            'UPDATE utilisateur SET firebase_uid = $1 WHERE id = $2',
            [`pg_${user.id}`, user.id]
          );

          results.exported++;
          results.details.push({
            action: 'exported',
            email: user.email,
            source: 'postgresql'
          });
        } catch (exportError) {
          results.errors.push({
            email: user.email,
            error: exportError.message
          });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Erreur synchronisation utilisateurs: ${error.message}`);
    }
  }

  /**
   * Mapper les données Firestore vers le format PostgreSQL
   */
  static mapFirestoreToPostgres(firestoreData, firestoreId, statuts, entreprises) {
    return {
      titre: firestoreData.titre || firestoreData.title || 'Sans titre',
      description: firestoreData.description || '',
      latitude: firestoreData.latitude || firestoreData.lat || 0,
      longitude: firestoreData.longitude || firestoreData.lng || 0,
      surface_m2: firestoreData.surface_m2 || firestoreData.surface || null,
      budget: firestoreData.budget || null,
      id_statut_signalement: statuts[firestoreData.statut_code] || statuts['NOUVEAU'] || 1,
      id_utilisateur: null, // Sera lié plus tard si nécessaire
      id_entreprise: firestoreData.entreprise ? (entreprises[firestoreData.entreprise] || null) : null,
      date_signalement: firestoreData.date_signalement || firestoreData.createdAt || new Date().toISOString(),
      firebase_id: firestoreId
    };
  }

  /**
   * Mapper les données PostgreSQL vers le format Firestore
   */
  static mapPostgresToFirestore(pgData) {
    return {
      titre: pgData.titre || 'Sans titre',
      description: pgData.description || '',
      latitude: parseFloat(pgData.latitude) || 0,
      longitude: parseFloat(pgData.longitude) || 0,
      surface_m2: pgData.surface_m2 ? parseFloat(pgData.surface_m2) : null,
      budget: pgData.budget ? parseFloat(pgData.budget) : null,
      statut_code: pgData.statut_code || 'NOUVEAU',
      statut: pgData.statut || 'Nouveau',
      entreprise: pgData.entreprise || null,
      entreprise_contact: pgData.entreprise_contact || null,
      utilisateur_email: pgData.utilisateur_email || null,
      date_signalement: pgData.date_signalement ? pgData.date_signalement.toISOString() : new Date().toISOString(),
      pg_id: pgData.id,
      updatedAt: new Date().toISOString(),
      syncedFromServer: true
    };
  }

  /**
   * Récupérer le statut de la dernière synchronisation
   */
  static async getLastSyncStatus() {
    if (!this.isAvailable()) {
      return { available: false, message: 'Firebase non configuré' };
    }

    try {
      const db = getFirestore();
      const doc = await db.collection(SYNC_META_COLLECTION).doc('last_sync').get();
      
      if (doc.exists) {
        return {
          available: true,
          lastSync: doc.data()
        };
      }
      
      return {
        available: true,
        lastSync: null,
        message: 'Aucune synchronisation effectuée'
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }
}

module.exports = SyncService;
