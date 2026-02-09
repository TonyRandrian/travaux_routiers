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
import { useReferentielsStore } from '@/stores/referentiels';

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
    
    // Initialiser FCM avec await pour s'assurer que le token est prêt
    console.log('initAuthListener: Initialisation FCM...');
    fcmService.initialize(); // Lance l'init en parallèle (la Promise est stockée)
    
    return onAuthStateChanged(auth, async (user) => {
      console.log('onAuthStateChanged: user =', user?.uid || 'null');
      currentUser.value = user;
      if (user) {
        await fetchUserProfile(user.uid);
        
        // Charger les référentiels (statuts, entreprises) maintenant que l'utilisateur est authentifié
        try {
          const referentielsStore = useReferentielsStore();
          referentielsStore.loadAll();
        } catch (err) {
          console.error('Erreur chargement référentiels:', err);
        }
        
        // Sauvegarder le token FCM - getToken() attend la fin de initialize()
        console.log('onAuthStateChanged: Tentative sauvegarde token FCM...');
        try {
          await fcmService.saveTokenForUser(user.uid);
          fcmService.setupTokenRefreshListener(user.uid);
        } catch (err) {
          console.error('Erreur sauvegarde token FCM:', err);
        }
      } else {
        userProfile.value = null;
      }
      loading.value = false;
    });
  }

  // Helper: trouver le document utilisateur (par UID d'abord, puis par email)
  async function findUserDocRef(uid: string): Promise<{ ref: any; data: any } | null> {
    if (!db) return null;

    // 1. Chercher par UID (doc ID = uid)
    const uidRef = doc(db, 'users', uid);
    const uidSnap = await getDoc(uidRef);
    if (uidSnap.exists()) {
      console.log('findUserDoc: Trouvé par UID:', uid);
      return { ref: uidRef, data: uidSnap.data() };
    }

    // 2. Chercher par email
    const email = currentUser.value?.email || auth?.currentUser?.email;
    if (email) {
      const usersRef = collection(db, 'users');
      
      // Email exact
      const snap = await getDocs(query(usersRef, where('email', '==', email)));
      if (!snap.empty) {
        console.log('findUserDoc: Trouvé par email:', email, 'docId:', snap.docs[0].id);
        return { ref: snap.docs[0].ref, data: snap.docs[0].data() };
      }

      // Email lowercase
      if (email !== email.toLowerCase()) {
        const snapLower = await getDocs(query(usersRef, where('email', '==', email.toLowerCase())));
        if (!snapLower.empty) {
          console.log('findUserDoc: Trouvé par email lowercase:', email.toLowerCase());
          return { ref: snapLower.docs[0].ref, data: snapLower.docs[0].data() };
        }
      }
    }

    console.log('findUserDoc: Aucun document trouvé pour uid:', uid, 'email:', email);
    return null;
  }

  // Recuperer le profil utilisateur
  async function fetchUserProfile(uid: string) {
    if (!db) return;
    try {
      const found = await findUserDocRef(uid);

      if (found) {
        userProfile.value = found.data as User;
        
        // Si le doc n'a pas le champ uid, le mettre à jour
        if (!found.data.uid || found.data.uid !== uid) {
          console.log('fetchUserProfile: Mise à jour uid dans le doc existant');
          await updateDoc(found.ref, { uid });
        }
      } else {
        // Aucun document trouvé → créer un nouveau
        console.log('fetchUserProfile: Aucun doc existant, création pour uid:', uid);
        const { setDoc } = await import('firebase/firestore');
        const newUserProfile: User = {
          uid,
          email: currentUser.value?.email || '',
          displayName: currentUser.value?.displayName || 'Utilisateur',
          role: 'user',
          tentatives: 0,
          bloque: false,
          createdAt: new Date().toISOString(),
          fcmTokens: []
        };
        const userDocRef = doc(db, 'users', uid);
        await setDoc(userDocRef, newUserProfile);
        console.log('fetchUserProfile: Document créé dans Firestore:', uid);
        userProfile.value = newUserProfile;
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

      // 1. Tenter la connexion Firebase Auth EN PREMIER
      // (on ne peut pas lire Firestore sans être authentifié à cause des rules)
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // 2. Connexion réussie - vérifier si l'utilisateur est bloqué
      // (maintenant on est authentifié, on peut lire Firestore)
      if (db) {
        const blockedInfo = await checkIfUserBlocked(email);
        if (blockedInfo.bloque) {
          // L'utilisateur est bloqué, le déconnecter immédiatement
          await signOut(auth);
          error.value = 'Compte bloqué. Contactez un manager.';
          loading.value = false;
          throw new Error('Compte bloqué');
        }
      }

      // 3. Connexion réussie et non bloqué - réinitialiser les tentatives
      try {
        if (db) {
          const found = await findUserDocRef(userCredential.user.uid);
          if (found) {
            await updateDoc(found.ref, { tentatives: 0, bloque: false });
          }
        }
      } catch (updateErr) {
        console.log('Reset tentatives ignoré:', updateErr);
      }

      // Charger le profil utilisateur
      await fetchUserProfile(userCredential.user.uid);
      
      // Note: Le token FCM sera sauvegardé par onAuthStateChanged
      // qui se déclenche automatiquement après signInWithEmailAndPassword
      
      return userCredential;
    } catch (err: any) {
      console.error('Erreur login:', err.code, err.message);
      
      // Si erreur de mot de passe incorrect, incrémenter les tentatives
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        // On n'est PAS authentifié ici, donc on ne peut pas écrire dans Firestore
        // directement. On affiche juste le message d'erreur.
        error.value = 'Email ou mot de passe incorrect.';
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
      
      const found = await findUserDocRef(currentUser.value.uid);
      if (!found) throw new Error('Document utilisateur non trouvé');

      if (updates.displayName) {
        await updateProfile(currentUser.value, { displayName: updates.displayName });
      }

      await updateDoc(found.ref, {
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
