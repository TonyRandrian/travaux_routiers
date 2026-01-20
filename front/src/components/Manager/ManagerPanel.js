import React, { useState, useEffect } from 'react';
import config from '../../config/config';
import { useAuth } from '../../contexts/AuthContext';
import './ManagerPanel.css';

const ManagerPanel = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('users');
  const [blockedUsers, setBlockedUsers] = useState([]);
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
  
  const { currentUser } = useAuth();

  useEffect(() => {
    fetchBlockedUsers();
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
      const response = await fetch(`${config.api.baseUrl}/api/utilisateurs/bloques`);
      const data = await response.json();
      setBlockedUsers(data);
    } catch (err) {
      console.error('Erreur récupération utilisateurs bloqués:', err);
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
      const response = await fetch(`${config.api.baseUrl}/api/utilisateurs/${userId}/debloquer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        showMessage('success', 'Utilisateur débloqué avec succès');
        fetchBlockedUsers();
      } else {
        const data = await response.json();
        showMessage('error', data.error || 'Erreur lors du déblocage');
      }
    } catch (err) {
      showMessage('error', 'Erreur de connexion');
    }
    setLoading(false);
  };

  const handleUpdateSignalement = async (id, updates) => {
    setLoading(true);
    try {
      const response = await fetch(`${config.api.baseUrl}/api/signalements/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
      const token = await currentUser?.getIdToken();
      
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
      const token = await currentUser?.getIdToken();
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
      const token = await currentUser?.getIdToken();
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
                      <th>Surface (m²)</th>
                      <th>Budget</th>
                      <th>Entreprise</th>
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
                        <td>{sig.surface_m2 || '-'}</td>
                        <td>{sig.budget ? `${sig.budget.toLocaleString()} MGA` : '-'}</td>
                        <td>{sig.entreprise || '-'}</td>
                        <td>{formatDate(sig.date_signalement)}</td>
                        <td>
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
                <div className="sync-card main-sync">
                  <div className="sync-icon">
                    {syncStatus === 'syncing' ? '⏳' : syncStatus === 'success' ? '✅' : syncStatus === 'error' ? '❌' : '🔄'}
                  </div>
                  <h4>Synchronisation Complète</h4>
                  <p>Synchronisation bidirectionnelle entre PostgreSQL et Firestore</p>
                  <button 
                    className={`sync-btn primary ${syncStatus}`}
                    onClick={handleSync}
                    disabled={syncStatus === 'syncing' || !firebaseAvailable}
                  >
                    {syncStatus === 'syncing' ? 'Synchronisation en cours...' : '🔄 Synchroniser tout'}
                  </button>
                </div>

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

// Composant Modal d'édition
const EditSignalementModal = ({ signalement, statuts, entreprises, onSave, onClose, loading }) => {
  const [formData, setFormData] = useState({
    titre: signalement.titre || '',
    description: signalement.description || '',
    surface_m2: signalement.surface_m2 || '',
    budget: signalement.budget || '',
    id_statut_signalement: signalement.id_statut_signalement || '',
    id_entreprise: signalement.id_entreprise || ''
  });

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
      id_statut_signalement: formData.id_statut_signalement ? parseInt(formData.id_statut_signalement) : null,
      id_entreprise: formData.id_entreprise ? parseInt(formData.id_entreprise) : null
    });
  };

  return (
    <div className="modal-overlay">
      <div className="edit-modal">
        <div className="modal-header">
          <h3>✏️ Modifier le signalement</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
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
