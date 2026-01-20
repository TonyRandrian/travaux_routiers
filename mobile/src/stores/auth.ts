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
    try {
      error.value = null;

      // Verifier si l utilisateur est bloque avant de tenter la connexion
      const usersQuery = await getDoc(doc(db, 'usersByEmail', email.toLowerCase()));
      if (usersQuery.exists()) {
        const userData = usersQuery.data();
        if (userData.bloque) {
          error.value = 'Compte bloque. Contactez un manager.';
          throw new Error('Compte bloque');
        }
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Reinitialiser les tentatives apres connexion reussie
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      await updateDoc(userDocRef, { tentatives: 0 });

      return userCredential;
    } catch (err: any) {
      // Incrementer les tentatives en cas d echec
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        await incrementLoginAttempts(email);
      }
      error.value = error.value || getErrorMessage(err.code);
      throw err;
    }
  }

  // Incrementer les tentatives de connexion
  async function incrementLoginAttempts(email: string) {
    try {
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

  // Messages d erreur en francais
  function getErrorMessage(code: string): string {
    switch (code) {
      case 'auth/user-not-found':
        return 'Aucun compte trouve avec cet email';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Email ou mot de passe incorrect';
      case 'auth/invalid-email':
        return 'Email invalide';
      case 'auth/too-many-requests':
        return 'Trop de tentatives. Reessayez plus tard.';
      default:
        return 'Une erreur est survenue';
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
