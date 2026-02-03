import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './UserProfile.css';

function UserProfile({ onClose }) {
  const { userProfile, updateUserProfile, changePassword, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('info');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    displayName: userProfile?.displayName || '',
    email: userProfile?.email || '',
    phone: userProfile?.phone || '',
    address: userProfile?.address || ''
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  function handlePasswordChange(e) {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  }

  async function handleProfileUpdate(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await updateUserProfile({
        displayName: formData.displayName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address
      });
      setSuccess('Profil mis à jour avec succès !');
    } catch (error) {
      console.error(error);
      setError(error.message || 'Erreur lors de la mise à jour du profil');
    }
    setLoading(false);
  }

  async function handlePasswordUpdate(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return setError('Les mots de passe ne correspondent pas');
    }

    if (passwordData.newPassword.length < 6) {
      return setError('Le mot de passe doit contenir au moins 6 caractères');
    }

    setLoading(true);
    try {
      await changePassword(passwordData.newPassword);
      setSuccess('Mot de passe modifié avec succès !');
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error(error);
      setError(error.message || 'Erreur lors de la modification du mot de passe');
    }
    setLoading(false);
  }

  async function handleLogout() {
    try {
      await logout();
      onClose();
      // Rediriger vers la page de login
      window.location.href = '/';
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  }

  return (
    <div className="profile-overlay">
      <div className="profile-modal">
        <button className="profile-close" onClick={onClose}>×</button>
        
        <div className="profile-header">
          <div className="profile-avatar">
            {formData.displayName?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <h2>{formData.displayName || 'Utilisateur'}</h2>
          <p>{formData.email}</p>
        </div>

        <div className="profile-tabs">
          <button 
            className={`tab-button ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            Informations
          </button>
          <button 
            className={`tab-button ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            Sécurité
          </button>
        </div>

        {error && <div className="profile-error">{error}</div>}
        {success && <div className="profile-success">{success}</div>}

        <div className="profile-content">
          {activeTab === 'info' && (
            <form onSubmit={handleProfileUpdate} className="profile-form">
              <div className="form-group">
                <label htmlFor="displayName">Nom complet</label>
                <input
                  type="text"
                  id="displayName"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleChange}
                  placeholder="Votre nom"
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="votre@email.com"
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Téléphone</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+261 34 00 000 00"
                />
              </div>

              <div className="form-group">
                <label htmlFor="address">Adresse</label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Antananarivo, Madagascar"
                />
              </div>

              <button type="submit" className="profile-button" disabled={loading}>
                {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </button>
            </form>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handlePasswordUpdate} className="profile-form">
              <div className="form-group">
                <label htmlFor="newPassword">Nouveau mot de passe</label>
                <input
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  placeholder="••••••••"
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirmer le mot de passe</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  placeholder="••••••••"
                />
              </div>

              <button type="submit" className="profile-button" disabled={loading}>
                {loading ? 'Modification...' : 'Modifier le mot de passe'}
              </button>
            </form>
          )}
        </div>

        <div className="profile-footer">
          <button className="logout-button" onClick={handleLogout}>
            🚪 Déconnexion
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserProfile;
