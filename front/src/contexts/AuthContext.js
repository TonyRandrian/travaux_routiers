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

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

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
      role: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await setDoc(userDocRef, userData);
    setUserProfile(userData);

    return userCredential;
  }

  // Connexion
  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  // Déconnexion
  function logout() {
    setUserProfile(null);
    return signOut(auth);
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
  async function fetchUserProfile(uid) {
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const data = userDoc.data();
      setUserProfile(data);
      return data;
    }
    return null;
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserProfile(user.uid);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    signup,
    login,
    logout,
    resetPassword,
    updateUserProfile,
    changePassword,
    fetchUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
