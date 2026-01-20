import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  updateEmail,
  updatePassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import config from '../config/config';

// Constantes des rôles
export const ROLES = {
  VISITEUR: 'VISITEUR',
  USER: 'USER',
  MANAGER: 'MANAGER'
};

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isVisitor, setIsVisitor] = useState(false);

  // Récupérer le rôle depuis le backend PostgreSQL
  async function fetchUserRoleFromBackend(email) {
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`${config.api.baseUrl}/api/utilisateurs/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        return userData.role_code || userData.role || ROLES.USER;
      }
      return ROLES.USER;
    } catch (error) {
      console.error('Erreur récupération rôle backend:', error);
      return ROLES.USER;
    }
  }

  // Inscription
  async function signup(email, password, displayName, additionalInfo = {}) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Mettre à jour le profil Firebase Auth
    await updateProfile(user, { displayName });

    // Créer le profil utilisateur dans Firestore
    const userDocRef = doc(db, 'users', user.uid);
    const userData = {
      uid: user.uid,
      email: email,
      displayName: displayName,
      phone: additionalInfo.phone || '',
      address: additionalInfo.address || '',
      role: ROLES.USER, // Par défaut, utilisateur normal
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    try {
      await setDoc(userDocRef, userData);
      setUserProfile(userData);
    } catch (error) {
      console.error('Erreur création profil Firestore:', error);
      // En cas d'erreur, définir quand même le profil localement
      setUserProfile(userData);
    }

    return userCredential;
  }

  // Connexion - essaie d'abord Firebase, puis PostgreSQL si échec
  async function login(email, password) {
    // 1. Essayer d'abord Firebase
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential;
    } catch (firebaseError) {
      console.log('Firebase auth failed, trying PostgreSQL...', firebaseError.code);
      
      // 2. Si Firebase échoue, essayer PostgreSQL
      try {
        const response = await fetch(`${config.api.baseUrl}/api/utilisateurs/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, mot_de_passe: password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          // Si PostgreSQL échoue aussi, retourner l'erreur Firebase originale
          throw firebaseError;
        }
        
        // Connexion PostgreSQL réussie
        // Stocker le token et les infos utilisateur
        const pgUser = data.user;
        const role = pgUser.role_code || pgUser.role || ROLES.USER;
        
        // Créer un profil local pour l'utilisateur PostgreSQL
        setCurrentUser({ 
          uid: `pg_${pgUser.id}`,
          email: pgUser.email,
          displayName: `${pgUser.prenom || ''} ${pgUser.nom || ''}`.trim() || pgUser.email,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          isPostgresUser: true
        });
        
        setUserProfile({
          uid: `pg_${pgUser.id}`,
          id: pgUser.id,
          email: pgUser.email,
          displayName: `${pgUser.prenom || ''} ${pgUser.nom || ''}`.trim() || pgUser.email,
          role: role,
          isPostgresUser: true,
          accessToken: data.accessToken
        });
        
        return { user: pgUser, isPostgresUser: true };
      } catch (pgError) {
        console.error('PostgreSQL auth also failed:', pgError);
        // Relancer l'erreur Firebase originale pour afficher le bon message
        throw firebaseError;
      }
    }
  }

  // Déconnexion
  function logout() {
    setUserProfile(null);
    setIsVisitor(false);
    return signOut(auth);
  }

  // Mode visiteur (sans connexion)
  function enableVisitorMode() {
    setCurrentUser(null);
    setUserProfile({ 
      role: ROLES.VISITEUR, 
      displayName: 'Visiteur',
      isVisitor: true 
    });
    setIsVisitor(true);
  }

  // Quitter le mode visiteur
  function exitVisitorMode() {
    setIsVisitor(false);
    setUserProfile(null);
  }

  // Réinitialisation du mot de passe
  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  // Mise à jour du profil utilisateur
  async function updateUserProfile(updates) {
    if (!currentUser) throw new Error("Aucun utilisateur connecté");

    const userDocRef = doc(db, 'users', currentUser.uid);
    
    // Mettre à jour Firebase Auth si nécessaire
    if (updates.displayName) {
      await updateProfile(currentUser, { displayName: updates.displayName });
    }
    if (updates.email && updates.email !== currentUser.email) {
      await updateEmail(currentUser, updates.email);
    }

    // Mettre à jour Firestore
    const firestoreUpdates = {
      ...updates,
      updatedAt: new Date().toISOString()
    };
    await updateDoc(userDocRef, firestoreUpdates);

    // Mettre à jour l'état local
    setUserProfile(prev => ({ ...prev, ...firestoreUpdates }));
  }

  // Mise à jour du mot de passe
  async function changePassword(newPassword) {
    if (!currentUser) throw new Error("Aucun utilisateur connecté");
    return updatePassword(currentUser, newPassword);
  }

  // Récupérer le profil utilisateur depuis Firestore
  async function fetchUserProfile(uid, userInfo = {}) {
    try {
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);
      
      // Récupérer le rôle depuis le backend
      const backendRole = await fetchUserRoleFromBackend(userInfo.email || auth.currentUser?.email);
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        // Priorité au rôle du backend PostgreSQL
        const profileWithRole = { 
          ...data, 
          role: backendRole,
          isVisitor: false 
        };
        setUserProfile(profileWithRole);
        return profileWithRole;
      }
      // Si le document n'existe pas, créer un profil par défaut
      const defaultProfile = {
        uid: uid,
        email: userInfo.email || auth.currentUser?.email || '',
        displayName: userInfo.displayName || auth.currentUser?.displayName || 'Utilisateur',
        role: backendRole,
        isVisitor: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(userDocRef, defaultProfile);
      setUserProfile(defaultProfile);
      return defaultProfile;
    } catch (error) {
      console.error('Erreur fetchUserProfile:', error);
      // En cas d'erreur (offline, etc.), créer un profil temporaire
      const tempProfile = {
        uid: uid,
        email: userInfo.email || auth.currentUser?.email || '',
        displayName: userInfo.displayName || auth.currentUser?.displayName || 'Utilisateur',
        role: ROLES.USER,
        isVisitor: false
      };
      setUserProfile(tempProfile);
      return tempProfile;
    }
  }

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setCurrentUser(user);
        if (user) {
          await fetchUserProfile(user.uid, { email: user.email, displayName: user.displayName });
        } else {
          setUserProfile(null);
        }
      } catch (error) {
        console.error("Erreur lors de la récupération du profil:", error);
        setUserProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    loading,
    isVisitor,
    signup,
    login,
    logout,
    resetPassword,
    updateUserProfile,
    changePassword,
    fetchUserProfile,
    enableVisitorMode,
    exitVisitorMode,
    ROLES
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          backgroundColor: '#1a1a2e',
          color: '#fff',
          fontSize: '18px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>🚧</div>
            <p>Chargement...</p>
          </div>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
}
