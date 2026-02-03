import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import type { User } from '@/types';
import { fcmService } from '@/services/fcmService';

const MAX_TENTATIVES = 3;

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<FirebaseUser | null>(null);
  const userProfile = ref<User | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const isAuthenticated = computed(() => !!currentUser.value);
  const isBlocked = computed(() => userProfile.value?.bloque || false);

  // Initialiser l ecouteur d authentification
  function initAuthListener() {
    if (!auth) {
      console.warn('Firebase Auth non configure');
      loading.value = false;
      return;
    }
    loading.value = true;
    
    // Initialiser FCM
    fcmService.initialize();
    
    return onAuthStateChanged(auth, async (user) => {
      currentUser.value = user;
      if (user) {
        await fetchUserProfile(user.uid);
        
        // Sauvegarder le token FCM pour cet utilisateur
        await fcmService.saveTokenForUser(user.uid);
        
        // Configurer l'écouteur de refresh token
        fcmService.setupTokenRefreshListener(user.uid);
      } else {
        userProfile.value = null;
      }
      loading.value = false;
    });
  }

  // Recuperer le profil utilisateur
  async function fetchUserProfile(uid: string) {
    if (!db) return;
    try {
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        userProfile.value = userDoc.data() as User;
      } else {
        // Profil cree via le web, on utilise les infos de Firebase Auth
        userProfile.value = {
          uid,
          email: currentUser.value?.email || '',
          displayName: currentUser.value?.displayName || 'Utilisateur',
          role: 'user',
          tentatives: 0,
          bloque: false,
          createdAt: new Date().toISOString()
        };
      }
    } catch (err) {
      console.error('Erreur fetchUserProfile:', err);
    }
  }

  // Connexion avec gestion des tentatives
  async function login(email: string, password: string) {
    loading.value = true;
    error.value = null;
    
    try {
      // Vérifier que Firebase Auth est initialisé
      if (!auth) {
        error.value = 'Firebase Auth non configuré';
        throw new Error('Firebase Auth non configuré');
      }

      // 1. Vérifier si l'utilisateur est bloqué AVANT la tentative de connexion
      if (db) {
        const blockedInfo = await checkIfUserBlocked(email);
        if (blockedInfo.bloque) {
          error.value = 'Compte bloqué. Contactez un manager.';
          loading.value = false;
          throw new Error('Compte bloqué');
        }
      }

      // 2. Tenter la connexion Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // 3. Connexion réussie - réinitialiser les tentatives
      try {
        if (db) {
          const userDocRef = doc(db, 'users', userCredential.user.uid);
          await updateDoc(userDocRef, { tentatives: 0, bloque: false });
        }
      } catch (updateErr) {
        console.log('Reset tentatives ignoré:', updateErr);
      }

      // Charger le profil utilisateur
      await fetchUserProfile(userCredential.user.uid);
      
      // Sauvegarder le token FCM après connexion réussie
      await fcmService.saveTokenForUser(userCredential.user.uid);
      
      return userCredential;
    } catch (err: any) {
      console.error('Erreur login:', err.code, err.message);
      
      // Si erreur de mot de passe incorrect, incrémenter les tentatives
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        await incrementLoginAttempts(email);
        // error.value est mis à jour dans incrementLoginAttempts
      } else if (!error.value) {
        error.value = getErrorMessage(err.code || err.message);
      }
      
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Vérifier si l'utilisateur est bloqué - cherche par UID directement via query sur users
  async function checkIfUserBlocked(email: string): Promise<{ bloque: boolean; uid: string | null }> {
    if (!db) return { bloque: false, uid: null };
    
    try {
      // Chercher l'utilisateur par email dans la collection users
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email.toLowerCase()));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();
        return { 
          bloque: userData.bloque === true, 
          uid: userDoc.id 
        };
      }
      
      // Essayer aussi avec l'email original (sans lowercase)
      const q2 = query(usersRef, where('email', '==', email));
      const snapshot2 = await getDocs(q2);
      
      if (!snapshot2.empty) {
        const userDoc = snapshot2.docs[0];
        const userData = userDoc.data();
        return { 
          bloque: userData.bloque === true, 
          uid: userDoc.id 
        };
      }
      
      return { bloque: false, uid: null };
    } catch (err) {
      console.error('Erreur checkIfUserBlocked:', err);
      return { bloque: false, uid: null };
    }
  }

  // Incrementer les tentatives de connexion - cherche par email dans users directement
  async function incrementLoginAttempts(email: string) {
    try {
      if (!db) {
        console.warn('Firestore non initialisé');
        error.value = 'Email ou mot de passe incorrect.';
        return;
      }

      // Chercher l'utilisateur par email dans la collection users
      const usersRef = collection(db, 'users');
      let userDocId: string | null = null;
      let userData: any = null;

      // Essayer avec email lowercase
      const q = query(usersRef, where('email', '==', email.toLowerCase()));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        userDocId = snapshot.docs[0].id;
        userData = snapshot.docs[0].data();
      } else {
        // Essayer avec email original
        const q2 = query(usersRef, where('email', '==', email));
        const snapshot2 = await getDocs(q2);
        
        if (!snapshot2.empty) {
          userDocId = snapshot2.docs[0].id;
          userData = snapshot2.docs[0].data();
        }
      }

      if (!userDocId || !userData) {
        console.warn('Utilisateur non trouvé dans Firestore pour:', email);
        error.value = 'Email ou mot de passe incorrect.';
        return;
      }

      const currentTentatives = userData.tentatives || 0;
      const newTentatives = currentTentatives + 1;
      const userDocRef = doc(db, 'users', userDocId);

      if (newTentatives >= MAX_TENTATIVES) {
        // Bloquer l'utilisateur
        await updateDoc(userDocRef, {
          tentatives: newTentatives,
          bloque: true
        });
        error.value = `Compte bloqué après ${MAX_TENTATIVES} tentatives. Contactez un manager.`;
        console.log('Utilisateur bloqué:', email, 'tentatives:', newTentatives);
      } else {
        await updateDoc(userDocRef, { tentatives: newTentatives });
        error.value = `Mot de passe incorrect. Tentative ${newTentatives}/${MAX_TENTATIVES}. ${MAX_TENTATIVES - newTentatives} essai(s) restant(s).`;
        console.log('Tentative échouée:', email, 'tentatives:', newTentatives);
      }
    } catch (err) {
      console.error('Erreur incrementLoginAttempts:', err);
      error.value = 'Email ou mot de passe incorrect.';
    }
  }

  // Deconnexion
  async function logout() {
    try {
      if (!auth) {
        console.warn('Firebase Auth non initialisé - impossible de se déconnecter');
        userProfile.value = null;
        return;
      }
      
      // Supprimer le token FCM avant la déconnexion
      if (currentUser.value) {
        await fcmService.removeTokenForUser(currentUser.value.uid);
      }
      
      await signOut(auth);
      userProfile.value = null;
    } catch (err: any) {
      error.value = err.message;
      throw err;
    }
  }

  // Mise a jour du profil (displayName seulement cote mobile)
  async function updateUserProfile(updates: Partial<User>) {
    if (!currentUser.value) throw new Error('Non connecte');

    try {
      if (!db) throw new Error('Firestore non initialisé');
      const userDocRef = doc(db, 'users', currentUser.value.uid);

      if (updates.displayName) {
        await updateProfile(currentUser.value, { displayName: updates.displayName });
      }

      await updateDoc(userDocRef, {
        ...updates,
        updatedAt: new Date().toISOString()
      });

      userProfile.value = { ...userProfile.value!, ...updates };
    } catch (err: any) {
      error.value = err.message;
      throw err;
    }
  }

  // Messages d'erreur clairs en français
  function getErrorMessage(code: string): string {
    console.log('Code erreur Firebase:', code); // Debug
    
    // Normaliser le code (enlever le préfixe si présent)
    const normalizedCode = code?.replace('auth/', '') || '';
    
    switch (normalizedCode) {
      case 'user-not-found':
        return 'Aucun compte avec cet email. Créez un compte sur le site web.';
      case 'wrong-password':
        return 'Mot de passe incorrect.';
      case 'invalid-credential':
        return 'Email ou mot de passe incorrect.';
      case 'invalid-email':
        return 'Adresse email invalide.';
      case 'user-disabled':
        return 'Ce compte est désactivé. Contactez un manager.';
      case 'too-many-requests':
        return 'Trop de tentatives échouées. Attendez quelques minutes.';
      case 'network-request-failed':
        return 'Pas de connexion internet.';
      case 'operation-not-allowed':
        return 'Connexion non autorisée. Contactez l\'administrateur.';
      default:
        if (!code || code === 'undefined') {
          return 'Erreur de connexion. Vérifiez vos identifiants.';
        }
        console.warn('Code erreur non géré:', code);
        return 'Email ou mot de passe incorrect.';
    }
  }

  return {
    currentUser,
    userProfile,
    loading,
    error,
    isAuthenticated,
    isBlocked,
    initAuthListener,
    login,
    logout,
    updateUserProfile,
    fetchUserProfile
  };
});
