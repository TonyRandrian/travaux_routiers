const pool = require('../config/database');
const { getFirestore, isFirebaseAvailable } = require('../config/firebase');

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
                date_signalement, pourcentage_completion, synced_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
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
              pgData.date_signalement,
              pgData.pourcentage_completion || 0
            ]);

            // Ajouter l'historique du statut
            if (insertResult.rows[0]?.id) {
              await pool.query(`
                INSERT INTO signalement_statut (id_signalement, id_statut_signalement)
                VALUES ($1, $2)
              `, [insertResult.rows[0].id, pgData.id_statut_signalement || statuts['NOUVEAU']]);

              // Synchroniser les photos si présentes
              if (pgData.photos && pgData.photos.length > 0) {
                await this.syncPhotosFromFirestore(insertResult.rows[0].id, pgData.photos);
              }
            }

            results.imported++;
            results.details.push({
              action: 'imported',
              firebase_id: firestoreId,
              pg_id: insertResult.rows[0]?.id,
              titre: pgData.titre,
              photos_count: pgData.photos?.length || 0
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
          s.pourcentage_completion,
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
   * 1. Import depuis Firebase (signalements + utilisateurs)
   * 2. Export vers Firebase (signalements + utilisateurs)
   */
  static async syncAll() {
    const results = {
      fromFirestore: null,
      toFirestore: null,
      usersImport: null,
      usersExport: null,
      timestamp: new Date().toISOString()
    };

    // 1. D'abord importer depuis Firebase (nouveaux signalements et utilisateurs mobiles)
    try {
      results.fromFirestore = await this.syncFromFirestore();
    } catch (error) {
      results.fromFirestore = { error: error.message };
    }

    try {
      results.usersImport = await this.importUsersFromFirestore();
    } catch (error) {
      results.usersImport = { error: error.message };
    }

    // 2. Ensuite exporter vers Firebase (mises à jour serveur)
    try {
      results.toFirestore = await this.syncToFirestore();
    } catch (error) {
      results.toFirestore = { error: error.message };
    }

    try {
      results.usersExport = await this.exportUsersToFirestore();
    } catch (error) {
      results.usersExport = { error: error.message };
    }

    // Pour compatibilité avec l'ancien format
    results.users = {
      imported: results.usersImport?.imported || 0,
      exported: results.usersExport?.exported || 0,
      updated: (results.usersImport?.updated || 0) + (results.usersExport?.updated || 0)
    };

    return results;
  }

  /**
   * IMPORTER les utilisateurs depuis Firebase vers PostgreSQL
   * Direction: Firebase → PostgreSQL (unidirectionnel)
   */
  static async importUsersFromFirestore() {
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

          // Récupérer les valeurs depuis Firebase
          const firebaseTentatives = firestoreUser.tentatives || 0;
          const firebaseBloque = firestoreUser.bloque || false;

          // Vérifier si l'utilisateur existe déjà dans PostgreSQL
          const existingResult = await pool.query(
            'SELECT id, tentatives, bloque FROM utilisateur WHERE email = $1',
            [email]
          );

          if (existingResult.rows.length === 0) {
            // Créer l'utilisateur dans PostgreSQL avec les données Firebase
            const defaultPassword = 'firebase_user_' + firebaseUid.substring(0, 8);
            
            const displayName = firestoreUser.displayName || '';
            const nameParts = displayName.split(' ');
            const prenom = nameParts[0] || '';
            const nom = nameParts.slice(1).join(' ') || '';

            await pool.query(`
              INSERT INTO utilisateur (email, mot_de_passe, nom, prenom, id_role, firebase_uid, tentatives, bloque)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [email, defaultPassword, nom, prenom, defaultRoleId, firebaseUid, firebaseTentatives, firebaseBloque]);

            results.imported++;
            results.details.push({
              action: 'imported',
              email: email,
              tentatives: firebaseTentatives,
              bloque: firebaseBloque
            });
          } else {
            // Mettre à jour l'utilisateur existant avec les données Firebase
            const existingUser = existingResult.rows[0];

            // Firebase est la source de vérité pour l'import
            if (existingUser.tentatives !== firebaseTentatives || existingUser.bloque !== firebaseBloque) {
              await pool.query(`
                UPDATE utilisateur 
                SET tentatives = $1, bloque = $2, firebase_uid = COALESCE(firebase_uid, $3)
                WHERE id = $4
              `, [firebaseTentatives, firebaseBloque, firebaseUid, existingUser.id]);

              results.updated++;
              results.details.push({
                action: 'updated',
                email: email,
                oldTentatives: existingUser.tentatives,
                newTentatives: firebaseTentatives,
                oldBloque: existingUser.bloque,
                newBloque: firebaseBloque
              });
            }
          }
        } catch (userError) {
          results.errors.push({
            email: doc.data().email,
            error: userError.message
          });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Erreur import utilisateurs depuis Firebase: ${error.message}`);
    }
  }

  /**
   * EXPORTER les utilisateurs depuis PostgreSQL vers Firebase
   * Direction: PostgreSQL → Firebase (unidirectionnel)
   */
  static async exportUsersToFirestore() {
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
      // Récupérer TOUS les utilisateurs PostgreSQL
      const pgUsers = await pool.query(`
        SELECT u.*, r.code as role_code 
        FROM utilisateur u
        LEFT JOIN role r ON u.id_role = r.id
      `);

      for (const user of pgUsers.rows) {
        try {
          // Déterminer l'ID du document Firebase
          let docId = user.firebase_uid;
          
          if (!docId) {
            // Créer un nouvel ID pour cet utilisateur
            docId = `pg_${user.id}`;
          }

          const userDocRef = db.collection(USERS_COLLECTION).doc(docId);
          
          // Envoyer les données PostgreSQL vers Firebase (source de vérité = PostgreSQL)
          await userDocRef.set({
            email: user.email,
            password: user.mot_de_passe,
            displayName: `${user.prenom || ''} ${user.nom || ''}`.trim() || user.email,
            nom: user.nom || '',
            prenom: user.prenom || '',
            role: user.role_code || 'USER',
            tentatives: user.tentatives || 0,
            bloque: user.bloque || false,
            pg_id: user.id,
            createdAt: user.created_at ? user.created_at.toISOString() : new Date().toISOString(),
            syncedFromServer: true,
            lastSyncAt: new Date().toISOString()
          }, { merge: true });

          // Mettre à jour le firebase_uid si c'était un nouvel utilisateur
          if (!user.firebase_uid) {
            await pool.query(
              'UPDATE utilisateur SET firebase_uid = $1 WHERE id = $2',
              [docId, user.id]
            );
            results.exported++;
          } else {
            results.updated++;
          }

          results.details.push({
            action: user.firebase_uid ? 'updated' : 'exported',
            email: user.email,
            tentatives: user.tentatives || 0,
            bloque: user.bloque || false
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
      throw new Error(`Erreur export utilisateurs vers Firebase: ${error.message}`);
    }
  }

  /**
   * Synchroniser les utilisateurs (bidirectionnel - pour compatibilité)
   */
  static async syncUsers() {
    // Par défaut, faire un export (PostgreSQL → Firebase)
    return await this.exportUsersToFirestore();
  }

  /**
   * Mapper les données Firestore vers le format PostgreSQL
   */
  static mapFirestoreToPostgres(firestoreData, firestoreId, statuts, entreprises) {
    // Supporter le nouveau format imbriqué pour le statut
    let statutCode = 'NOUVEAU';
    if (firestoreData.statut && typeof firestoreData.statut === 'object' && firestoreData.statut.code) {
      statutCode = firestoreData.statut.code;
    } else if (firestoreData.statut_code) {
      statutCode = firestoreData.statut_code;
    }

    return {
      titre: firestoreData.titre || firestoreData.title || 'Sans titre',
      description: firestoreData.description || '',
      latitude: firestoreData.latitude || firestoreData.lat || 0,
      longitude: firestoreData.longitude || firestoreData.lng || 0,
      surface_m2: firestoreData.surface_m2 || firestoreData.surface || null,
      budget: firestoreData.budget || null,
      id_statut_signalement: statuts[statutCode] || statuts['NOUVEAU'] || 1,
      id_utilisateur: null, // Sera lié plus tard si nécessaire
      id_entreprise: firestoreData.entreprise ? (entreprises[firestoreData.entreprise.nom] || firestoreData.entreprise.id || null) : null,
      date_signalement: firestoreData.date_signalement || firestoreData.createdAt || new Date().toISOString(),
      firebase_id: firestoreId,
      photos: firestoreData.photos || [],
      pourcentage_completion: firestoreData.pourcentage_completion || 0
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
      pourcentage_completion: pgData.pourcentage_completion ? parseFloat(pgData.pourcentage_completion) : 0,
      updatedAt: new Date().toISOString(),
      syncedFromServer: true
    };
  }

  /**
   * Synchroniser les photos d'un signalement depuis Firebase vers PostgreSQL
   */
  static async syncPhotosFromFirestore(signalementId, photos) {
    if (!photos || photos.length === 0) return { synced: 0 };

    const results = { synced: 0, errors: [] };

    for (const photo of photos) {
      try {
        // Vérifier si la photo existe déjà
        const existing = await pool.query(
          'SELECT id FROM photo_signalement WHERE id_signalement = $1 AND url = $2',
          [signalementId, photo.url]
        );

        if (existing.rows.length === 0) {
          await pool.query(`
            INSERT INTO photo_signalement (id_signalement, url, firebase_path, nom_fichier, taille_bytes, mime_type, ordre, synced_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          `, [
            signalementId,
            photo.url,
            photo.firebase_path || null,
            photo.nom_fichier || null,
            photo.taille_bytes || null,
            photo.mime_type || 'image/jpeg',
            photo.ordre || 0
          ]);
          results.synced++;
        }
      } catch (err) {
        results.errors.push({ photo: photo.url, error: err.message });
      }
    }

    return results;
  }

  /**
   * Récupérer les photos d'un signalement depuis PostgreSQL
   */
  static async getPhotosForSignalement(signalementId) {
    const result = await pool.query(
      'SELECT * FROM photo_signalement WHERE id_signalement = $1 ORDER BY ordre',
      [signalementId]
    );
    return result.rows.map(row => ({
      id: row.id.toString(),
      url: row.url,
      firebase_path: row.firebase_path,
      nom_fichier: row.nom_fichier,
      taille_bytes: row.taille_bytes,
      mime_type: row.mime_type,
      ordre: row.ordre,
      created_at: row.created_at ? row.created_at.toISOString() : null
    }));
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
