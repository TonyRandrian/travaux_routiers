import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "NULL",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "NULL",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "NULL",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "NULL",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "NULL",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "NULL"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialiser Firestore avec persistance moderne (évite les erreurs offline)
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (error) {
  // Si déjà initialisé, récupérer l'instance existante
  db = getFirestore(app);
}

export { db };
export default app;
