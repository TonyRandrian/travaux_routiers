import React from 'react';
import './Dashboard.css';

const Dashboard = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="dashboard loading">
        <div className="loading-spinner">Chargement des statistiques...</div>
      </div>
    );
  }

  const formatNumber = (num) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'MGA',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="dashboard">
      <h3 className="dashboard-title">📊 Tableau récapitulatif</h3>
      
      <div className="stats-grid">
        <div className="stat-card total">
          <div className="stat-icon">📍</div>
          <div className="stat-content">
            <div className="stat-value">{formatNumber(stats.total_signalements || 0)}</div>
            <div className="stat-label">Total signalements</div>
          </div>
        </div>

        <div className="stat-card surface">
          <div className="stat-icon">📐</div>
          <div className="stat-content">
            <div className="stat-value">{formatNumber(stats.surface_totale || 0)} m²</div>
            <div className="stat-label">Surface totale</div>
          </div>
        </div>

        <div className="stat-card budget">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-value">{formatCurrency(stats.budget_total || 0)}</div>
            <div className="stat-label">Budget total</div>
          </div>
        </div>

        <div className="stat-card progress">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <div className="stat-value">{stats.avancement_pourcentage || 0}%</div>
            <div className="stat-label">Avancement</div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${stats.avancement_pourcentage || 0}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      <div className="status-breakdown">
        <h4>Répartition par statut</h4>
        <div className="status-items">
          <div className="status-item nouveau">
            <span className="status-dot"></span>
            <span className="status-name">Nouveau</span>
            <span className="status-count">{stats.nouveaux || 0}</span>
          </div>
          <div className="status-item en-cours">
            <span className="status-dot"></span>
            <span className="status-name">En cours</span>
            <span className="status-count">{stats.en_cours || 0}</span>
          </div>
          <div className="status-item termine">
            <span className="status-dot"></span>
            <span className="status-name">Terminé</span>
            <span className="status-count">{stats.termines || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
