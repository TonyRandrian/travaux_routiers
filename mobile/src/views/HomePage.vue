<template>
  <ion-page>
    <ion-content :fullscreen="true" class="home-content">
      <!-- Animated Background -->
      <div class="animated-bg">
        <div class="blob blob-1"></div>
        <div class="blob blob-2"></div>
        <div class="blob blob-3"></div>
      </div>

      <!-- Header Section -->
      <div class="header-section">
        <div class="header-content">
          <div class="logo-container">
            <div class="logo-icon">
              <ion-icon :icon="constructOutline"></ion-icon>
            </div>
            <div class="logo-text">
              <h1>Travaux</h1>
              <span>Antananarivo</span>
            </div>
          </div>
          <div class="header-actions">
            <div v-if="isAuthenticated" class="user-avatar" @click="goToProfile">
              <span>{{ userInitials }}</span>
            </div>
            <ion-button v-else fill="clear" class="login-btn" @click="goToLogin">
              <ion-icon :icon="personOutline"></ion-icon>
            </ion-button>
          </div>
        </div>
      </div>

      <!-- Stats Cards - Grid Layout -->
      <div class="stats-section">
        <div class="stats-grid">
          <div class="stat-card glass" @click="goToMap">
            <div class="stat-icon-wrapper orange">
              <ion-icon :icon="locationOutline"></ion-icon>
            </div>
            <div class="stat-info">
              <span class="stat-number">{{ stats.total_signalements }}</span>
              <span class="stat-label">Signalements</span>
            </div>
          </div>

          <div class="stat-card glass">
            <div class="stat-icon-wrapper blue">
              <ion-icon :icon="resizeOutline"></ion-icon>
            </div>
            <div class="stat-info">
              <span class="stat-number">{{ formatSurface(stats.surface_totale) }}</span>
              <span class="stat-label">Surface</span>
            </div>
          </div>

          <div class="stat-card glass full-width">
            <div class="stat-icon-wrapper green">
              <ion-icon :icon="walletOutline"></ion-icon>
            </div>
            <div class="stat-info">
              <span class="stat-number">{{ formatBudget(stats.budget_total) }}</span>
              <span class="stat-label">Budget total</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Progress Ring -->
      <div class="progress-section glass">
        <div class="progress-ring-container">
          <svg class="progress-ring" viewBox="0 0 120 120">
            <circle class="progress-bg" cx="60" cy="60" r="52" />
            <circle 
              class="progress-bar" 
              cx="60" 
              cy="60" 
              r="52"
              :style="{ strokeDashoffset: progressOffset }"
            />
          </svg>
          <div class="progress-value">
            <span class="progress-number">{{ stats.avancement_pourcentage }}</span>
            <span class="progress-percent">%</span>
          </div>
        </div>
        <div class="progress-info">
          <h3>Avancement Global</h3>
          <div class="status-pills">
            <div class="pill nouveau">
              <span class="pill-dot"></span>
              <span>{{ stats.nouveaux }} Nouveau</span>
            </div>
            <div class="pill en-cours">
              <span class="pill-dot"></span>
              <span>{{ stats.en_cours }} En cours</span>
            </div>
            <div class="pill termine">
              <span class="pill-dot"></span>
              <span>{{ stats.termines }} Termine</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="actions-section">
        <h2 class="section-title">Actions rapides</h2>
        
        <div class="action-cards">
          <div class="action-card" @click="goToMap">
            <div class="action-icon map">
              <ion-icon :icon="mapOutline"></ion-icon>
            </div>
            <span class="action-label">Carte</span>
          </div>

          <div class="action-card" :class="{ locked: !isAuthenticated }" @click="goToNewSignalement">
            <div class="action-icon add">
              <ion-icon :icon="addOutline"></ion-icon>
            </div>
            <span class="action-label">Signaler</span>
            <ion-icon v-if="!isAuthenticated" :icon="lockClosedOutline" class="lock-icon"></ion-icon>
          </div>

          <div class="action-card" :class="{ locked: !isAuthenticated }" @click="goToMySignalements">
            <div class="action-icon list">
              <ion-icon :icon="listOutline"></ion-icon>
            </div>
            <span class="action-label">Mes alertes</span>
            <ion-icon v-if="!isAuthenticated" :icon="lockClosedOutline" class="lock-icon"></ion-icon>
          </div>

          <div class="action-card" @click="goToProfile">
            <div class="action-icon profile">
              <ion-icon :icon="personOutline"></ion-icon>
            </div>
            <span class="action-label">Profil</span>
          </div>
        </div>
      </div>

      <!-- Login CTA for guests -->
      <div v-if="!isAuthenticated" class="cta-section glass">
        <div class="cta-content">
          <ion-icon :icon="shieldCheckmarkOutline" class="cta-icon"></ion-icon>
          <div class="cta-text">
            <h3>Contribuez a la ville</h3>
            <p>Connectez-vous pour signaler les problemes routiers</p>
          </div>
        </div>
        <ion-button class="cta-button" @click="goToLogin">
          Connexion
          <ion-icon :icon="arrowForwardOutline" slot="end"></ion-icon>
        </ion-button>
      </div>

      <!-- Bottom Spacer -->
      <div class="bottom-spacer"></div>
    </ion-content>

    <!-- Floating Action Button -->
    <ion-fab v-if="isAuthenticated" slot="fixed" vertical="bottom" horizontal="end">
      <ion-fab-button class="main-fab" @click="goToNewSignalement">
        <ion-icon :icon="addOutline"></ion-icon>
      </ion-fab-button>
    </ion-fab>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonContent,
  IonButton,
  IonIcon,
  IonFab,
  IonFabButton
} from '@ionic/vue';
import {
  constructOutline,
  personOutline,
  locationOutline,
  resizeOutline,
  walletOutline,
  mapOutline,
  addOutline,
  listOutline,
  lockClosedOutline,
  shieldCheckmarkOutline,
  arrowForwardOutline
} from 'ionicons/icons';
import { useSignalementsStore } from '@/stores/signalements';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const signalementsStore = useSignalementsStore();
const authStore = useAuthStore();

const stats = computed(() => signalementsStore.stats);
const isAuthenticated = computed(() => authStore.isAuthenticated);

const userInitials = computed(() => {
  const name = authStore.userProfile?.displayName || 'U';
  return name.charAt(0).toUpperCase();
});

const progressOffset = computed(() => {
  const circumference = 2 * Math.PI * 52;
  const progress = stats.value.avancement_pourcentage / 100;
  return circumference * (1 - progress);
});

onMounted(() => {
  signalementsStore.subscribeToSignalements();
});

onUnmounted(() => {
  signalementsStore.unsubscribeFromSignalements();
});

function formatSurface(num: number): string {
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num + ' m2';
}

function formatBudget(amount: number): string {
  if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'M';
  if (amount >= 1000) return (amount / 1000).toFixed(0) + 'k';
  return amount.toString();
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
  --background: #0a0a0f;
  overflow: hidden;
}

/* Animated Background */
.animated-bg {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  z-index: 0;
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.6;
  animation: float 8s ease-in-out infinite;
}

.blob-1 {
  width: 300px;
  height: 300px;
  background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%);
  top: -100px;
  right: -100px;
  animation-delay: 0s;
}

.blob-2 {
  width: 250px;
  height: 250px;
  background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%);
  bottom: 20%;
  left: -80px;
  animation-delay: -3s;
}

.blob-3 {
  width: 200px;
  height: 200px;
  background: linear-gradient(135deg, #FFD93D 0%, #FF6B6B 100%);
  bottom: -50px;
  right: 20%;
  animation-delay: -5s;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -30px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
}

/* Glass Effect - Transparent */
.glass {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

/* Header */
.header-section {
  position: relative;
  z-index: 1;
  padding: 50px 20px 12px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 32px rgba(255, 193, 7, 0.3);
}

.logo-icon ion-icon {
  font-size: 26px;
  color: #0a0a0f;
}

.logo-text h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  color: white;
  letter-spacing: -0.5px;
}

.logo-text span {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 2px;
}

.user-avatar {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
  color: #0a0a0f;
  cursor: pointer;
  transition: transform 0.3s, box-shadow 0.3s;
}

.user-avatar:active {
  transform: scale(0.95);
}

.login-btn {
  --color: white;
  --padding-start: 12px;
  --padding-end: 12px;
}

.login-btn ion-icon {
  font-size: 24px;
}

/* Stats Section */
.stats-section {
  position: relative;
  z-index: 1;
  padding: 0 16px;
  margin-bottom: 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.stat-card {
  padding: 12px;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: transform 0.3s, box-shadow 0.3s;
}

.stat-card.full-width {
  grid-column: 1 / -1;
  flex-direction: row;
  align-items: center;
}

.stat-card:active {
  transform: scale(0.98);
}

.stat-icon-wrapper {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon-wrapper ion-icon {
  font-size: 18px;
  color: white;
}

.stat-icon-wrapper.orange {
  background: linear-gradient(135deg, #FF9800 0%, #F57C00 100%);
}

.stat-icon-wrapper.blue {
  background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
}

.stat-icon-wrapper.green {
  background: linear-gradient(135deg, #4CAF50 0%, #388E3C 100%);
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-number {
  font-size: 20px;
  font-weight: 700;
  color: white;
  line-height: 1;
}

.stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 2px;
}

/* Progress Section */
.progress-section {
  position: relative;
  z-index: 1;
  margin: 0 16px 16px;
  padding: 16px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.progress-ring-container {
  position: relative;
  width: 80px;
  height: 80px;
  flex-shrink: 0;
}

.progress-ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.progress-bg {
  fill: none;
  stroke: rgba(255, 255, 255, 0.1);
  stroke-width: 8;
}

.progress-bar {
  fill: none;
  stroke: url(#gradient);
  stroke-width: 8;
  stroke-linecap: round;
  stroke-dasharray: 326.73;
  transition: stroke-dashoffset 1s ease;
}

.progress-value {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.progress-number {
  font-size: 22px;
  font-weight: 700;
  color: white;
}

.progress-percent {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.progress-info {
  flex: 1;
}

.progress-info h3 {
  margin: 0 0 10px 0;
  font-size: 14px;
  font-weight: 600;
  color: white;
}

.status-pills {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pill {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.pill-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.pill.nouveau .pill-dot { background: #f44336; }
.pill.en-cours .pill-dot { background: #FF9800; }
.pill.termine .pill-dot { background: #4CAF50; }

/* Actions Section */
.actions-section {
  position: relative;
  z-index: 1;
  padding: 0 16px;
  margin-bottom: 12px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: white;
  margin: 0 0 10px 0;
}

.action-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.action-card {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  padding: 14px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  position: relative;
  transition: transform 0.3s, background 0.3s;
}

.action-card:active {
  transform: scale(0.95);
  background: rgba(255, 255, 255, 0.12);
}

.action-card.locked {
  opacity: 0.6;
}

.action-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-icon ion-icon {
  font-size: 18px;
  color: white;
}

.action-icon.map { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.action-icon.add { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
.action-icon.list { background: linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%); }
.action-icon.profile { background: linear-gradient(135deg, #ee0979 0%, #ff6a00 100%); }

.action-label {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  text-align: center;
}

.lock-icon {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

/* CTA Section */
.cta-section {
  position: relative;
  z-index: 1;
  margin: 0 16px 16px;
  padding: 16px;
  border-radius: 16px;
}

.cta-content {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}

.cta-icon {
  font-size: 40px;
  color: #FFC107;
}

.cta-text h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 700;
  color: white;
}

.cta-text p {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

.cta-button {
  width: 100%;
  --background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%);
  --color: #0a0a0f;
  --border-radius: 14px;
  font-weight: 700;
  height: 52px;
}

/* FAB */
.main-fab {
  --background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%);
  --color: #0a0a0f;
  --box-shadow: 0 8px 32px rgba(255, 193, 7, 0.4);
}

.main-fab ion-icon {
  font-size: 28px;
}

.bottom-spacer {
  height: 100px;
}

/* SVG Gradient Definition */
svg defs {
  position: absolute;
}
</style>
