import React, { useState, useEffect } from 'react';
import './App.css';
import MapComponent from './components/MapComponent';
import config from './config/config';

function App() {
  const [message, setMessage] = useState('');
  const [dbMessage, setDbMessage] = useState('');

  // Exemple de marqueurs pour Antananarivo
  const markers = [
    {
      lat: -18.8792,
      lng: 47.5079,
      title: "Centre d'Antananarivo",
      description: "Place de l'Indépendance"
    },
    {
      lat: -18.9100,
      lng: 47.5300,
      title: "Zone de travaux",
      description: "Travaux routiers en cours"
    }
  ];

  useEffect(() => {
    fetch(`${config.api.baseUrl}/`)
      .then(response => response.json())
      .then(data => setMessage(data.message || JSON.stringify(data)))
      .catch(error => setMessage('Erreur de connexion'));
  }, []);

  const testDB = () => {
    fetch(`${config.api.baseUrl}/db`)
      .then(response => response.json())
      .then(data => setDbMessage(JSON.stringify(data)))
      .catch(error => setDbMessage('Erreur DB'));
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Travaux Routiers - Antananarivo</h1>
        <div className="header-info">
          <div className="info-item">
            <span className="label">Statut API:</span>
            <span className="value">{message || 'Chargement...'}</span>
          </div>
          <div className="info-item">
            <button onClick={testDB} className="test-button">Tester DB</button>
            {dbMessage && <span className="db-status">{dbMessage}</span>}
          </div>
        </div>
      </header>
      
      <main className="map-container">
        <div className="map-header">
          <h2>Carte des travaux routiers - Antananarivo</h2>
          <p className="map-info">Centre: 18.8792°S, 47.5079°E | {markers.length} point(s) d'intérêt</p>
        </div>
        <MapComponent 
          markers={markers}
          center={[config.map.center.lat, config.map.center.lng]}
          zoom={config.map.zoom}
        />
      </main>
    </div>
  );
}

export default App;