import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('http://localhost:3000/')
      .then(response => response.text())
      .then(data => setMessage(data))
      .catch(error => setMessage('Erreur de connexion'));
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Travaux Routiers Front</h1>
        <p>Welcome to the front-end!</p>
        <p>Message du back: {message}</p>
      </header>
    </div>
  );
}

export default App;