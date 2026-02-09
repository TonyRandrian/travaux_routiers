import React, { createContext, useContext, useState, useEffect } from 'react';
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

  // Récupérer le token d'accès stocké
  function getAccessToken() {
    const savedProfile = localStorage.getItem('pgUserProfile');
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        return profile.accessToken;
      } catch (e) {
        return null;
      }
    }
    return userProfile?.accessToken || null;
  }

  // Inscription via PostgreSQL
  async function signup(email, password, displayName, additionalInfo = {}) {
    const nameParts = displayName.split(' ');
    const prenom = nameParts[0] || '';
    const nom = nameParts.slice(1).join(' ') || '';

    const response = await fetch(`${config.api.baseUrl}/api/utilisateurs/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email, 
        mot_de_passe: password,
        nom: nom,
        prenom: prenom
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || 'Erreur lors de l\'inscription');
      if (data.error && data.error.includes('déjà utilisé')) {
        error.code = 'auth/email-already-in-use';
      }
      throw error;
    }

    // Après inscription, connecter automatiquement l'utilisateur
    return await login(email, password);
  }

  // Connexion via PostgreSQL uniquement
  async function login(email, password) {
    const response = await fetch(`${config.api.baseUrl}/api/utilisateurs/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, mot_de_passe: password })
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || 'Erreur lors de la connexion');
      if (data.bloque) {
        error.code = 'auth/user-blocked';
      } else if (response.status === 401) {
        error.code = 'auth/wrong-password';
      }
      error.tentatives_restantes = data.tentatives_restantes;
      throw error;
    }

    // Connexion réussie
    const pgUser = data.user;
    const role = pgUser.role_code || pgUser.role || ROLES.USER;

    // Créer un objet utilisateur local
    const userObj = { 
      uid: `pg_${pgUser.id}`,
      id: pgUser.id,
      email: pgUser.email,
      displayName: `${pgUser.prenom || ''} ${pgUser.nom || ''}`.trim() || pgUser.email,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken
    };
    setCurrentUser(userObj);

    const profileObj = {
      uid: `pg_${pgUser.id}`,
      id: pgUser.id,
      email: pgUser.email,
      displayName: `${pgUser.prenom || ''} ${pgUser.nom || ''}`.trim() || pgUser.email,
      nom: pgUser.nom,
      prenom: pgUser.prenom,
      role: role,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken
    };
    setUserProfile(profileObj);

    // Sauvegarder la session dans localStorage
    localStorage.setItem('pgUser', JSON.stringify(userObj));
    localStorage.setItem('pgUserProfile', JSON.stringify(profileObj));

    return { user: pgUser, userProfile: profileObj };
  }

  // Déconnexion
  function logout() {
    setCurrentUser(null);
    setUserProfile(null);
    setIsVisitor(false);
    // Nettoyer la session du localStorage
    localStorage.removeItem('pgUser');
    localStorage.removeItem('pgUserProfile');
    return Promise.resolve();
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

  // Réinitialisation du mot de passe (via backend)
  async function resetPassword(email) {
    const response = await fetch(`${config.api.baseUrl}/api/utilisateurs/reset-password-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    if (!response.ok) {
      const data = await response.json();
      const error = new Error(data.error || 'Erreur lors de la demande de réinitialisation');
      if (response.status === 404) {
        error.code = 'auth/user-not-found';
      }
      throw error;
    }

    return response.json();
  }

  // Mise à jour du profil utilisateur via PostgreSQL
  async function updateUserProfile(updates) {
    if (!currentUser) throw new Error("Aucun utilisateur connecté");

    const token = getAccessToken();
    if (!token) throw new Error("Session expirée");

    const response = await fetch(`${config.api.baseUrl}/api/utilisateurs/profile`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        nom: updates.nom || updates.displayName?.split(' ').slice(1).join(' '),
        prenom: updates.prenom || updates.displayName?.split(' ')[0],
        email: updates.email
      })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Erreur lors de la mise à jour du profil');
    }

    // Mettre à jour l'état local
    const updatedProfile = {
      ...userProfile,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    setUserProfile(updatedProfile);
    localStorage.setItem('pgUserProfile', JSON.stringify(updatedProfile));

    return updatedProfile;
  }

  // Mise à jour du mot de passe via PostgreSQL
  async function changePassword(newPassword) {
    if (!currentUser) throw new Error("Aucun utilisateur connecté");

    const token = getAccessToken();
    if (!token) throw new Error("Session expirée");

    const response = await fetch(`${config.api.baseUrl}/api/utilisateurs/change-password`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ nouveau_mot_de_passe: newPassword })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Erreur lors du changement de mot de passe');
    }

    return response.json();
  }

  // Rafraîchir le token d'accès
  async function refreshAccessToken() {
    const savedProfile = localStorage.getItem('pgUserProfile');
    if (!savedProfile) return false;

    try {
      const profile = JSON.parse(savedProfile);
      const response = await fetch(`${config.api.baseUrl}/api/utilisateurs/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: profile.refreshToken })
      });

      if (!response.ok) {
        // Token expiré, déconnecter l'utilisateur
        logout();
        return false;
      }

      const data = await response.json();
      
      // Mettre à jour le token
      const updatedProfile = { ...profile, accessToken: data.accessToken };
      const updatedUser = { ...currentUser, accessToken: data.accessToken };
      
      setUserProfile(updatedProfile);
      setCurrentUser(updatedUser);
      localStorage.setItem('pgUserProfile', JSON.stringify(updatedProfile));
      localStorage.setItem('pgUser', JSON.stringify(updatedUser));

      return true;
    } catch (e) {
      console.error('Erreur refresh token:', e);
      return false;
    }
  }

  useEffect(() => {
    setLoading(true);

    // Vérifier s'il y a une session sauvegardée ET valider le token côté serveur
    const savedPgUser = localStorage.getItem('pgUser');
    const savedPgProfile = localStorage.getItem('pgUserProfile');

    if (savedPgUser && savedPgProfile) {
      try {
        const pgUser = JSON.parse(savedPgUser);
        const pgProfile = JSON.parse(savedPgProfile);
        const token = pgProfile.accessToken;

        if (!token) {
          // Pas de token, session invalide
          localStorage.removeItem('pgUser');
          localStorage.removeItem('pgUserProfile');
          setLoading(false);
          return;
        }

        // Valider le token côté serveur
        fetch(`${config.api.baseUrl}/api/utilisateurs/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(response => {
            if (response.ok) {
              // Token valide, restaurer la session
              setCurrentUser(pgUser);
              setUserProfile(pgProfile);
            } else {
              // Token expiré ou invalide, nettoyer la session
              console.warn('Session expirée, reconnexion nécessaire');
              localStorage.removeItem('pgUser');
              localStorage.removeItem('pgUserProfile');
            }
            setLoading(false);
          })
          .catch(() => {
            // Erreur réseau (API hors ligne), on nettoie quand même pour forcer le login
            console.warn('API inaccessible, session nettoyée');
            localStorage.removeItem('pgUser');
            localStorage.removeItem('pgUserProfile');
            setLoading(false);
          });
      } catch (e) {
        console.error('Erreur parsing session:', e);
        localStorage.removeItem('pgUser');
        localStorage.removeItem('pgUserProfile');
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
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
    refreshAccessToken,
    getAccessToken,
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
