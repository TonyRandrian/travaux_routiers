import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import type { User } from '@/types';

const MAX_TENTATIVES = 3;

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<FirebaseUser | null>(null);
  const userProfile = ref<User | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);

  const isAuthenticated = computed(() => !!currentUser.value);
  const isBlocked = computed(() => userProfile.value?.bloque || false);

  // Initialiser l'écouteur d'authentification
  function initAuthListener() {
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

  // Récupérer le profil utilisateur
  async function fetchUserProfile(uid: string) {
    try {
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        userProfile.value = userDoc.data() as User;
      } else {
        // Créer un profil par défaut si inexistant
        const defaultProfile: User = {
          uid,
          email: currentUser.value?.email || '',
          displayName: currentUser.value?.displayName || 'Utilisateur',
          role: 'user',
          tentatives: 0,
          bloque: false,
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, defaultProfile);
        userProfile.value = defaultProfile;
      }
    } catch (err) {
      console.error('Erreur fetchUserProfile:', err);
    }
  }

  // Inscription
  async function signup(email: string, password: string, displayName: string, phone?: string) {
    try {
      error.value = null;
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName });

      const userData: User = {
        uid: user.uid,
        email,
        displayName,
        phone: phone || '',
        role: 'user',
        tentatives: 0,
        bloque: false,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', user.uid), userData);
      userProfile.value = userData;

      return userCredential;
    } catch (err: any) {
      error.value = getErrorMessage(err.code);
      throw err;
    }
  }

  // Connexion avec gestion des tentatives
  async function login(email: string, password: string) {
    try {
      error.value = null;

      // Vérifier si l'utilisateur est bloqué avant de tenter la connexion
      const usersQuery = await getDoc(doc(db, 'usersByEmail', email.toLowerCase()));
      if (usersQuery.exists()) {
        const userData = usersQuery.data();
        if (userData.bloque) {
          error.value = 'Compte bloqué. Contactez un manager.';
          throw new Error('Compte bloqué');
        }
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Réinitialiser les tentatives après connexion réussie
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      await updateDoc(userDocRef, { tentatives: 0 });

      return userCredential;
    } catch (err: any) {
      // Incrémenter les tentatives en cas d'échec
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        await incrementLoginAttempts(email);
      }
      error.value = getErrorMessage(err.code);
      throw err;
    }
  }

  // Incrémenter les tentatives de connexion
  async function incrementLoginAttempts(email: string) {
    try {
      // Chercher l'utilisateur par email dans Firestore
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
            error.value = `Compte bloqué après ${MAX_TENTATIVES} tentatives. Contactez un manager.`;
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

  // Déconnexion
  async function logout() {
    try {
      await signOut(auth);
      userProfile.value = null;
    } catch (err: any) {
      error.value = err.message;
      throw err;
    }
  }

  // Réinitialisation du mot de passe
  async function resetPassword(email: string) {
    try {
      error.value = null;
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      error.value = getErrorMessage(err.code);
      throw err;
    }
  }

  // Mise à jour du profil
  async function updateUserProfile(updates: Partial<User>) {
    if (!currentUser.value) throw new Error('Non connecté');

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

  // Messages d'erreur en français
  function getErrorMessage(code: string): string {
    switch (code) {
      case 'auth/user-not-found':
        return 'Aucun compte trouvé avec cet email';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Email ou mot de passe incorrect';
      case 'auth/invalid-email':
        return 'Email invalide';
      case 'auth/email-already-in-use':
        return 'Cet email est déjà utilisé';
      case 'auth/weak-password':
        return 'Le mot de passe doit contenir au moins 6 caractères';
      case 'auth/too-many-requests':
        return 'Trop de tentatives. Réessayez plus tard.';
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
    signup,
    login,
    logout,
    resetPassword,
    updateUserProfile,
    fetchUserProfile
  };
});
