import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Capacitor } from '@capacitor/core';
import { auth } from '@/config/firebase';

/**
 * Service FCM - Notifications Push
 *
 * CORRECTIONS APPLIQUÉES:
 * 1. initialize() retourne une Promise réutilisable (pas de double init)
 * 2. initialize() attend que le token soit reçu avant de se résoudre
 * 3. getToken() attend que initialize() soit terminé
 * 4. setupTokenRefreshListener() ne détruit plus les listeners (bug critique fixé)
 * 5. Listeners configurés UNE SEULE FOIS, AVANT register()
 */
class FCMService {
  private currentToken: string | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private listenersConfigured = false;
  private tokenResolve: ((token: string | null) => void) | null = null;

  isSupported(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Initialiser FCM - safe à appeler plusieurs fois (retourne la même Promise)
   */
  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    console.log('=== FCM INIT START ===');
    console.log('Native platform?', this.isSupported());

    if (!this.isSupported()) {
      console.log('FCM: Web/browser → pas de push notifications');
      return;
    }

    if (this.isInitialized) {
      console.log('FCM: Déjà initialisé');
      return;
    }

    try {
      // 1. Listeners AVANT register() pour capturer le token
      if (!this.listenersConfigured) {
        this._setupListeners();
        this.listenersConfigured = true;
      }

      // 2. Permission
      console.log('FCM: Demande permission...');
      const perm = await PushNotifications.requestPermissions();
      console.log('FCM: Permission =', JSON.stringify(perm));

      if (perm.receive !== 'granted') {
        console.warn('FCM: Permission refusée');
        return;
      }

      // 3. Register → déclenche le listener 'registration' avec le token
      console.log('FCM: Register...');
      await PushNotifications.register();

      // 4. Attendre le token (max 10s)
      console.log('FCM: Attente token (max 10s)...');
      await this._waitForToken(10000);

      this.isInitialized = true;
      console.log('=== FCM INIT OK === Token:', this.currentToken ? this.currentToken.substring(0, 25) + '...' : 'NULL');
    } catch (error) {
      console.error('=== FCM INIT ERROR ===', error);
    }
  }

  private _waitForToken(timeoutMs: number): Promise<string | null> {
    if (this.currentToken) return Promise.resolve(this.currentToken);

    return new Promise((resolve) => {
      this.tokenResolve = resolve;
      setTimeout(() => {
        if (this.tokenResolve === resolve) {
          console.warn('FCM: Timeout token après', timeoutMs, 'ms');
          this.tokenResolve = null;
          resolve(this.currentToken);
        }
      }, timeoutMs);
    });
  }

  /**
   * Listeners configurés UNE SEULE FOIS - ne jamais les supprimer
   */
  private _setupListeners(): void {
    console.log('FCM: Configuration listeners...');

    // Token reçu
    PushNotifications.addListener('registration', (token: Token) => {
      console.log('=== FCM TOKEN ===', token.value.substring(0, 30) + '...');
      const oldToken = this.currentToken;
      this.currentToken = token.value;

      // Résoudre la promesse d'attente
      if (this.tokenResolve) {
        this.tokenResolve(token.value);
        this.tokenResolve = null;
      }

      // Auto-update si le token a changé et user connecté
      if (oldToken && oldToken !== token.value && db && auth?.currentUser) {
        this._swapToken(auth.currentUser.uid, oldToken, token.value);
      }
    });

    // Erreur
    PushNotifications.addListener('registrationError', (err: any) => {
      console.error('=== FCM REG ERROR ===', JSON.stringify(err));
      if (this.tokenResolve) {
        this.tokenResolve(null);
        this.tokenResolve = null;
      }
    });

    // Notification au premier plan
    PushNotifications.addListener('pushNotificationReceived', (notif: PushNotificationSchema) => {
      console.log('=== NOTIF FOREGROUND ===', notif.title, '-', notif.body);
    });

    // Clic sur notification
    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('=== NOTIF CLICK ===', JSON.stringify(action.notification));
    });

    console.log('FCM: ✅ Listeners OK');
  }

  /**
   * Obtenir le token - attend la fin de initialize()
   */
  async getToken(): Promise<string | null> {
    if (!this.isSupported()) return null;
    if (this.initPromise) await this.initPromise;
    return this.currentToken;
  }

  /**
   * Sauvegarder le token dans le document Firestore de l'utilisateur
   */
  async saveTokenForUser(uid: string): Promise<void> {
    console.log('FCM saveToken: START uid =', uid);

    if (!db) {
      console.error('FCM saveToken: ❌ db (Firestore) est NULL !');
      return;
    }

    const email = auth?.currentUser?.email;
    console.log('FCM saveToken: email =', email || 'NULL');
    if (!email) {
      console.error('FCM saveToken: ❌ Pas d\'email - auth.currentUser =', JSON.stringify(auth?.currentUser?.uid));
      return;
    }

    const token = await this.getToken();
    console.log('FCM saveToken: token =', token ? token.substring(0, 30) + '...' : 'NULL');
    if (!token) {
      console.error('FCM saveToken: ❌ Pas de token FCM disponible');
      return;
    }

    try {
      // Chercher le document utilisateur : d'abord par UID, puis par email
      const userDocRef = await this._findUserDocRef(uid);
      
      if (userDocRef) {
        const snap = await getDoc(userDocRef);
        const data = snap.data();
        console.log('FCM saveToken: Doc trouvé, id:', userDocRef.id, 'fcmTokens actuels =', JSON.stringify(data?.fcmTokens || []));
        console.log('FCM saveToken: Appel updateDoc avec arrayUnion...');
        await updateDoc(userDocRef, { fcmTokens: arrayUnion(token) });
        console.log('FCM saveToken: ✅ OK - Token ajouté');
        // Vérification immédiate
        const verif = await getDoc(userDocRef);
        console.log('FCM saveToken: VERIFICATION - fcmTokens =', JSON.stringify(verif.data()?.fcmTokens || []));
      } else {
        // Pas de document utilisateur trouvé du tout - ne PAS en créer ici
        // fetchUserProfile() dans auth.ts s'en charge
        console.warn('FCM saveToken: ⚠️ Aucun document utilisateur trouvé pour uid:', uid, 'email:', email);
        console.warn('FCM saveToken: Le token sera sauvegardé au prochain appel quand le doc existera');
      }

    } catch (err: any) {
      console.error('FCM saveToken: ❌ ERREUR FIRESTORE:', err);
      console.error('FCM saveToken: err.code =', err.code);
      console.error('FCM saveToken: err.message =', err.message);
      console.error('FCM saveToken: err.stack =', err.stack);
    }
  }

  private async _swapToken(uid: string, oldToken: string, newToken: string): Promise<void> {
    if (!db) return;
    try {
      const ref = await this._findUserDocRef(uid);
      if (!ref) return;
      await updateDoc(ref, { fcmTokens: arrayRemove(oldToken) });
      await updateDoc(ref, { fcmTokens: arrayUnion(newToken) });
      console.log('FCM: Token swapped OK');
    } catch (e) { console.error('FCM: Swap error', e); }
  }

  private async _findUserDocRef(uid: string) {
    if (!db) return null;

    // Par UID
    const uidRef = doc(db, 'users', uid);
    if ((await getDoc(uidRef)).exists()) return uidRef;

    // Par email
    const email = auth?.currentUser?.email;
    if (!email) return null;
    const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
    return snap.empty ? null : snap.docs[0].ref;
  }

  async removeTokenForUser(uid: string): Promise<void> {
    if (!db || !this.currentToken) return;
    try {
      const ref = await this._findUserDocRef(uid);
      if (!ref) return;
      await updateDoc(ref, { fcmTokens: arrayRemove(this.currentToken) });
      console.log('FCM: Token supprimé OK');
    } catch (e) { console.error('FCM: Remove error', e); }
  }

  /**
   * NE PAS appeler removeAllListeners() — les listeners initiaux sont suffisants
   */
  setupTokenRefreshListener(_uid: string): void {
    console.log('FCM: Token refresh listener déjà actif via _setupListeners()');
  }
}

export const fcmService = new FCMService();
export default fcmService;
