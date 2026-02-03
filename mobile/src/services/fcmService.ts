import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Capacitor } from '@capacitor/core';

/**
 * Service de gestion des notifications push (FCM)
 */
class FCMService {
  private currentToken: string | null = null;
  private isInitialized = false;

  /**
   * Vérifier si les push notifications sont supportées
   */
  isSupported(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Initialiser les notifications push
   */
  async initialize(): Promise<void> {
    if (!this.isSupported()) {
      console.log('Push notifications non supportées sur cette plateforme');
      return;
    }

    if (this.isInitialized) {
      console.log('FCM déjà initialisé');
      return;
    }

    try {
      // Demander la permission
      const permStatus = await PushNotifications.requestPermissions();
      
      if (permStatus.receive !== 'granted') {
        console.warn('Permission notifications refusée');
        return;
      }

      // S'enregistrer pour les notifications
      await PushNotifications.register();

      // Écouter les événements
      this.setupListeners();
      
      this.isInitialized = true;
      console.log('FCM initialisé avec succès');
    } catch (error) {
      console.error('Erreur initialisation FCM:', error);
    }
  }

  /**
   * Configurer les écouteurs d'événements
   */
  private setupListeners(): void {
    // Token reçu
    PushNotifications.addListener('registration', (token: Token) => {
      console.log('FCM Token reçu:', token.value);
      this.currentToken = token.value;
    });

    // Erreur d'enregistrement
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Erreur enregistrement FCM:', error);
    });

    // Notification reçue (app au premier plan)
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Notification reçue:', notification);
      // Ici on peut afficher un toast ou une alerte
    });

    // Action sur une notification (clic)
    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('Action notification:', action);
      // Ici on peut naviguer vers le signalement concerné
    });
  }

  /**
   * Obtenir le token FCM actuel
   */
  async getToken(): Promise<string | null> {
    if (!this.isSupported()) {
      return null;
    }

    // Si on a déjà le token, le retourner
    if (this.currentToken) {
      return this.currentToken;
    }

    // Sinon, attendre un peu que le token soit reçu
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 10;
      
      const checkToken = setInterval(() => {
        attempts++;
        if (this.currentToken || attempts >= maxAttempts) {
          clearInterval(checkToken);
          resolve(this.currentToken);
        }
      }, 500);
    });
  }

  /**
   * Sauvegarder le token FCM pour un utilisateur dans Firestore
   */
  async saveTokenForUser(uid: string): Promise<void> {
    if (!db) {
      console.warn('Firestore non initialisé');
      return;
    }

    const token = await this.getToken();
    if (!token) {
      console.warn('Aucun token FCM disponible');
      return;
    }

    try {
      const userDocRef = doc(db, 'users', uid);
      
      // Ajouter le token à la liste (arrayUnion évite les doublons)
      await updateDoc(userDocRef, {
        fcmTokens: arrayUnion(token)
      });
      
      console.log('Token FCM sauvegardé pour utilisateur:', uid);
    } catch (error) {
      console.error('Erreur sauvegarde token FCM:', error);
    }
  }

  /**
   * Supprimer le token FCM d'un utilisateur dans Firestore
   */
  async removeTokenForUser(uid: string): Promise<void> {
    if (!db) {
      console.warn('Firestore non initialisé');
      return;
    }

    const token = this.currentToken;
    if (!token) {
      console.warn('Aucun token FCM à supprimer');
      return;
    }

    try {
      const userDocRef = doc(db, 'users', uid);
      
      // Supprimer le token de la liste
      await updateDoc(userDocRef, {
        fcmTokens: arrayRemove(token)
      });
      
      console.log('Token FCM supprimé pour utilisateur:', uid);
    } catch (error) {
      console.error('Erreur suppression token FCM:', error);
    }
  }

  /**
   * Écouter les changements de token et mettre à jour Firestore
   */
  setupTokenRefreshListener(uid: string): void {
    if (!this.isSupported()) return;

    // Supprimer l'ancien listener s'il existe
    PushNotifications.removeAllListeners();
    
    // Reconfigurer les listeners
    this.setupListeners();

    // Ajouter un listener pour la mise à jour du token
    PushNotifications.addListener('registration', async (token: Token) => {
      const oldToken = this.currentToken;
      this.currentToken = token.value;

      // Si le token a changé, mettre à jour Firestore
      if (oldToken && oldToken !== token.value && db) {
        try {
          const userDocRef = doc(db, 'users', uid);
          
          // Supprimer l'ancien token et ajouter le nouveau
          await updateDoc(userDocRef, {
            fcmTokens: arrayRemove(oldToken)
          });
          await updateDoc(userDocRef, {
            fcmTokens: arrayUnion(token.value)
          });
          
          console.log('Token FCM mis à jour pour utilisateur:', uid);
        } catch (error) {
          console.error('Erreur mise à jour token FCM:', error);
        }
      }
    });
  }
}

// Export singleton
export const fcmService = new FCMService();
export default fcmService;
