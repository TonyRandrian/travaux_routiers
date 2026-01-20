const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Configuration Firebase Admin SDK
// Le fichier de credentials peut être fourni via variable d'environnement ou fichier
let firebaseApp = null;

const initializeFirebase = () => {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    // Option 1: Via variable d'environnement (JSON stringifié)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('✓ Firebase Admin initialisé via variable d\'environnement');
    }
    // Option 2: Via fichier de credentials
    else if (process.env.FIREBASE_CREDENTIALS_PATH) {
      // Résoudre le chemin depuis la racine du projet (un niveau au-dessus de config/)
      const projectRoot = path.resolve(__dirname, '..');
      const credentialsPath = path.resolve(projectRoot, process.env.FIREBASE_CREDENTIALS_PATH);
      
      if (fs.existsSync(credentialsPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        console.log('✓ Firebase Admin initialisé via fichier de credentials');
      } else {
        console.warn(`⚠️ Fichier Firebase credentials non trouvé: ${credentialsPath}`);
        return null;
      }
    }
    // Option 3: Configuration par défaut (variables d'environnement individuelles)
    else if (process.env.FIREBASE_PROJECT_ID) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
      });
      console.log('✓ Firebase Admin initialisé via variables individuelles');
    }
    else {
      console.warn('⚠️ Firebase non configuré - synchronisation désactivée');
      return null;
    }

    return firebaseApp;
  } catch (error) {
    console.error('❌ Erreur initialisation Firebase Admin:', error.message);
    return null;
  }
};

// Récupérer l'instance Firestore
const getFirestore = () => {
  const app = initializeFirebase();
  if (!app) return null;
  return admin.firestore();
};

// Vérifier si Firebase est disponible
const isFirebaseAvailable = () => {
  return initializeFirebase() !== null;
};

module.exports = {
  initializeFirebase,
  getFirestore,
  isFirebaseAvailable,
  admin
};
