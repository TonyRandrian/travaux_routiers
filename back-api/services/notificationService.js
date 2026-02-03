const { admin, getFirestore, isFirebaseAvailable } = require('../config/firebase');

/**
 * Service d'envoi de notifications push via FCM
 */
class NotificationService {
  
  /**
   * Vérifier si le service est disponible
   */
  static isAvailable() {
    return isFirebaseAvailable();
  }

  /**
   * Formater le message du statut en phrase lisible
   */
  static formatStatusMessage(statutCode, titre, entreprise) {
    let statusPhrase = '';
    
    switch (statutCode) {
      case 'EN_COURS':
        statusPhrase = 'est maintenant en cours de traitement';
        break;
      case 'TERMINE':
        statusPhrase = 'a été traité avec succès';
        break;
      default:
        statusPhrase = 'a été mis à jour';
    }

    let body = `Votre signalement "${titre}" ${statusPhrase}`;
    
    if (entreprise) {
      body += `. Entreprise en charge : ${entreprise}`;
    }

    return body;
  }

  /**
   * Récupérer les tokens FCM d'un utilisateur depuis Firestore
   */
  static async getUserFcmTokens(userEmail) {
    if (!this.isAvailable()) {
      console.warn('Firebase non disponible');
      return [];
    }

    try {
      const db = getFirestore();
      
      // Chercher l'utilisateur par email dans Firestore
      const usersSnapshot = await db.collection('users')
        .where('email', '==', userEmail)
        .limit(1)
        .get();

      if (usersSnapshot.empty) {
        console.log('Utilisateur non trouvé dans Firestore:', userEmail);
        return [];
      }

      const userData = usersSnapshot.docs[0].data();
      const tokens = userData.fcmTokens || [];
      
      console.log(`Tokens FCM trouvés pour ${userEmail}:`, tokens.length);
      return tokens;
    } catch (error) {
      console.error('Erreur récupération tokens FCM:', error);
      return [];
    }
  }

  /**
   * Envoyer une notification à un utilisateur
   */
  static async sendNotification(tokens, title, body, data = {}) {
    if (!this.isAvailable()) {
      console.warn('Firebase non disponible pour les notifications');
      return { success: false, error: 'Firebase non disponible' };
    }

    if (!tokens || tokens.length === 0) {
      console.log('Aucun token FCM pour envoyer la notification');
      return { success: false, error: 'Aucun token' };
    }

    try {
      const message = {
        notification: {
          title: title,
          body: body
        },
        data: {
          ...data,
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        },
        tokens: tokens
      };

      // Envoyer à tous les appareils de l'utilisateur
      const response = await admin.messaging().sendEachForMulticast(message);
      
      console.log(`Notifications envoyées: ${response.successCount} succès, ${response.failureCount} échecs`);

      // Nettoyer les tokens invalides
      if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(`Échec pour token ${idx}:`, resp.error?.message);
            // Si le token est invalide, on le marque pour suppression
            if (resp.error?.code === 'messaging/invalid-registration-token' ||
                resp.error?.code === 'messaging/registration-token-not-registered') {
              failedTokens.push(tokens[idx]);
            }
          }
        });
        
        // TODO: Supprimer les tokens invalides de Firestore si nécessaire
      }

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount
      };
    } catch (error) {
      console.error('Erreur envoi notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Notifier un utilisateur du changement de statut de son signalement
   */
  static async notifyStatusChange(userEmail, signalement, newStatutCode, entreprise) {
    console.log('=== NOTIFICATION STATUS CHANGE ===');
    console.log('Email utilisateur:', userEmail);
    console.log('Signalement:', signalement);
    console.log('Nouveau statut:', newStatutCode);
    console.log('Entreprise:', entreprise);
    
    // Ne pas notifier pour le statut NOUVEAU
    if (newStatutCode === 'NOUVEAU') {
      console.log('Pas de notification pour statut NOUVEAU');
      return { success: false, reason: 'Statut NOUVEAU ignoré' };
    }

    // Récupérer les tokens de l'utilisateur
    const tokens = await this.getUserFcmTokens(userEmail);
    console.log('Tokens FCM récupérés:', tokens);
    
    if (tokens.length === 0) {
      console.log('Aucun token FCM trouvé pour:', userEmail);
      return { success: false, reason: 'Aucun token FCM' };
    }

    // Formater le message
    const title = 'Mise à jour de votre signalement';
    const body = this.formatStatusMessage(newStatutCode, signalement.titre, entreprise);

    // Données additionnelles pour la notification
    const data = {
      signalement_id: String(signalement.id),
      statut_code: newStatutCode,
      type: 'status_change'
    };

    // Envoyer la notification
    return await this.sendNotification(tokens, title, body, data);
  }
}

module.exports = NotificationService;
