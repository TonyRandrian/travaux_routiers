import React, { useState } from 'react';
import { useAuth, ROLES } from '../../contexts/AuthContext';
import './Auth.css';

function Login({ onSwitchToRegister, onForgotPassword, onLoginSuccess, onVisitorMode, onAccessDenied }) {
  const [email, setEmail] = useState('manager@test.mg');
  const [password, setPassword] = useState('manager');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, enableVisitorMode } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setError('');
      setLoading(true);
      const result = await login(email, password);
      
      // Vérifier le rôle de l'utilisateur après connexion
      const userRole = result?.user?.role_code || result?.user?.role || 
                       result?.userProfile?.role || ROLES.USER;
      
      // Si c'est un utilisateur simple, rediriger vers access-denied
      if (userRole === ROLES.USER) {
        if (onAccessDenied) {
          onAccessDenied();
        }
      } else {
        // Rediriger vers l'app après connexion réussie
        if (onLoginSuccess) {
          onLoginSuccess();
        }
      }
    } catch (error) {
      console.error(error);
      switch (error.code) {
        case 'auth/user-not-found':
          setError('Aucun compte trouvé avec cet email');
          break;
        case 'auth/wrong-password':
          setError('Email ou mot de passe incorrect');
          break;
        case 'auth/invalid-email':
          setError('Email invalide');
          break;
        case 'auth/too-many-requests':
          setError('Trop de tentatives. Réessayez plus tard');
          break;
        case 'auth/user-blocked':
          setError('Compte bloqué. Contactez un administrateur.');
          break;
        default:
          // Afficher le message d'erreur du serveur si disponible
          if (error.message) {
            setError(error.message);
          } else {
            setError('Erreur lors de la connexion');
          }
          // Afficher les tentatives restantes si disponibles
          if (error.tentatives_restantes !== undefined) {
            setError(prev => `${prev} (${error.tentatives_restantes} tentative(s) restante(s))`);
          }
      }
    }
    setLoading(false);
  }

  function handleVisitorMode() {
    enableVisitorMode();
    if (onVisitorMode) {
      onVisitorMode();
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon">🚧</div>
          <h2>Connexion</h2>
          <p>Travaux Routiers - Antananarivo</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Mot de passe</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <div className="auth-links">
          <button 
            type="button" 
            className="link-button"
            onClick={onForgotPassword}
          >
            Mot de passe oublié ?
          </button>
          <p>
            Pas encore de compte ?{' '}
            <button 
              type="button" 
              className="link-button highlight"
              onClick={onSwitchToRegister}
            >
              S'inscrire
            </button>
          </p>
        </div>

        <div className="auth-divider">
          <span>ou</span>
        </div>

        <button 
          type="button" 
          className="visitor-mode-button"
          onClick={handleVisitorMode}
        >
          <span className="visitor-icon">👁️</span>
          Continuer en tant que visiteur
        </button>
        <p className="visitor-info">
          Les visiteurs peuvent consulter la carte des travaux routiers sans créer de compte.
        </p>
      </div>
    </div>
  );
}

export default Login;
