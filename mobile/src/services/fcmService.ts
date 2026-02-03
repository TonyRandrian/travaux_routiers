import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Capacitor } from '@capacitor/core';
import { auth } from '@/config/firebase';

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
    console.log('=== FCM INITIALIZE START ===');
    console.log('Platform native?', this.isSupported());
    
    if (!this.isSupported()) {
      console.log('Push notifications non supportées sur cette plateforme (web/browser)');
      return;
    }

    if (this.isInitialized) {
      console.log('FCM déjà initialisé');
      return;
    }

    try {
      // Demander la permission
      console.log('Demande de permission notifications...');
      const permStatus = await PushNotifications.requestPermissions();
      console.log('Permission status:', permStatus);
      
      if (permStatus.receive !== 'granted') {
        console.warn('Permission notifications refusée:', permStatus.receive);
        return;
      }

      // S'enregistrer pour les notifications
      console.log('Enregistrement FCM...');
      await PushNotifications.register();
      console.log('PushNotifications.register() appelé');

      // Écouter les événements
      this.setupListeners();
      
      this.isInitialized = true;
      console.log('=== FCM INITIALIZE SUCCESS ===');
    } catch (error) {
      console.error('=== FCM INITIALIZE ERROR ===', error);
    }
  }

  /**
   * Configurer les écouteurs d'événements
   */
  private setupListeners(): void {
    console.log('Configuration des listeners FCM...');
    
    // Token reçu
    PushNotifications.addListener('registration', (token: Token) => {
      console.log('=== FCM TOKEN RECEIVED ===');
      console.log('FCM Token:', token.value);
      this.currentToken = token.value;
    });

    // Erreur d'enregistrement
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('=== FCM REGISTRATION ERROR ===');
      console.error('Erreur enregistrement FCM:', JSON.stringify(error));
    });

    // Notification reçue (app au premier plan)
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('=== NOTIFICATION RECEIVED ===');
      console.log('Notification:', JSON.stringify(notification));
    });

    // Action sur une notification (clic)
    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('=== NOTIFICATION ACTION ===');
      console.log('Action:', JSON.stringify(action));
    });
    
    console.log('Listeners FCM configurés');
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
   * Cherche le document par EMAIL car c'est plus fiable que l'UID
   */
  async saveTokenForUser(uid: string): Promise<void> {
    if (!db) {
      console.warn('Firestore non initialisé');
      return;
    }

    // Récupérer l'email de l'utilisateur connecté
    const userEmail = auth?.currentUser?.email;
    if (!userEmail) {
      console.warn('Email utilisateur non disponible');
      return;
    }

    const token = await this.getToken();
    if (!token) {
      console.warn('Aucun token FCM disponible - probablement pas sur un appareil natif');
      return;
    }

    try {
      console.log('Tentative de sauvegarde du token FCM pour:', userEmail);
      
      // Chercher le document utilisateur par email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', userEmail));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // Essayer avec email en minuscules
        const qLower = query(usersRef, where('email', '==', userEmail.toLowerCase()));
        const snapshotLower = await getDocs(qLower);
        
        if (snapshotLower.empty) {
          console.warn('Document utilisateur non trouvé dans Firestore pour email:', userEmail);
          console.warn('Création du document utilisateur...');
          
          // Créer le document avec l'UID comme ID
          const userDocRef = doc(db, 'users', uid);
          await setDoc(userDocRef, {
            uid,
            email: userEmail,
            displayName: auth?.currentUser?.displayName || 'Utilisateur',
            role: 'user',
            tentatives: 0,
            bloque: false,
            createdAt: new Date().toISOString(),
            fcmTokens: [token]
          });
          console.log('Document utilisateur créé avec token FCM:', uid);
          return;
        }
        
        // Utiliser le résultat en minuscules
        const userDocRef = snapshotLower.docs[0].ref;
        await updateDoc(userDocRef, {
          fcmTokens: arrayUnion(token)
        });
        console.log('Token FCM ajouté pour utilisateur (lowercase):', userEmail);
        return;
      }

      // Document trouvé, ajouter le token
      const userDocRef = snapshot.docs[0].ref;
      await updateDoc(userDocRef, {
        fcmTokens: arrayUnion(token)
      });
      
      console.log('Token FCM ajouté avec succès pour:', userEmail, 'Token:', token.substring(0, 20) + '...');
    } catch (error) {
      console.error('Erreur sauvegarde token FCM:', error);
    }
  }

  /**
   * Supprimer le token FCM d'un utilisateur dans Firestore
   * Cherche le document par EMAIL
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

    // Récupérer l'email de l'utilisateur connecté
    const userEmail = auth?.currentUser?.email;
    if (!userEmail) {
      console.warn('Email utilisateur non disponible pour supprimer le token');
      return;
    }

    try {
      // Chercher le document utilisateur par email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', userEmail));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // Essayer avec email en minuscules
        const qLower = query(usersRef, where('email', '==', userEmail.toLowerCase()));
        const snapshotLower = await getDocs(qLower);
        
        if (!snapshotLower.empty) {
          const userDocRef = snapshotLower.docs[0].ref;
          await updateDoc(userDocRef, {
            fcmTokens: arrayRemove(token)
          });
          console.log('Token FCM supprimé pour utilisateur (lowercase):', userEmail);
        }
        return;
      }

      // Document trouvé, supprimer le token
      const userDocRef = snapshot.docs[0].ref;
      await updateDoc(userDocRef, {
        fcmTokens: arrayRemove(token)
      });
      
      console.log('Token FCM supprimé pour utilisateur:', userEmail);
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
      if (oldToken && oldToken !== token.value && db && auth?.currentUser?.email) {
        try {
          const userEmail = auth.currentUser.email;
          
          // Chercher le document utilisateur par email
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', userEmail));
          const snapshot = await getDocs(q);
          
          if (!snapshot.empty) {
            const userDocRef = snapshot.docs[0].ref;
            
            // Supprimer l'ancien token et ajouter le nouveau
            await updateDoc(userDocRef, {
              fcmTokens: arrayRemove(oldToken)
            });
            await updateDoc(userDocRef, {
              fcmTokens: arrayUnion(token.value)
            });
            
            console.log('Token FCM mis à jour pour utilisateur:', userEmail);
          }
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
