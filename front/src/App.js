import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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

// Protected Route Component
function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/" replace />;
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
  const { userProfile } = useAuth();

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

// Auth Pages with redirect
function LoginPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      navigate('/app', { replace: true });
    }
  }, [currentUser, navigate]);

  return (
    <Login 
      onSwitchToRegister={() => navigate('/register')}
      onForgotPassword={() => navigate('/forgot-password')}
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