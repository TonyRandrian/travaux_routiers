import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import config from '../config/config';

// Fix pour les icônes de marqueurs par défaut de Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Couleurs selon le statut
const getStatusColor = (statutCode) => {
  switch (statutCode) {
    case 'NOUVEAU':
      return '#f44336'; // Rouge
    case 'EN_COURS':
      return '#FF9800'; // Orange
    case 'TERMINE':
      return '#4CAF50'; // Vert
    default:
      return '#9E9E9E'; // Gris
  }
};

const getStatusLabel = (statutCode) => {
  switch (statutCode) {
    case 'NOUVEAU':
      return 'Nouveau';
    case 'EN_COURS':
      return 'En cours';
    case 'TERMINE':
      return 'Terminé';
    default:
      return 'Inconnu';
  }
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const formatCurrency = (amount) => {
  if (!amount) return 'N/A';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'MGA',
    minimumFractionDigits: 0
  }).format(amount);
};

const getNiveauLabel = (typeReparation) => {
  // Afficher le niveau de 0 à 10
  if (typeReparation === null || typeReparation === undefined) {
    return '0';
  }
  return typeReparation.toString();
};

const MapComponent = ({ 
  markers = [], 
  signalements = [],
  center = [-18.8792, 47.5079], 
  zoom = 13,
  onSignalementClick = null 
}) => {
  // S'assurer que signalements est un tableau
  const signalementsList = Array.isArray(signalements) ? signalements : [];
  const mapRef = useRef(null);
  
  // Utiliser une clé pour forcer la recréation du MapContainer si le centre change
  const mapKey = `${center[0]}-${center[1]}`;
  
  return (
    <div style={{ height: '600px', width: '100%', position: 'relative' }}>
      <MapContainer
        key={mapKey}
        ref={mapRef}
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        attributionControl={true}
      >
        {/* Serveur de tuiles local (mode offline) */}
        <TileLayer
          url={config.map.tileServer}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={config.map.maxZoom}
        />
        
        {/* Afficher les signalements avec cercles colorés */}
        {signalementsList.map((signalement) => (
          <CircleMarker
            key={signalement.id}
            center={[signalement.latitude, signalement.longitude]}
            radius={12}
            pathOptions={{
              color: getStatusColor(signalement.statut_code),
              fillColor: getStatusColor(signalement.statut_code),
              fillOpacity: 0.7,
              weight: 2
            }}
            eventHandlers={{
              click: () => onSignalementClick && onSignalementClick(signalement)
            }}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={0.9} permanent={false}>
              <div style={{ minWidth: '180px' }}>
                <strong style={{ fontSize: '14px' }}>{signalement.titre || 'Sans titre'}</strong>
                <hr style={{ margin: '5px 0', borderColor: getStatusColor(signalement.statut_code) }} />
                <div style={{ fontSize: '12px' }}>
                  <div>📅 <strong>Date:</strong> {formatDate(signalement.date_signalement)}</div>
                  <div>
                    🔖 <strong>Statut:</strong>{' '}
                    <span style={{ 
                      color: getStatusColor(signalement.statut_code),
                      fontWeight: 'bold'
                    }}>
                      {getStatusLabel(signalement.statut_code)}
                    </span>
                  </div>
                  <div>📐 <strong>Surface:</strong> {signalement.surface_m2 ? `${signalement.surface_m2} m²` : 'N/A'}</div>
                  <div>💰 <strong>Budget:</strong> {formatCurrency(signalement.budget)}</div>
                  <div>⚠️ <strong>Niveau:</strong> {getNiveauLabel(signalement.type_reparation)}</div>
                  <div>🏢 <strong>Entreprise:</strong> {signalement.entreprise || 'Non assignée'}</div>
                </div>
              </div>
            </Tooltip>
            <Popup>
              <div style={{ minWidth: '220px', maxWidth: '300px' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#1a1a2e' }}>
                  🚧 {signalement.titre || 'Signalement'}
                </h3>
                <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '13px' }}>
                  {signalement.description || 'Aucune description'}
                </p>
                
                {/* Affichage des photos */}
                {signalement.photos && signalement.photos.length > 0 && (
                  <div style={{ 
                    marginBottom: '10px',
                    display: 'flex',
                    gap: '5px',
                    overflowX: 'auto',
                    paddingBottom: '5px'
                  }}>
                    {signalement.photos.slice(0, 3).map((photo, idx) => (
                      <img 
                        key={photo.id || idx}
                        src={photo.url}
                        alt={photo.nom_fichier || `Photo ${idx + 1}`}
                        style={{
                          width: '80px',
                          height: '60px',
                          objectFit: 'cover',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          border: '1px solid #ddd'
                        }}
                        onClick={() => window.open(photo.url, '_blank')}
                      />
                    ))}
                    {signalement.photos.length > 3 && (
                      <div style={{
                        width: '80px',
                        height: '60px',
                        background: '#f0f0f0',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        color: '#666'
                      }}>
                        +{signalement.photos.length - 3}
                      </div>
                    )}
                  </div>
                )}
                
                <div style={{ 
                  background: '#f5f5f5', 
                  padding: '10px', 
                  borderRadius: '8px',
                  fontSize: '12px'
                }}>
                  <div style={{ marginBottom: '5px' }}>
                    📅 <strong>Date:</strong> {formatDate(signalement.date_signalement)}
                  </div>
                  <div style={{ marginBottom: '5px' }}>
                    🔖 <strong>Statut:</strong>{' '}
                    <span style={{ 
                      background: getStatusColor(signalement.statut_code),
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '11px'
                    }}>
                      {getStatusLabel(signalement.statut_code)}
                    </span>
                  </div>
                  <div style={{ marginBottom: '5px' }}>
                    📐 <strong>Surface:</strong> {signalement.surface_m2 ? `${signalement.surface_m2} m²` : 'N/A'}
                  </div>
                  <div style={{ marginBottom: '5px' }}>
                    💰 <strong>Budget:</strong> {formatCurrency(signalement.budget)}
                  </div>
                  <div style={{ marginBottom: '5px' }}>
                    ⚠️ <strong>Niveau:</strong> {getNiveauLabel(signalement.type_reparation)}
                  </div>
                  <div>
                    🏢 <strong>Entreprise:</strong> {signalement.entreprise || 'Non assignée'}
                  </div>
                </div>
                {signalement.signale_par && (
                  <div style={{ marginTop: '10px', fontSize: '11px', color: '#999' }}>
                    Signalé par: {signalement.utilisateur_prenom} {signalement.utilisateur_nom}
                  </div>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}
        
        {/* Afficher les marqueurs simples (anciens) */}
        {markers.map((marker, idx) => (
          <Marker key={`marker-${idx}`} position={[marker.lat, marker.lng]}>
            <Popup>
              {marker.title && <h3>{marker.title}</h3>}
              {marker.description && <p>{marker.description}</p>}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default MapComponent;
