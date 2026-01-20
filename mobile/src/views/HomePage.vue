<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="dark">
        <ion-title>
          <span class="header-icon">🚧</span>
          Travaux Routiers
        </ion-title>
        <ion-buttons slot="end">
          <!-- Bouton connexion si non connecté -->
          <ion-button v-if="!isAuthenticated" @click="goToLogin">
            <ion-icon slot="start" :icon="logInOutline"></ion-icon>
            Connexion
          </ion-button>
          <!-- Bouton profil si connecté -->
          <ion-button v-else @click="goToProfile">
            <ion-icon slot="icon-only" :icon="personCircleOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="home-content">
      <!-- Dashboard Stats -->
      <div class="dashboard">
        <h3 class="dashboard-title">📊 Tableau récapitulatif</h3>

        <div class="stats-grid">
          <div class="stat-card total">
            <div class="stat-icon">📍</div>
            <div class="stat-content">
              <div class="stat-value">{{ formatNumber(stats.total_signalements) }}</div>
              <div class="stat-label">Total signalements</div>
            </div>
          </div>

          <div class="stat-card surface">
            <div class="stat-icon">📐</div>
            <div class="stat-content">
              <div class="stat-value">{{ formatNumber(stats.surface_totale) }} m²</div>
              <div class="stat-label">Surface totale</div>
            </div>
          </div>

          <div class="stat-card budget">
            <div class="stat-icon">💰</div>
            <div class="stat-content">
              <div class="stat-value">{{ formatCurrency(stats.budget_total) }}</div>
              <div class="stat-label">Budget total</div>
            </div>
          </div>

          <div class="stat-card progress">
            <div class="stat-icon">📈</div>
            <div class="stat-content">
              <div class="stat-value">{{ stats.avancement_pourcentage }}%</div>
              <div class="stat-label">Avancement</div>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: `${stats.avancement_pourcentage}%` }"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="status-breakdown">
          <h4>Répartition par statut</h4>
          <div class="status-items">
            <div class="status-item nouveau">
              <span class="status-dot"></span>
              <span class="status-name">Nouveau</span>
              <span class="status-count">{{ stats.nouveaux }}</span>
            </div>
            <div class="status-item en-cours">
              <span class="status-dot"></span>
              <span class="status-name">En cours</span>
              <span class="status-count">{{ stats.en_cours }}</span>
            </div>
            <div class="status-item termine">
              <span class="status-dot"></span>
              <span class="status-name">Terminé</span>
              <span class="status-count">{{ stats.termines }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Menu de navigation -->
      <div class="menu-section">
        <ion-list>
          <ion-item button @click="goToMap" detail>
            <ion-icon slot="start" :icon="mapOutline" color="warning"></ion-icon>
            <ion-label>
              <h2>Voir la carte</h2>
              <p>Consulter tous les signalements</p>
            </ion-label>
          </ion-item>

          <ion-item button @click="goToNewSignalement" detail>
            <ion-icon slot="start" :icon="addCircleOutline" color="success"></ion-icon>
            <ion-label>
              <h2>Nouveau signalement</h2>
              <p>{{ isAuthenticated ? 'Signaler un problème routier' : 'Connexion requise' }}</p>
            </ion-label>
            <ion-icon v-if="!isAuthenticated" slot="end" :icon="lockClosedOutline" color="medium"></ion-icon>
          </ion-item>

          <ion-item button @click="goToMySignalements" detail>
            <ion-icon slot="start" :icon="listOutline" color="primary"></ion-icon>
            <ion-label>
              <h2>Mes signalements</h2>
              <p>{{ isAuthenticated ? 'Voir mes signalements' : 'Connexion requise' }}</p>
            </ion-label>
            <ion-icon v-if="!isAuthenticated" slot="end" :icon="lockClosedOutline" color="medium"></ion-icon>
          </ion-item>
        </ion-list>
      </div>

      <!-- Bannière de connexion si non connecté -->
      <div v-if="!isAuthenticated" class="login-banner">
        <p>Connectez-vous pour signaler des problèmes routiers</p>
        <ion-button color="warning" @click="goToLogin">
          <ion-icon slot="start" :icon="logInOutline"></ion-icon>
          Se connecter
        </ion-button>
      </div>
    </ion-content>

    <!-- FAB pour nouveau signalement (visible si connecté) -->
    <ion-fab v-if="isAuthenticated" slot="fixed" vertical="bottom" horizontal="end">
      <ion-fab-button color="warning" @click="goToNewSignalement">
        <ion-icon :icon="add"></ion-icon>
      </ion-fab-button>
    </ion-fab>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonFab,
  IonFabButton
} from '@ionic/vue';
import {
  personCircleOutline,
  mapOutline,
  addCircleOutline,
  listOutline,
  add,
  logInOutline,
  lockClosedOutline
} from 'ionicons/icons';
import { useSignalementsStore } from '@/stores/signalements';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const signalementsStore = useSignalementsStore();
const authStore = useAuthStore();

const stats = computed(() => signalementsStore.stats);
const isAuthenticated = computed(() => authStore.isAuthenticated);

onMounted(() => {
  signalementsStore.subscribeToSignalements();
});

onUnmounted(() => {
  signalementsStore.unsubscribeFromSignalements();
});

function formatNumber(num: number): string {
  return new Intl.NumberFormat('fr-FR').format(num);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'MGA',
    minimumFractionDigits: 0
  }).format(amount);
}

function goToMap() {
  router.push('/map');
}

function goToNewSignalement() {
  router.push('/signalement/new');
}

function goToMySignalements() {
  router.push('/my-signalements');
}

function goToProfile() {
  router.push('/profile');
}

function goToLogin() {
  router.push('/login');
}
</script>

<style scoped>
.home-content {
  --background: #f5f5f5;
}

ion-toolbar {
  --background: #1a1a2e;
}

ion-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  background: linear-gradient(90deg, #FFC107, #FF9800);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header-icon {
  font-size: 24px;
}

.dashboard {
  background: white;
  margin: 16px;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.dashboard-title {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 700;
  color: #1a1a2e;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stat-card {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-icon {
  font-size: 28px;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a2e;
}

.stat-label {
  font-size: 11px;
  color: #666;
  text-transform: uppercase;
}

.stat-card.progress .stat-content {
  width: 100%;
}

.progress-bar {
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  margin-top: 8px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #FFC107, #FF9800);
  border-radius: 3px;
  transition: width 0.5s ease;
}

.status-breakdown {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

.status-breakdown h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #666;
}

.status-items {
  display: flex;
  justify-content: space-between;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.status-item.nouveau .status-dot {
  background: #f44336;
}

.status-item.en-cours .status-dot {
  background: #FF9800;
}

.status-item.termine .status-dot {
  background: #4CAF50;
}

.status-name {
  font-size: 13px;
  color: #666;
}

.status-count {
  font-size: 14px;
  font-weight: 700;
  color: #1a1a2e;
}

.menu-section {
  margin: 16px;
  border-radius: 16px;
  overflow: hidden;
  background: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

ion-item {
  --padding-start: 16px;
  --padding-end: 16px;
  --padding-top: 12px;
  --padding-bottom: 12px;
}

ion-item h2 {
  font-weight: 600;
  font-size: 16px;
  color: #1a1a2e;
}

ion-item p {
  font-size: 13px;
  color: #666;
}

.login-banner {
  margin: 16px;
  padding: 20px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 16px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.login-banner p {
  margin: 0 0 16px 0;
  color: white;
  font-size: 14px;
}

.login-banner ion-button {
  --border-radius: 8px;
}

ion-fab-button {
  --background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%);
  --color: #1a1a2e;
}
</style>
