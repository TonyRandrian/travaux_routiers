import React, { useState, useEffect } from 'react';
import config from '../../config/config';
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

  useEffect(() => {
    fetchBlockedUsers();
    fetchSignalements();
    fetchStatuts();
    fetchEntreprises();
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
    try {
      // Simuler la synchronisation avec Firebase
      // Dans une vraie implémentation, cela synchroniserait avec Firestore
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setSyncStatus('success');
      showMessage('success', 'Synchronisation terminée avec succès');
      fetchSignalements();
      
      setTimeout(() => setSyncStatus(''), 3000);
    } catch (err) {
      setSyncStatus('error');
      showMessage('error', 'Erreur lors de la synchronisation');
      setTimeout(() => setSyncStatus(''), 3000);
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
              <h3>Synchronisation Firebase</h3>
              <div className="sync-card">
                <div className="sync-icon">
                  {syncStatus === 'syncing' ? '⏳' : syncStatus === 'success' ? '✅' : syncStatus === 'error' ? '❌' : '🔄'}
                </div>
                <p>
                  Synchronisez les signalements entre la base locale et Firebase pour permettre l'affichage sur mobile.
                </p>
                <button 
                  className={`sync-btn ${syncStatus}`}
                  onClick={handleSync}
                  disabled={syncStatus === 'syncing'}
                >
                  {syncStatus === 'syncing' ? 'Synchronisation en cours...' : 'Lancer la synchronisation'}
                </button>
              </div>
              
              <div className="sync-info">
                <h4>Informations</h4>
                <ul>
                  <li>📥 Récupérer les signalements depuis Firebase</li>
                  <li>📤 Envoyer les mises à jour vers Firebase</li>
                  <li>🔄 Synchroniser les statuts et budgets</li>
                </ul>
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
