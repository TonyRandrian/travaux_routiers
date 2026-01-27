import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import type { User } from '@/types';

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
    return onAuthStateChanged(auth, async (user) => {
      currentUser.value = user;
      if (user) {
        await fetchUserProfile(user.uid);
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
        throw new Error('Firebase Auth non configuré');
      }

      // Tenter la connexion Firebase Auth directement
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Connexion réussie - réinitialiser les tentatives si possible
      try {
        if (db) {
          const userDocRef = doc(db, 'users', userCredential.user.uid);
          await updateDoc(userDocRef, { tentatives: 0 });
        } else {
          console.warn('Firestore non initialisé - impossible de réinitialiser les tentatives');
        }
      } catch (updateErr) {
        // Ignorer si le document n'existe pas encore (nouvel utilisateur)
        console.log('Reset tentatives ignoré:', updateErr);
      }

      // Charger le profil utilisateur
      await fetchUserProfile(userCredential.user.uid);
      
      return userCredential;
    } catch (err: any) {
      console.error('Erreur login:', err.code, err.message);
      error.value = getErrorMessage(err.code);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Incrementer les tentatives de connexion
  async function incrementLoginAttempts(email: string) {
    try {
      if (!db) {
        console.warn('Firestore non initialisé - impossible d\'incrémenter les tentatives');
        return;
      }

      const emailDocRef = doc(db, 'usersByEmail', email.toLowerCase());
      const emailDoc = await getDoc(emailDocRef);

      if (emailDoc.exists()) {
        const uid = emailDoc.data().uid;
        const userDocRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const currentTentatives = userDoc.data().tentatives || 0;
          const newTentatives = currentTentatives + 1;

          if (newTentatives >= MAX_TENTATIVES) {
            await updateDoc(userDocRef, {
              tentatives: newTentatives,
              bloque: true
            });
            error.value = `Compte bloque apres ${MAX_TENTATIVES} tentatives. Contactez un manager.`;
          } else {
            await updateDoc(userDocRef, { tentatives: newTentatives });
            error.value = `Tentative ${newTentatives}/${MAX_TENTATIVES}. ${MAX_TENTATIVES - newTentatives} tentative(s) restante(s).`;
          }
        }
      }
    } catch (err) {
      console.error('Erreur incrementLoginAttempts:', err);
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
