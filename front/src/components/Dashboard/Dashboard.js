import React from 'react';
import './Dashboard.css';

const Dashboard = ({ stats, loading, statistiquesTraitement, loadingTraitement }) => {
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

  const formatDelai = (jours) => {
    if (jours === null || jours === undefined) return 'N/A';
    const joursFormattes = Math.round(jours);
    return `${joursFormattes} jour${joursFormattes > 1 ? 's' : ''}`;
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

      {/* Tableau des statistiques de traitement par entreprise */}
      <div className="traitement-stats">
        <h4>📊 Délai de traitement moyen des travaux par entreprise</h4>
        
        {loadingTraitement ? (
          <div className="loading-spinner">Chargement des statistiques de traitement...</div>
        ) : statistiquesTraitement && statistiquesTraitement.length > 0 ? (
          <div className="table-container">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Entreprise</th>
                  <th>Travaux terminés</th>
                  <th>Délai moyen</th>
                  <th>Délai min</th>
                  <th>Délai max</th>
                  <th>Budget total</th>
                  <th>Surface totale</th>
                  <th>Avancement moyen</th>
                </tr>
              </thead>
              <tbody>
                {statistiquesTraitement.map((stat) => (
                  <tr key={stat.entreprise_id}>
                    <td className="entreprise-name">{stat.entreprise_nom}</td>
                    <td className="text-center">{stat.nombre_signalements_termines}</td>
                    <td className="delai-moyen">{formatDelai(stat.delai_moyen_jours)}</td>
                    <td className="text-center">{formatDelai(stat.delai_min_jours)}</td>
                    <td className="text-center">{formatDelai(stat.delai_max_jours)}</td>
                    <td className="budget">{formatCurrency(stat.budget_total || 0)}</td>
                    <td className="text-center">{formatNumber(stat.surface_totale_m2 || 0)} m²</td>
                    <td className="text-center">
                      <span className="avancement-badge">{parseFloat(stat.avancement_moyen || 0).toFixed(1)}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-data">
            <p>Aucune donnée de traitement disponible</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
