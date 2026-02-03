# 📱 Application Mobile - Travaux Routiers Antananarivo

Application mobile Ionic Vue pour le signalement et suivi des travaux routiers à Antananarivo.

## 🛠️ Stack Technique

- **Framework**: Ionic 8 + Vue 3 + TypeScript
- **Carte**: Leaflet + OpenStreetMap (online)
- **Base de données**: Firebase (Firestore + Auth)
- **Géolocalisation**: Capacitor Geolocation
- **Build Mobile**: Capacitor (Android)

## 📋 Fonctionnalités

### Authentification
- ✅ Connexion (email/password) avec Firebase Auth
- ✅ Inscription avec création de profil
- ✅ Réinitialisation du mot de passe
- ✅ Limite de 3 tentatives de connexion (blocage automatique)

### Signalements
- ✅ Créer un signalement (titre, description, localisation)
- ✅ Géolocalisation GPS automatique
- ✅ Placement manuel sur la carte
- ✅ Voir tous les signalements sur la carte
- ✅ Filtrer par "Mes signalements"

### Carte
- ✅ Carte Leaflet avec OpenStreetMap
- ✅ Markers colorés par statut (Rouge: Nouveau, Orange: En cours, Vert: Terminé)
- ✅ Infobulles avec détails (date, statut, surface, budget, entreprise)

### Tableau de bord
- ✅ Nombre total de signalements
- ✅ Surface totale (m²)
- ✅ Budget total (MGA)
- ✅ Pourcentage d'avancement

### Profil
- ✅ Modification des informations utilisateur
- ✅ Déconnexion

## 🚀 Installation

### Prérequis
- Node.js 18+
- npm ou yarn
- Android Studio (pour build APK)
- Un projet Firebase configuré

### Étapes

1. **Installer les dépendances**
```bash
cd mobile
npm install
```

2. **Configurer Firebase**

Créez un fichier `.env` à la racine du dossier `mobile/` :
```env
VITE_FIREBASE_API_KEY=votre_api_key
VITE_FIREBASE_AUTH_DOMAIN=votre_projet.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=votre_projet_id
VITE_FIREBASE_STORAGE_BUCKET=votre_projet.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=votre_sender_id
VITE_FIREBASE_APP_ID=votre_app_id
```

3. **Lancer en mode développement**
```bash
ionic serve
```

4. **Build pour production**
```bash
npm run build
```

5. **Synchroniser avec Android**
```bash
ionic capacitor sync android
```

6. **Ouvrir dans Android Studio**
```bash
ionic capacitor open android
```

7. **Générer l'APK**
Dans Android Studio: `Build > Build Bundle(s) / APK(s) > Build APK(s)`

## 📁 Structure du Projet

```
mobile/
├── src/
│   ├── config/
│   │   └── firebase.ts          # Configuration Firebase
│   ├── stores/
│   │   ├── auth.ts              # Store Pinia - Authentification
│   │   └── signalements.ts      # Store Pinia - Signalements
│   ├── types/
│   │   └── index.ts             # Types TypeScript
│   ├── views/
│   │   ├── auth/
│   │   │   ├── LoginPage.vue
│   │   │   ├── RegisterPage.vue
│   │   │   └── ForgotPasswordPage.vue
│   │   ├── HomePage.vue         # Dashboard principal
│   │   ├── MapPage.vue          # Carte des signalements
│   │   ├── NewSignalementPage.vue
│   │   ├── MySignalementsPage.vue
│   │   └── ProfilePage.vue
│   ├── router/
│   │   └── index.ts             # Configuration des routes
│   ├── theme/
│   │   └── variables.css        # Variables de thème
│   └── main.ts                  # Point d'entrée
├── android/                      # Projet Android natif
├── capacitor.config.ts          # Configuration Capacitor
└── package.json
```

## 🎨 Thème

Le thème reprend les couleurs du projet web :

| Couleur | Code Hex | Utilisation |
|---------|----------|-------------|
| Jaune primaire | `#FFC107` | Boutons, accents |
| Orange | `#FF9800` | Secondaire |
| Fond sombre | `#1a1a2e` | Header, backgrounds |
| Rouge | `#f44336` | Statut "Nouveau" |
| Orange | `#FF9800` | Statut "En cours" |
| Vert | `#4CAF50` | Statut "Terminé" |

## 🔥 Collections Firebase (Firestore)

### Collection `users`
```javascript
{
  uid: string,
  email: string,
  displayName: string,
  phone: string,
  role: 'user' | 'manager',
  tentatives: number,
  bloque: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Collection `signalements`
```javascript
{
  id: string,
  titre: string,
  description: string,
  latitude: number,
  longitude: number,
  surface_m2: number | null,
  budget: number | null,
  date_signalement: string (YYYY-MM-DD),
  statut_code: 'NOUVEAU' | 'EN_COURS' | 'TERMINE',
  id_utilisateur: string (uid Firebase),
  id_entreprise: string | null,
  entreprise: string | null,
  createdAt: timestamp
}
```

## 📱 Génération APK

### Debug APK
```bash
cd android
./gradlew assembleDebug
```
L'APK sera dans `android/app/build/outputs/apk/debug/`

### Release APK
```bash
cd android
./gradlew assembleRelease
```

## 👥 Équipe

Projet Cloud S5 - Promotion 17 - ITU

## 📄 Licence

Projet académique - ITU Madagascar
