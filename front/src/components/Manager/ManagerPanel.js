import React, { useState, useEffect } from 'react';
import config from '../../config/config';
import { useAuth } from '../../contexts/AuthContext';
import './ManagerPanel.css';

const ManagerPanel = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('users');
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [allSignalements, setAllSignalements] = useState([]);
  const [statuts, setStatuts] = useState([]);
  const [entreprises, setEntreprises] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [editingSignalement, setEditingSignalement] = useState(null);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncResults, setSyncResults] = useState(null);
  const [lastSyncInfo, setLastSyncInfo] = useState(null);
  const [firebaseAvailable, setFirebaseAvailable] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [viewingSignalement, setViewingSignalement] = useState(null);
  const [newUser, setNewUser] = useState({
    email: '',
    mot_de_passe: '',
    nom: '',
    prenom: '',
    role_code: 'USER'
  });
  
  const { currentUser, userProfile } = useAuth();

  // Fonction utilitaire pour récupérer le token (Firebase ou PostgreSQL)
  const getAuthToken = async () => {
    // Si c'est un utilisateur Firebase avec getIdToken
    if (currentUser && typeof currentUser.getIdToken === 'function') {
      return await currentUser.getIdToken();
    }
    // Si c'est un utilisateur PostgreSQL, utiliser le token stocké
    if (userProfile?.accessToken) {
      return userProfile.accessToken;
    }
    if (currentUser?.accessToken) {
      return currentUser.accessToken;
    }
    return null;
  };

  useEffect(() => {
    fetchBlockedUsers();
    fetchAllUsers();
    fetchRoles();
    fetchSignalements();
    fetchStatuts();
    fetchEntreprises();
    checkSyncStatus();
  }, []);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const fetchBlockedUsers = async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${config.api.baseUrl}/api/utilisateurs/bloques`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setBlockedUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erreur récupération utilisateurs bloqués:', err);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${config.api.baseUrl}/api/utilisateurs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAllUsers(data);
      }
    } catch (err) {
      console.error('Erreur récupération utilisateurs:', err);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await fetch(`${config.api.baseUrl}/api/utilisateurs/config/roles`);
      const data = await response.json();
      setRoles(data);
    } catch (err) {
      console.error('Erreur récupération rôles:', err);
    }
  };

  const fetchSignalements = async () => {
    try {
      const response = await fetch(`${config.api.baseUrl}/api/signalements`);
      const data = await response.json();
      setAllSignalements(data);
    } catch (err) {
      console.error('Erreur récupération signalements:', err);
    }
  };

  const fetchStatuts = async () => {
    try {
      const response = await fetch(`${config.api.baseUrl}/api/signalements/config/statuts`);
      const data = await response.json();
      setStatuts(data);
    } catch (err) {
      console.error('Erreur récupération statuts:', err);
    }
  };

  const fetchEntreprises = async () => {
    try {
      const response = await fetch(`${config.api.baseUrl}/api/signalements/config/entreprises`);
      const data = await response.json();
      setEntreprises(data);
    } catch (err) {
      console.error('Erreur récupération entreprises:', err);
    }
  };

  const handleUnblockUser = async (userId) => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${config.api.baseUrl}/api/utilisateurs/${userId}/debloquer`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        showMessage('success', 'Utilisateur débloqué avec succès');
        fetchBlockedUsers();
        fetchAllUsers();
      } else {
        const data = await response.json();
        showMessage('error', data.error || 'Erreur lors du déblocage');
      }
    } catch (err) {
      showMessage('error', 'Erreur de connexion');
    }
    setLoading(false);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${config.api.baseUrl}/api/utilisateurs/create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newUser)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showMessage('success', 'Utilisateur créé avec succès');
        setShowCreateUser(false);
        setNewUser({ email: '', mot_de_passe: '', nom: '', prenom: '', role_code: 'USER' });
        fetchAllUsers();
      } else {
        showMessage('error', data.error || 'Erreur lors de la création');
      }
    } catch (err) {
      showMessage('error', 'Erreur de connexion');
    }
    setLoading(false);
  };

  const handleChangeUserRole = async (userId, newRoleCode) => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${config.api.baseUrl}/api/utilisateurs/${userId}/role`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role_code: newRoleCode })
      });
      
      if (response.ok) {
        showMessage('success', 'Rôle modifié avec succès');
        fetchAllUsers();
      } else {
        const data = await response.json();
        showMessage('error', data.error || 'Erreur lors du changement de rôle');
      }
    } catch (err) {
      showMessage('error', 'Erreur de connexion');
    }
    setLoading(false);
  };

  const handleUpdateSignalement = async (id, updates) => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${config.api.baseUrl}/api/signalements/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        showMessage('success', 'Signalement mis à jour');
        fetchSignalements();
        setEditingSignalement(null);
      } else {
        const data = await response.json();
        showMessage('error', data.error || 'Erreur lors de la mise à jour');
      }
    } catch (err) {
      showMessage('error', 'Erreur de connexion');
    }
    setLoading(false);
  };

  const handleSync = async () => {
    setSyncStatus('syncing');
    setSyncResults(null);
    
    try {
      // Récupérer le token d'authentification
      const token = await getAuthToken();
      
      // Appeler l'API de synchronisation bidirectionnelle
      const response = await fetch(`${config.api.baseUrl}/api/sync/all`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSyncStatus('success');
        setSyncResults(data.results);
        showMessage('success', data.message || 'Synchronisation terminée avec succès');
        fetchSignalements();
        checkSyncStatus();
      } else if (response.status === 503) {
        setSyncStatus('unavailable');
        showMessage('warning', 'Firebase non configuré sur le serveur');
      } else {
        setSyncStatus('error');
        showMessage('error', data.error || 'Erreur lors de la synchronisation');
      }
      
      setTimeout(() => setSyncStatus(''), 5000);
    } catch (err) {
      setSyncStatus('error');
      showMessage('error', 'Erreur de connexion au serveur');
      setTimeout(() => setSyncStatus(''), 3000);
    }
  };

  // Synchroniser uniquement depuis Firestore (récupérer les signalements mobiles)
  const handleSyncFromFirestore = async () => {
    setSyncStatus('syncing');
    try {
      const token = await getAuthToken();
      const response = await fetch(`${config.api.baseUrl}/api/sync/from-firestore`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSyncStatus('success');
        setSyncResults({ fromFirestore: data.results });
        showMessage('success', `${data.results.imported} signalement(s) importé(s) depuis Firebase`);
        fetchSignalements();
      } else {
        setSyncStatus('error');
        showMessage('error', data.error || 'Erreur lors de l\'import');
      }
      
      setTimeout(() => setSyncStatus(''), 3000);
    } catch (err) {
      setSyncStatus('error');
      showMessage('error', 'Erreur de connexion');
      setTimeout(() => setSyncStatus(''), 3000);
    }
  };

  // Synchroniser uniquement vers Firestore (envoyer les mises à jour)
  const handleSyncToFirestore = async () => {
    setSyncStatus('syncing');
    try {
      const token = await getAuthToken();
      const response = await fetch(`${config.api.baseUrl}/api/sync/to-firestore`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSyncStatus('success');
        setSyncResults({ toFirestore: data.results });
        showMessage('success', `${data.results.exported} exporté(s), ${data.results.updated} mis à jour vers Firebase`);
      } else {
        setSyncStatus('error');
        showMessage('error', data.error || 'Erreur lors de l\'export');
      }
      
      setTimeout(() => setSyncStatus(''), 3000);
    } catch (err) {
      setSyncStatus('error');
      showMessage('error', 'Erreur de connexion');
      setTimeout(() => setSyncStatus(''), 3000);
    }
  };

  // Vérifier le statut de la synchronisation
  const checkSyncStatus = async () => {
    try {
      const response = await fetch(`${config.api.baseUrl}/api/sync/status`);
      const data = await response.json();
      setFirebaseAvailable(data.available);
      setLastSyncInfo(data.lastSync);
    } catch (err) {
      setFirebaseAvailable(false);
    }
  };

  const getStatusColor = (code) => {
    switch (code) {
      case 'NOUVEAU': return '#f44336';
      case 'EN_COURS': return '#FF9800';
      case 'TERMINE': return '#4CAF50';
      default: return '#9E9E9E';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  return (
    <div className="manager-overlay">
      <div className="manager-panel">
        <div className="manager-header">
          <h2>🔧 Panel Manager</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="manager-tabs">
          <button 
            className={`tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            👥 Utilisateurs bloqués ({blockedUsers.length})
          </button>
          <button 
            className={`tab ${activeTab === 'create-user' ? 'active' : ''}`}
            onClick={() => setActiveTab('create-user')}
          >
            ➕ Créer utilisateur
          </button>
          <button 
            className={`tab ${activeTab === 'roles' ? 'active' : ''}`}
            onClick={() => setActiveTab('roles')}
          >
            🎭 Gestion des rôles ({allUsers.length})
          </button>
          <button 
            className={`tab ${activeTab === 'signalements' ? 'active' : ''}`}
            onClick={() => setActiveTab('signalements')}
          >
            📍 Gestion signalements ({allSignalements.length})
          </button>
          <button 
            className={`tab ${activeTab === 'sync' ? 'active' : ''}`}
            onClick={() => setActiveTab('sync')}
          >
            🔄 Synchronisation
          </button>
        </div>

        <div className="manager-content">
          {/* Onglet Utilisateurs Bloqués */}
          {activeTab === 'users' && (
            <div className="users-section">
              <h3>Utilisateurs bloqués</h3>
              {blockedUsers.length === 0 ? (
                <p className="empty-message">Aucun utilisateur bloqué</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Nom</th>
                      <th>Tentatives</th>
                      <th>Date inscription</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockedUsers.map(user => (
                      <tr key={user.id}>
                        <td>{user.email}</td>
                        <td>{user.prenom} {user.nom}</td>
                        <td className="tentatives">{user.tentatives}</td>
                        <td>{formatDate(user.created_at)}</td>
                        <td>
                          <button 
                            className="action-btn unblock"
                            onClick={() => handleUnblockUser(user.id)}
                            disabled={loading}
                          >
                            🔓 Débloquer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Onglet Créer Utilisateur */}
          {activeTab === 'create-user' && (
            <div className="create-user-section">
              <h3>➕ Créer un nouvel utilisateur</h3>
              <p className="section-description">
                Créez un compte utilisateur pour l'application mobile. Les utilisateurs créés ici auront par défaut le rôle <strong>USER</strong> et pourront signaler des travaux routiers via l'application mobile.
              </p>
              
              <div className="create-user-form standalone">
                <form onSubmit={handleCreateUser}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Email *</label>
                      <input
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                        placeholder="utilisateur@example.com"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Mot de passe *</label>
                      <input
                        type="password"
                        value={newUser.mot_de_passe}
                        onChange={(e) => setNewUser({...newUser, mot_de_passe: e.target.value})}
                        placeholder="Minimum 6 caractères"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Prénom</label>
                      <input
                        type="text"
                        value={newUser.prenom}
                        onChange={(e) => setNewUser({...newUser, prenom: e.target.value})}
                        placeholder="Prénom de l'utilisateur"
                      />
                    </div>
                    <div className="form-group">
                      <label>Nom</label>
                      <input
                        type="text"
                        value={newUser.nom}
                        onChange={(e) => setNewUser({...newUser, nom: e.target.value})}
                        placeholder="Nom de l'utilisateur"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Rôle</label>
                      <select
                        value={newUser.role_code}
                        onChange={(e) => setNewUser({...newUser, role_code: e.target.value})}
                      >
                        <option value="USER">Utilisateur (USER) - Application mobile</option>
                        <option value="MANAGER">Manager (MANAGER) - Accès complet</option>
                      </select>
                      <small className="form-hint">
                        USER = Application mobile uniquement | MANAGER = Accès web + mobile
                      </small>
                    </div>
                  </div>
                  <div className="form-actions-center">
                    <button type="submit" className="create-btn large" disabled={loading}>
                      {loading ? '⏳ Création en cours...' : '✓ Créer l\'utilisateur'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="created-users-info">
                <h4>📋 Derniers utilisateurs créés</h4>
                <p>Total : <strong>{allUsers.length}</strong> utilisateur(s) enregistré(s)</p>
                <div className="recent-users">
                  {allUsers.slice(-5).reverse().map(user => (
                    <div key={user.id} className="recent-user-item">
                      <span className={`role-badge ${user.role_code?.toLowerCase()}`}>{user.role_code}</span>
                      <span className="user-email">{user.email}</span>
                      <span className="user-name">{user.prenom} {user.nom}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Onglet Gestion des Rôles */}
          {activeTab === 'roles' && (
            <div className="roles-section">
              <div className="section-header">
                <h3>Gestion des rôles utilisateurs</h3>
              </div>

              <div className="roles-legend">
                <span className="role-tag visiteur">VISITEUR</span> - Consultation uniquement (pas de compte)
                <span className="role-tag user">USER</span> - Peut signaler des travaux (mobile)
                <span className="role-tag manager">MANAGER</span> - Accès complet + synchronisation
              </div>
              {allUsers.length === 0 ? (
                <p className="empty-message">Aucun utilisateur inscrit</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Nom complet</th>
                      <th>Rôle actuel</th>
                      <th>Statut</th>
                      <th>Changer le rôle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map(user => (
                      <tr key={user.id}>
                        <td>{user.email}</td>
                        <td>{user.prenom} {user.nom}</td>
                        <td>
                          <span className={`role-tag ${user.role_code?.toLowerCase() || 'user'}`}>
                            {user.role || user.role_code || 'USER'}
                          </span>
                        </td>
                        <td>
                          {user.bloque ? (
                            <span className="status-tag blocked">🔒 Bloqué</span>
                          ) : (
                            <span className="status-tag active">✓ Actif</span>
                          )}
                        </td>
                        <td>
                          <select 
                            className="role-select"
                            value={user.role_code || 'USER'}
                            onChange={(e) => handleChangeUserRole(user.id, e.target.value)}
                            disabled={loading}
                          >
                            {roles.map(role => (
                              <option key={role.id} value={role.code}>
                                {role.libelle} ({role.code})
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Onglet Signalements */}
          {activeTab === 'signalements' && (
            <div className="signalements-section">
              <h3>Gestion des signalements</h3>
              {allSignalements.length === 0 ? (
                <p className="empty-message">Aucun signalement</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Titre</th>
                      <th>Statut</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allSignalements.map(sig => (
                      <tr key={sig.id}>
                        <td>{sig.titre || 'Sans titre'}</td>
                        <td>
                          <span 
                            className="status-badge"
                            style={{ background: getStatusColor(sig.statut_code) }}
                          >
                            {sig.statut || 'N/A'}
                          </span>
                        </td>
                        <td>{formatDate(sig.date_signalement)}</td>
                        <td className="actions-cell">
                          <button 
                            className="action-btn view"
                            onClick={() => setViewingSignalement(sig)}
                          >
                            👁️ Détails
                          </button>
                          <button 
                            className="action-btn edit"
                            onClick={() => setEditingSignalement(sig)}
                          >
                            ✏️ Modifier
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Onglet Synchronisation */}
          {activeTab === 'sync' && (
            <div className="sync-section">
              <h3>Synchronisation Firebase ↔ PostgreSQL</h3>
              
              {/* Statut Firebase */}
              <div className={`firebase-status ${firebaseAvailable ? 'available' : 'unavailable'}`}>
                <span className="status-indicator"></span>
                <span>Firebase: {firebaseAvailable ? 'Connecté' : 'Non configuré'}</span>
              </div>

              {/* Dernière synchronisation */}
              {lastSyncInfo && (
                <div className="last-sync-info">
                  <strong>Dernière synchronisation:</strong> {new Date(lastSyncInfo.timestamp).toLocaleString('fr-FR')}
                  <br />
                  <small>Exportés: {lastSyncInfo.exported} | Mis à jour: {lastSyncInfo.updated} | Total: {lastSyncInfo.total}</small>
                </div>
              )}

              {/* Boutons de synchronisation */}
              <div className="sync-actions">
                <div className="sync-row">
                  <div className="sync-card">
                    <div className="sync-icon">📥</div>
                    <h4>Import depuis Firebase</h4>
                    <p>Récupérer les signalements créés depuis l'app mobile</p>
                    <button 
                      className="sync-btn secondary"
                      onClick={handleSyncFromFirestore}
                      disabled={syncStatus === 'syncing' || !firebaseAvailable}
                    >
                      📥 Importer
                    </button>
                  </div>

                  <div className="sync-card">
                    <div className="sync-icon">📤</div>
                    <h4>Export vers Firebase</h4>
                    <p>Envoyer les mises à jour vers l'app mobile</p>
                    <button 
                      className="sync-btn secondary"
                      onClick={handleSyncToFirestore}
                      disabled={syncStatus === 'syncing' || !firebaseAvailable}
                    >
                      📤 Exporter
                    </button>
                  </div>
                </div>
              </div>

              {/* Résultats de la synchronisation */}
              {syncResults && (
                <div className="sync-results">
                  <h4>📊 Résultats de la dernière synchronisation</h4>
                  {syncResults.fromFirestore && (
                    <div className="result-section">
                      <strong>Import depuis Firestore:</strong>
                      <ul>
                        <li>✅ Importés: {syncResults.fromFirestore.imported || 0}</li>
                        <li>🔄 Mis à jour: {syncResults.fromFirestore.updated || 0}</li>
                        {syncResults.fromFirestore.errors?.length > 0 && (
                          <li>❌ Erreurs: {syncResults.fromFirestore.errors.length}</li>
                        )}
                      </ul>
                    </div>
                  )}
                  {syncResults.toFirestore && (
                    <div className="result-section">
                      <strong>Export vers Firestore:</strong>
                      <ul>
                        <li>✅ Exportés: {syncResults.toFirestore.exported || 0}</li>
                        <li>🔄 Mis à jour: {syncResults.toFirestore.updated || 0}</li>
                        {syncResults.toFirestore.errors?.length > 0 && (
                          <li>❌ Erreurs: {syncResults.toFirestore.errors.length}</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Informations */}
              <div className="sync-info">
                <h4>ℹ️ Informations</h4>
                <ul>
                  <li>📥 <strong>Import:</strong> Récupère les nouveaux signalements créés depuis l'app mobile</li>
                  <li>📤 <strong>Export:</strong> Envoie les statuts, budgets et entreprises vers l'app mobile</li>
                  <li>🔄 <strong>Sync complète:</strong> Effectue les deux opérations</li>
                </ul>
                {!firebaseAvailable && (
                  <div className="warning-box">
                    ⚠️ Firebase n'est pas configuré sur le serveur. Contactez l'administrateur pour configurer les credentials Firebase.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal de visualisation des détails */}
        {viewingSignalement && (
          <DetailSignalementModal
            signalement={viewingSignalement}
            getStatusColor={getStatusColor}
            formatDate={formatDate}
            onClose={() => setViewingSignalement(null)}
            onEdit={(sig) => {
              setViewingSignalement(null);
              setEditingSignalement(sig);
            }}
          />
        )}

        {/* Modal d'édition de signalement */}
        {editingSignalement && (
          <EditSignalementModal
            signalement={editingSignalement}
            statuts={statuts}
            entreprises={entreprises}
            onSave={handleUpdateSignalement}
            onClose={() => setEditingSignalement(null)}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
};

// Composant Modal de visualisation des détails
const DetailSignalementModal = ({ signalement, getStatusColor, formatDate, onClose, onEdit }) => {
  const formatCurrency = (amount) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'MGA',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="modal-overlay">
      <div className="detail-modal">
        <div className="modal-header">
          <h3>📋 Détails du signalement</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        {/* Galerie de photos */}
        {signalement.photos && signalement.photos.length > 0 ? (
          <div className="photos-gallery detail-photos">
            <h4>📷 Photos ({signalement.photos.length})</h4>
            <div className="photos-grid">
              {signalement.photos.map((photo, idx) => (
                <div key={photo.id || idx} className="photo-item">
                  <img 
                    src={photo.url}
                    alt={photo.nom_fichier || `Photo ${idx + 1}`}
                    onClick={() => window.open(photo.url, '_blank')}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="photos-gallery no-photos">
            <p>📷 Aucune photo disponible</p>
          </div>
        )}
        
        <div className="detail-content">
          <div className="detail-header">
            <h2>{signalement.titre || 'Sans titre'}</h2>
            <span 
              className="status-badge large"
              style={{ background: getStatusColor(signalement.statut_code) }}
            >
              {signalement.statut || 'N/A'}
            </span>
          </div>
          
          {signalement.description && (
            <div className="detail-description">
              <p>{signalement.description}</p>
            </div>
          )}
          
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">📅 Date de signalement</span>
              <span className="detail-value">{formatDate(signalement.date_signalement)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">📐 Surface</span>
              <span className="detail-value">{signalement.surface_m2 ? `${signalement.surface_m2} m²` : 'N/A'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">💰 Budget</span>
              <span className="detail-value">{formatCurrency(signalement.budget)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">⚠️ Niveau</span>
              <span className="detail-value">{signalement.type_reparation !== null && signalement.type_reparation !== undefined ? signalement.type_reparation : '0'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">🏢 Entreprise</span>
              <span className="detail-value">{signalement.entreprise || 'Non assignée'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">📍 Coordonnées</span>
              <span className="detail-value">{signalement.latitude?.toFixed(6)}, {signalement.longitude?.toFixed(6)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">📊 Avancement</span>
              <span className="detail-value">{signalement.pourcentage_completion || 0}%</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">🔧 Type réparation</span>
              <span className="detail-value">
                {signalement.type_reparation > 0 
                  ? `Niveau ${signalement.type_reparation}/10` 
                  : 'Non attribué'}
              </span>
            </div>
          </div>
          
          {signalement.signale_par && (
            <div className="detail-author">
              <span className="detail-label">👤 Signalé par</span>
              <span className="detail-value">{signalement.utilisateur_prenom} {signalement.utilisateur_nom} ({signalement.signale_par})</span>
            </div>
          )}
        </div>
        
        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onClose}>
            Fermer
          </button>
          <button type="button" className="save-btn" onClick={() => onEdit(signalement)}>
            ✏️ Modifier
          </button>
        </div>
      </div>
    </div>
  );
};

// Composant Modal d'édition
const EditSignalementModal = ({ signalement, statuts, entreprises, onSave, onClose, loading }) => {
  const [formData, setFormData] = useState({
    titre: signalement.titre || '',
    description: signalement.description || '',
    surface_m2: signalement.surface_m2 || '',
    budget: signalement.budget || '',
    type_reparation: signalement.type_reparation !== null && signalement.type_reparation !== undefined ? String(signalement.type_reparation) : '0',
    id_statut_signalement: signalement.id_statut_signalement ? String(signalement.id_statut_signalement) : '',
    id_entreprise: signalement.id_entreprise ? String(signalement.id_entreprise) : '',
    type_reparation: signalement.type_reparation || 0
  });

  // Mettre à jour les données si le signalement change
  useEffect(() => {
    setFormData({
      titre: signalement.titre || '',
      description: signalement.description || '',
      surface_m2: signalement.surface_m2 || '',
      budget: signalement.budget || '',
      type_reparation: signalement.type_reparation !== null && signalement.type_reparation !== undefined ? String(signalement.type_reparation) : '0',
      id_statut_signalement: signalement.id_statut_signalement ? String(signalement.id_statut_signalement) : '',
      id_entreprise: signalement.id_entreprise ? String(signalement.id_entreprise) : '',
      type_reparation: signalement.type_reparation || 0
    });
  }, [signalement]);

  // Couleurs des niveaux de réparation (1 = mineur, 10 = critique)
  const reparationLevels = [
    { level: 1, color: '#4CAF50' },
    { level: 2, color: '#66BB6A' },
    { level: 3, color: '#8BC34A' },
    { level: 4, color: '#CDDC39' },
    { level: 5, color: '#FDD835' },
    { level: 6, color: '#FFB300' },
    { level: 7, color: '#FF9800' },
    { level: 8, color: '#FF5722' },
    { level: 9, color: '#F44336' },
    { level: 10, color: '#B71C1C' }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(signalement.id, {
      ...formData,
      surface_m2: formData.surface_m2 ? parseFloat(formData.surface_m2) : null,
      budget: formData.budget ? parseFloat(formData.budget) : null,
      type_reparation: formData.type_reparation ? parseInt(formData.type_reparation) : 0,
      id_statut_signalement: formData.id_statut_signalement ? parseInt(formData.id_statut_signalement) : null,
      id_entreprise: formData.id_entreprise ? parseInt(formData.id_entreprise) : null,
      type_reparation: formData.type_reparation ? parseInt(formData.type_reparation) : null
    });
  };

  return (
    <div className="modal-overlay">
      <div className="edit-modal">
        <div className="modal-header">
          <h3>Modifier le signalement</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        {/* Galerie de photos */}
        {signalement.photos && signalement.photos.length > 0 && (
          <div className="photos-gallery">
            <h4>Photos ({signalement.photos.length})</h4>
            <div className="photos-grid">
              {signalement.photos.map((photo, idx) => (
                <div key={photo.id || idx} className="photo-item">
                  <img 
                    src={photo.url}
                    alt={photo.nom_fichier || `Photo ${idx + 1}`}
                    onClick={() => window.open(photo.url, '_blank')}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Titre</label>
            <input
              type="text"
              name="titre"
              value={formData.titre}
              onChange={handleChange}
              placeholder="Titre du signalement"
            />
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Description du problème"
              rows="3"
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Surface (m²)</label>
              <input
                type="number"
                name="surface_m2"
                value={formData.surface_m2}
                onChange={handleChange}
                placeholder="Surface en m²"
                step="0.01"
              />
            </div>
            
            <div className="form-group">
              <label>Budget (MGA)</label>
              <input
                type="number"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                placeholder="Budget en MGA"
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Niveau (0-10)</label>
              <input
                type="number"
                name="type_reparation"
                value={formData.type_reparation}
                onChange={handleChange}
                placeholder="Niveau de 0 à 10"
                min="0"
                max="10"
                step="1"
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Statut</label>
              <select
                name="id_statut_signalement"
                value={formData.id_statut_signalement}
                onChange={handleChange}
              >
                <option value="">-- Sélectionner --</option>
                {statuts.map(s => (
                  <option key={s.id} value={s.id}>{s.libelle}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Entreprise</label>
              <select
                name="id_entreprise"
                value={formData.id_entreprise}
                onChange={handleChange}
              >
                <option value="">-- Sélectionner --</option>
                {entreprises.map(e => (
                  <option key={e.id} value={e.id}>{e.nom}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Sélecteur de type de réparation - affiché si non encore enregistré en base */}
          {signalement.type_reparation === 0 && (
            <div className="type-reparation-section">
              <div className="type-reparation-header">
                <div>
                  <h4>Niveau de réparation requis</h4>
                  <p className="type-reparation-subtitle">Ce signalement n'a pas encore de type de réparation attribué. Sélectionnez le niveau de gravité approprié.</p>
                </div>
              </div>

              <div className="severity-scale">
                <div className="scale-labels">
                  <span className="scale-label-low">Mineur</span>
                  <span className="scale-label-high">Critique</span>
                </div>
                <div className="severity-levels">
                  {reparationLevels.map((item) => (
                    <div
                      key={item.level}
                      className={`severity-level ${formData.type_reparation === item.level ? 'selected' : ''}`}
                      style={{
                        '--level-color': item.color,
                        '--level-opacity': formData.type_reparation === item.level ? 1 : 0.6
                      }}
                      onClick={() => setFormData(prev => ({ ...prev, type_reparation: item.level }))}
                    >
                      <span className="level-number">{item.level}</span>
                    </div>
                  ))}
                </div>
              </div>

              {formData.type_reparation > 0 && (
                <div className="level-selection-indicator">
                  Niveau sélectionné : <strong>{formData.type_reparation}</strong> / 10
                </div>
              )}
            </div>
          )}

          {/* Afficher le type de réparation déjà attribué */}
          {signalement.type_reparation > 0 && (
            <div className="type-reparation-assigned">
              <div>
                <strong>Type de réparation attribué : Niveau {signalement.type_reparation} / 10</strong>
              </div>
            </div>
          )}
          
          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="save-btn" disabled={loading}>
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManagerPanel;
