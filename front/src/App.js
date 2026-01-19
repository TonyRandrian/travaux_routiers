import React, { useState, useEffect } from 'react';
import './App.css';
import MapComponent from './components/MapComponent';
import Dashboard from './components/Dashboard/Dashboard';
import ManagerPanel from './components/Manager/ManagerPanel';
import config from './config/config';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import ForgotPassword from './components/Auth/ForgotPassword';
import UserProfile from './components/Profile/UserProfile';

function AppContent() {
  const [message, setMessage] = useState('');
  const [authView, setAuthView] = useState('login'); // 'login', 'register', 'forgot'
  const [showProfile, setShowProfile] = useState(false);
  const [showManagerPanel, setShowManagerPanel] = useState(false);
  const [signalements, setSignalements] = useState([]);
  const [stats, setStats] = useState({});
  const [loadingStats, setLoadingStats] = useState(true);
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'dashboard'
  const { currentUser, userProfile } = useAuth();

  // Charger les signalements depuis l'API
  const fetchSignalements = async () => {
    try {
      const response = await fetch(`${config.api.baseUrl}/api/signalements`);
      const data = await response.json();
      setSignalements(data);
    } catch (error) {
      console.error('Erreur chargement signalements:', error);
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
  const isManager = userProfile?.role === 'manager' || userProfile?.role === 'MANAGER';

  // Vue visiteur (sans connexion) - peut voir la carte et le récapitulatif
  const renderVisitorView = () => (
    <div className="App">
      <header className="App-header">
        <div className="header-top">
          <div className="header-brand">
            <span className="brand-icon">🚧</span>
            <h1>Travaux Routiers</h1>
          </div>
          <div className="header-actions">
            <button className="login-btn" onClick={() => setAuthView('login')}>
              🔐 Se connecter
            </button>
          </div>
        </div>
        <div className="header-info">
          <div className="info-item">
            <span className="label">Mode:</span>
            <span className="value">Visiteur</span>
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
        </div>
      </header>
      
      <main className="main-content">
        {viewMode === 'map' ? (
          <div className="map-section">
            <div className="map-header">
              <h2>🗺️ Carte des travaux routiers - Antananarivo</h2>
              <p className="map-info">{signalements.length} signalement(s)</p>
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

      {/* Modal de connexion pour visiteur */}
      {authView === 'login' && (
        <div className="auth-modal-overlay" onClick={() => setAuthView(null)}>
          <div onClick={e => e.stopPropagation()}>
            <Login 
              onSwitchToRegister={() => setAuthView('register')}
              onForgotPassword={() => setAuthView('forgot')}
            />
          </div>
        </div>
      )}
      {authView === 'register' && (
        <div className="auth-modal-overlay" onClick={() => setAuthView(null)}>
          <div onClick={e => e.stopPropagation()}>
            <Register onSwitchToLogin={() => setAuthView('login')} />
          </div>
        </div>
      )}
      {authView === 'forgot' && (
        <div className="auth-modal-overlay" onClick={() => setAuthView(null)}>
          <div onClick={e => e.stopPropagation()}>
            <ForgotPassword onBackToLogin={() => setAuthView('login')} />
          </div>
        </div>
      )}
    </div>
  );

  // Si l'utilisateur n'est pas connecté, afficher la vue visiteur
  if (!currentUser) {
    return renderVisitorView();
  }

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
            <button className="user-button" onClick={() => setShowProfile(true)}>
              <span className="user-avatar">
                {userProfile?.displayName?.charAt(0)?.toUpperCase() || 'U'}
              </span>
              <span className="user-name">{userProfile?.displayName || 'Utilisateur'}</span>
              {isManager && <span className="role-badge">Manager</span>}
            </button>
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
          <button className="refresh-btn" onClick={() => { fetchSignalements(); fetchStats(); }}>
            🔄 Actualiser
          </button>
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

      {showProfile && (
        <UserProfile onClose={() => setShowProfile(false)} />
      )}

      {showManagerPanel && isManager && (
        <ManagerPanel onClose={handleManagerClose} />
      )}
    </div>
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