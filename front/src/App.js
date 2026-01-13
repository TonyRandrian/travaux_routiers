import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [message, setMessage] = useState('');
  const [dbMessage, setDbMessage] = useState('');

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
        <h1>Travaux Routiers Front</h1>
        <p>Welcome to the front-end!</p>
        <p>Message du back: {message}</p>
        <button onClick={testDB}>Tester DB</button>
        <p>{dbMessage}</p>
      </header>
    </div>
  );
}

export default App;