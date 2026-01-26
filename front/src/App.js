import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import './App.css';
import MapComponent from './components/MapComponent';
import Dashboard from './components/Dashboard/Dashboard';
import ManagerPanel from './components/Manager/ManagerPanel';
import config from './config/config';
import { AuthProvider, useAuth, ROLES } from './contexts/AuthContext';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import ForgotPassword from './components/Auth/ForgotPassword';
import UserProfile from './components/Profile/UserProfile';

// Protected Route Component (pour les utilisateurs connectés)
// Seuls les VISITEURS et MANAGERS ont accès au web
// Les USER (utilisateurs simples) doivent utiliser l'app mobile
function ProtectedRoute({ children }) {
  const { currentUser, isVisitor, userProfile } = useAuth();
  
  // Si mode visiteur activé, autoriser
  if (isVisitor) {
    return children;
  }
  
  // Si pas connecté, rediriger vers login
  if (!currentUser && !userProfile) {
    return <Navigate to="/" replace />;
  }
  
  // Si connecté, vérifier le rôle
  const role = userProfile?.role;
  
  // Seuls VISITEUR et MANAGER peuvent accéder au web
  if (role === ROLES.USER) {
    // Les utilisateurs simples sont redirigés vers une page d'accès refusé
    return <Navigate to="/access-denied" replace />;
  }
  
  return children;
}

// Page d'accès refusé pour les utilisateurs mobiles
function AccessDeniedPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  
  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };
  
  return (
    <div className="access-denied-container">
      <div className="access-denied-card">
        <div className="access-denied-icon">📱</div>
        <h2>Accès réservé</h2>
        <p>
          Votre compte est de type <strong>Utilisateur</strong>.<br />
          L'accès au site web est réservé aux <strong>Managers</strong> et aux <strong>Visiteurs</strong>.
        </p>
        <p className="mobile-hint">
          Veuillez utiliser l'<strong>application mobile</strong> pour signaler et suivre les travaux routiers.
        </p>
        <div className="access-denied-actions">
          <button className="back-btn" onClick={handleLogout}>
            ← Retour à la connexion
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Application Component
function MainApp() {
  const [message, setMessage] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [showManagerPanel, setShowManagerPanel] = useState(false);
  const [signalements, setSignalements] = useState([]);
  const [stats, setStats] = useState({});
  const [loadingStats, setLoadingStats] = useState(true);
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'dashboard'
  const { userProfile, isVisitor, logout, exitVisitorMode } = useAuth();
  const navigate = useNavigate();

  // Charger les signalements depuis l'API
  const fetchSignalements = async () => {
    try {
      const response = await fetch(`${config.api.baseUrl}/api/signalements`);
      const data = await response.json();
      // S'assurer que data est un tableau
      if (Array.isArray(data)) {
        setSignalements(data);
      } else {
        console.warn('API retour non-tableau, initialisation array vide');
        setSignalements([]);
      }
    } catch (error) {
      console.error('Erreur chargement signalements:', error);
      setSignalements([]);
    }
  };

  // Charger les statistiques
  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const response = await fetch(`${config.api.baseUrl}/api/signalements/stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    }
    setLoadingStats(false);
  };

  useEffect(() => {
    // Vérifier la connexion à l'API
    fetch(`${config.api.baseUrl}/`)
      .then(response => response.json())
      .then(data => setMessage(data.message || 'Connecté'))
      .catch(() => setMessage('API hors ligne'));

    // Charger les données
    fetchSignalements();
    fetchStats();
  }, []);

  // Rafraîchir les données quand le manager panel se ferme
  const handleManagerClose = () => {
    setShowManagerPanel(false);
    fetchSignalements();
    fetchStats();
  };

  // Vérifier si l'utilisateur est manager
  const isManager = userProfile?.role === ROLES.MANAGER;
  
  // Vérifier si l'utilisateur est un visiteur
  const isVisitorMode = isVisitor || userProfile?.role === ROLES.VISITEUR || userProfile?.isVisitor;

  // Gérer la déconnexion ou sortie mode visiteur
  const handleLogoutOrExit = async () => {
    if (isVisitorMode) {
      exitVisitorMode();
    } else {
      await logout();
    }
    navigate('/', { replace: true });
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-top">
          <div className="header-brand">
            <span className="brand-icon">🚧</span>
            <h1>Travaux Routiers</h1>
          </div>
          <div className="header-actions">
            {isManager && (
              <button 
                className="manager-btn"
                onClick={() => setShowManagerPanel(true)}
              >
                🔧 Panel Manager
              </button>
            )}
            {isVisitorMode ? (
              <button className="visitor-btn" onClick={handleLogoutOrExit}>
                <span className="visitor-icon">👁️</span>
                <span>Mode Visiteur</span>
                <span className="exit-hint">Se connecter</span>
              </button>
            ) : (
              <button className="user-button" onClick={() => setShowProfile(true)}>
                <span className="user-avatar">
                  {userProfile?.displayName?.charAt(0)?.toUpperCase() || 'U'}
                </span>
                <span className="user-name">{userProfile?.displayName || 'Utilisateur'}</span>
                {isManager && <span className="role-badge manager">Manager</span>}
                {userProfile?.role === ROLES.USER && <span className="role-badge user">Utilisateur</span>}
              </button>
            )}
          </div>
        </div>
        <div className="header-info">
          <div className="info-item">
            <span className="label">Statut API:</span>
            <span className="value">{message || 'Chargement...'}</span>
          </div>
          <div className="view-toggle">
            <button 
              className={`toggle-btn ${viewMode === 'map' ? 'active' : ''}`}
              onClick={() => setViewMode('map')}
            >
              🗺️ Carte
            </button>
            <button 
              className={`toggle-btn ${viewMode === 'dashboard' ? 'active' : ''}`}
              onClick={() => setViewMode('dashboard')}
            >
              📊 Récapitulatif
            </button>
          </div>
          {/* Bouton Synchroniser visible uniquement pour le Manager */}
          {isManager && (
            <button className="refresh-btn" onClick={() => { fetchSignalements(); fetchStats(); }}>
              🔄 Synchroniser
            </button>
          )}
        </div>
      </header>
      
      <main className="main-content">
        {viewMode === 'map' ? (
          <div className="map-section">
            <div className="map-header">
              <h2>🗺️ Carte des travaux routiers - Antananarivo</h2>
              <p className="map-info">
                Centre: 18.8792°S, 47.5079°E | {signalements.length} signalement(s)
              </p>
            </div>
            <MapComponent 
              signalements={signalements}
              center={[config.map.center.lat, config.map.center.lng]}
              zoom={config.map.zoom}
            />
          </div>
        ) : (
          <Dashboard stats={stats} loading={loadingStats} />
        )}
      </main>

      {showProfile && !isVisitorMode && (
        <UserProfile onClose={() => setShowProfile(false)} />
      )}

      {showManagerPanel && isManager && (
        <ManagerPanel onClose={handleManagerClose} />
      )}
    </div>
  );
}

// Auth Pages with redirect
function LoginPage() {
  const navigate = useNavigate();
  const { currentUser, logout, isVisitor } = useAuth();

  // Déconnecter l'utilisateur s'il est déjà connecté pour forcer la reconnexion
  useEffect(() => {
    if (currentUser && !isVisitor) {
      logout();
    }
  }, []);

  const handleLoginSuccess = () => {
    navigate('/app', { replace: true });
  };

  const handleVisitorMode = () => {
    navigate('/app', { replace: true });
  };

  return (
    <Login 
      onSwitchToRegister={() => navigate('/register')}
      onForgotPassword={() => navigate('/forgot-password')}
      onLoginSuccess={handleLoginSuccess}
      onVisitorMode={handleVisitorMode}
    />
  );
}

function RegisterPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      navigate('/app', { replace: true });
    }
  }, [currentUser, navigate]);

  return (
    <Register onSwitchToLogin={() => navigate('/')} />
  );
}

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      navigate('/app', { replace: true });
    }
  }, [currentUser, navigate]);

  return (
    <ForgotPassword onBackToLogin={() => navigate('/')} />
  );
}

function AppContent() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/access-denied" element={<AccessDeniedPage />} />
        <Route 
          path="/app" 
          element={
            <ProtectedRoute>
              <MainApp />
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;