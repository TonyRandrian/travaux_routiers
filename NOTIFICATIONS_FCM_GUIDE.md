# 📱 Implémentation des Notifications Push FCM - Guide Complet

## 🎯 Vue d'ensemble

Ce document décrit tous les changements apportés au projet **Travaux Routiers** pour implémenter les notifications push Firebase Cloud Messaging (FCM) entre l'application mobile (Ionic/Vue) et le back-end (Node.js).

---

## 📋 Résumé des Fonctionnalités

### ✅ Côté Mobile (Ionic/Vue)
- **Gestion des tokens FCM** : Récupération, sauvegarde et suppression
- **Interface utilisateur** : Overlay de notification superposé sur la carte
- **Intégration Firebase** : Utilisation de la même base Firestore que l'app web

### ✅ Côté Back-End (Node.js)
- **Service de notification** : Envoi automatique lors des changements de statut
- **Messages personnalisés** : Titre du signalement + entreprise + nouveau statut
- **Gestion multi-appareils** : Support de plusieurs tokens par utilisateur

---

## 🔧 Modifications Détaillées

### **1. Structure de Base de Données**

#### **Firestore - Collection `users`**
Ajout du champ pour stocker les tokens FCM :
```json
{
  "uid": "qcc3OzGqqydEg0czqoR8B5B93t33",
  "email": "user1@gmail.com",
  "displayName": "Utilisateur",
  "role": "USER",
  "tentatives": 0,
  "isVisitor": false,
  "createdAt": "2026-01-27T06:24:41.997Z",
  "updatedAt": "2026-01-27T06:24:41.997Z",
  "fcmTokens": ["token1", "token2", "token3"]  // ← NOUVEAU CHAMP
}
```

---

### **2. Fichiers Modifiés - Mobile**

#### **📁 `mobile/src/types/index.ts`**
```typescript
// AJOUTÉ
export interface User {
  // ... autres propriétés
  fcmTokens?: string[];  // Liste des tokens FCM pour les notifications push
}
```

#### **📁 `mobile/src/services/fcmService.ts`** *(NOUVEAU FICHIER)*
Service complet de gestion FCM :
- ✅ Initialisation des notifications push
- ✅ Récupération du token FCM
- ✅ Sauvegarde dans Firestore (`arrayUnion`)
- ✅ Suppression lors de la déconnexion (`arrayRemove`)
- ✅ Gestion du refresh token automatique

#### **📁 `mobile/src/stores/auth.ts`**
```typescript
// AJOUTS
import { fcmService } from '@/services/fcmService';

// Dans initAuthListener() :
- fcmService.initialize();
- await fcmService.saveTokenForUser(user.uid);
- fcmService.setupTokenRefreshListener(user.uid);

// Dans login() :
- await fcmService.saveTokenForUser(userCredential.user.uid);

// Dans logout() :
- await fcmService.removeTokenForUser(currentUser.value.uid);
```

#### **📁 `mobile/src/components/NotificationOverlay.vue`** *(NOUVEAU FICHIER)*
Composant UI pour afficher les notifications :
- ✅ Design moderne avec effet glass
- ✅ Animations fluides (slide + fade)
- ✅ Actions : "Voir sur la carte" et "Fermer"
- ✅ Support des détails du signalement

#### **📁 `mobile/src/views/MapPage.vue`**
```vue
<!-- AJOUTS -->
<NotificationOverlay 
  :notification="currentNotification"
  :is-visible="showNotification"
  @close="closeNotification"
  @viewOnMap="focusOnLocation"
/>

<!-- Bouton démo pour tester -->
<div class="demo-btn" @click="showTestNotification">
  <ion-icon :icon="notificationsOutline"></ion-icon>
</div>
```

#### **📁 `mobile/package.json`**
```json
{
  "dependencies": {
    // AJOUTÉ
    "@capacitor/push-notifications": "^8.0.0"
  }
}
```

#### **📁 `mobile/android/app/src/main/AndroidManifest.xml`**
```xml
<!-- AJOUTÉ -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

#### **📁 `mobile/android/app/build.gradle`**
```gradle
// AJOUTS
apply plugin: 'com.google.gms.google-services'

dependencies {
    // AJOUTÉS
    implementation platform('com.google.firebase:firebase-bom:34.8.0')
    implementation 'com.google.firebase:firebase-analytics'
    implementation 'com.google.firebase:firebase-messaging'
}
```

---

### **3. Fichiers Modifiés - Back-End**

#### **📁 `back-api/services/notificationService.js`** *(NOUVEAU FICHIER)*
Service d'envoi de notifications :
```javascript
// Fonctionnalités principales :
- getUserFcmTokens(userEmail)     // Récupère tokens depuis Firestore
- formatStatusMessage(status, titre, entreprise)  // Formate le message
- sendNotification(tokens, title, body, data)     // Envoie via FCM
- notifyStatusChange(userEmail, signalement, newStatus, entreprise)  // API principale
```

#### **📁 `back-api/routes/signalements.js`**
```javascript
// AJOUTS dans PUT /:id
const NotificationService = require('../services/notificationService');

// Lors du changement de statut :
if (id_statut_signalement && id_statut_signalement !== currentStatut) {
  // ... historique
  
  // NOUVEAU : Envoi notification push
  if (utilisateurEmail && newStatutCode && newStatutCode !== 'NOUVEAU') {
    const notifResult = await NotificationService.notifyStatusChange(
      utilisateurEmail,
      { id, titre: signalementTitre || titre },
      newStatutCode,
      entrepriseNom
    );
  }
}
```

---

### **4. Configuration Android**

#### **Étapes nécessaires :**
1. **Créer app Android dans Firebase Console** :
   - Nom du package : `mg.travaux.routiers`
   - Nom de l'app : `Travaux Routiers`

2. **Télécharger `google-services.json`** → `mobile/android/app/google-services.json`

3. **Build et sync** :
   ```bash
   cd mobile
   npm run build
   npx cap sync android
   ```

---

## 🔄 Flux de Fonctionnement

### **Scénario : Changement de statut d'un signalement**

1. **Manager modifie un signalement** (via interface web)
2. **Back-API détecte le changement** (route PUT `/api/signalements/:id`)
3. **NotificationService récupère les tokens** de l'utilisateur depuis Firestore
4. **Message formaté** : `"Votre signalement [TITRE] est maintenant [STATUT]. Entreprise : [NOM]"`
5. **Firebase Admin SDK envoie** la notification à tous les appareils de l'utilisateur
6. **App mobile reçoit** la notification (foreground + background)
7. **Utilisateur clique** → Navigation vers le signalement

---

## 🎨 Interface Utilisateur

### **Notification Overlay**
```
┌─────────────────────────────────────┐
│ 🔔 Mise à jour de votre signalement │ Il y a 2 min
│ ✕                                   │
├─────────────────────────────────────┤
│ Votre signalement "Nid de poule     │
│ Avenue de l'Indépendance" est       │
│ maintenant en cours de traitement.  │
│ Entreprise : COLAS Madagascar       │
│                                     │
│ 🔧 Nid de poule Avenue Indépendance │
│ 🏢 COLAS Madagascar                │
│ ✅ En cours de traitement           │
├─────────────────────────────────────┤
│           📍 Voir sur la carte  Fermer │
└─────────────────────────────────────┘
```

---

## 🧪 Tests et Démo

### **Page de test intégrée :**
- **Bouton bleu pulsant** sur la page Carte
- **2 notifications de démo** (statuts EN_COURS et TERMINE)
- **Alternance aléatoire** à chaque clic
- **Données réalistes** (entreprises malgaches)

### **URL de test :**
```
http://localhost:5173
→ Navigation vers "Carte"
→ Clic sur bouton notification (🔔)
```

---

## ✅ Statuts de Notification

| Statut Original | Envoi Notification | Message Type |
|----------------|-------------------|---------------|
| `NOUVEAU` | ❌ Non | - |
| `EN_COURS` | ✅ Oui | "est maintenant en cours de traitement" |
| `TERMINE` | ✅ Oui | "a été traité avec succès" |

---

## 🔐 Sécurité

- **Tokens chiffrés** dans le transport (HTTPS/WSS)
- **Firebase Admin SDK** côté serveur uniquement  
- **Gestion des tokens expirés** automatique
- **Nettoyage à la déconnexion** utilisateur

---

## 📱 Prochaines Étapes

### **Phase 2 - Améliorations**
- [ ] Notifications en temps réel (WebSocket)
- [ ] Historique des notifications
- [ ] Paramètres de notification utilisateur
- [ ] Support iOS (même codebase)
- [ ] Statistiques d'ouverture

### **Phase 3 - Production**
- [ ] Optimisation des tokens (nettoyage périodique)
- [ ] Rate limiting pour éviter le spam
- [ ] Monitoring et logs détaillés
- [ ] Tests end-to-end automatisés

---

**🎉 Implementation terminée et opérationnelle !**

*Dernière mise à jour : 3 février 2026*