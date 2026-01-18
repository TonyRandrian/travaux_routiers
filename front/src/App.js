import React, { useState, useEffect } from 'react';
import './App.css';
import MapComponent from './components/MapComponent';

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
    fetch('http://localhost:3000/')
      .then(response => response.text())
      .then(data => setMessage(data))
      .catch(error => setMessage('Erreur de connexion'));
  }, []);

  const testDB = () => {
    fetch('http://localhost:3000/db')
      .then(response => response.json())
      .then(data => setDbMessage(JSON.stringify(data)))
      .catch(error => setDbMessage('Erreur DB'));
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Travaux Routiers - Antananarivo</h1>
        <p>Message du back: {message}</p>
        <button onClick={testDB}>Tester DB</button>
        <p>{dbMessage}</p>
      </header>
      
      <main style={{ padding: '20px' }}>
        <h2>Carte des travaux routiers</h2>
        <MapComponent 
          markers={markers}
          center={[-18.8792, 47.5079]}
          zoom={13}
        />
      </main>
    </div>
  );
}

export default App;