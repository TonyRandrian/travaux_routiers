<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="dark">
        <ion-buttons slot="start">
          <ion-back-button default-href="/home"></ion-back-button>
        </ion-buttons>
        <ion-title>Carte des signalements</ion-title>
        <ion-buttons slot="end">
          <ion-button v-if="!isAuthenticated" @click="goToLogin">
            <ion-icon slot="icon-only" :icon="logInOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="map-content">
      <div class="map-container">
        <l-map
          ref="mapRef"
          v-model:zoom="zoom"
          :center="center"
          :use-global-leaflet="false"
          @click="onMapClick"
        >
          <l-tile-layer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            layer-type="base"
            name="OpenStreetMap"
            attribution="&copy; OpenStreetMap contributors"
          ></l-tile-layer>

          <!-- Position actuelle -->
          <l-marker v-if="currentPosition" :lat-lng="currentPosition">
            <l-popup>📍 Votre position</l-popup>
          </l-marker>

          <!-- Signalements -->
          <l-circle-marker
            v-for="signalement in signalements"
            :key="signalement.id"
            :lat-lng="[signalement.latitude, signalement.longitude]"
            :radius="12"
            :color="getStatusColor(signalement.statut_code)"
            :fill-color="getStatusColor(signalement.statut_code)"
            :fill-opacity="0.7"
            @click="openSignalementDetail(signalement)"
          >
            <l-tooltip>
              <div class="tooltip-content">
                <strong>{{ signalement.titre || 'Sans titre' }}</strong>
                <div class="tooltip-info">
                  <div>📅 {{ formatDate(signalement.date_signalement) }}</div>
                  <div>🔖 <span :style="{ color: getStatusColor(signalement.statut_code) }">{{ getStatusLabel(signalement.statut_code) }}</span></div>
                  <div>📐 {{ signalement.surface_m2 ? `${signalement.surface_m2} m²` : 'N/A' }}</div>
                  <div>💰 {{ formatCurrency(signalement.budget) }}</div>
                  <div>🏢 {{ signalement.entreprise || 'Non assignée' }}</div>
                </div>
              </div>
            </l-tooltip>
          </l-circle-marker>
        </l-map>
      </div>

      <!-- Bouton de localisation -->
      <ion-fab slot="fixed" vertical="bottom" horizontal="start">
        <ion-fab-button color="light" @click="locateMe">
          <ion-icon :icon="locateOutline"></ion-icon>
        </ion-fab-button>
      </ion-fab>

      <!-- Bouton nouveau signalement (visible si connecté) -->
      <ion-fab v-if="isAuthenticated" slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button color="warning" @click="goToNewSignalement">
          <ion-icon :icon="add"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>

    <!-- Modal détail signalement -->
    <ion-modal :is-open="showDetail" @did-dismiss="closeDetail">
      <ion-header>
        <ion-toolbar color="dark">
          <ion-title>Détail du signalement</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="closeDetail">Fermer</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding" v-if="selectedSignalement">
        <div class="detail-card">
          <h2>🚧 {{ selectedSignalement.titre || 'Signalement' }}</h2>
          <p class="description">{{ selectedSignalement.description || 'Aucune description' }}</p>

          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">📅 Date</span>
              <span class="detail-value">{{ formatDate(selectedSignalement.date_signalement) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">🔖 Statut</span>
              <span class="detail-value status-badge" :style="{ background: getStatusColor(selectedSignalement.statut_code) }">
                {{ getStatusLabel(selectedSignalement.statut_code) }}
              </span>
            </div>
            <div class="detail-item">
              <span class="detail-label">📐 Surface</span>
              <span class="detail-value">{{ selectedSignalement.surface_m2 ? `${selectedSignalement.surface_m2} m²` : 'N/A' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">💰 Budget</span>
              <span class="detail-value">{{ formatCurrency(selectedSignalement.budget) }}</span>
            </div>
            <div class="detail-item full-width">
              <span class="detail-label">🏢 Entreprise</span>
              <span class="detail-value">{{ selectedSignalement.entreprise || 'Non assignée' }}</span>
            </div>
          </div>
        </div>
      </ion-content>
    </ion-modal>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonBackButton,
  IonIcon,
  IonFab,
  IonFabButton,
  IonModal
} from '@ionic/vue';
import { locateOutline, add, logInOutline } from 'ionicons/icons';
import { Geolocation } from '@capacitor/geolocation';
import { LMap, LTileLayer, LMarker, LCircleMarker, LPopup, LTooltip } from '@vue-leaflet/vue-leaflet';
import 'leaflet/dist/leaflet.css';
import { useSignalementsStore } from '@/stores/signalements';
import { useAuthStore } from '@/stores/auth';
import type { Signalement, StatutCode } from '@/types';

const router = useRouter();
const signalementsStore = useSignalementsStore();
const authStore = useAuthStore();

const mapRef = ref(null);
const zoom = ref(13);
const center = ref<[number, number]>([-18.8792, 47.5079]); // Antananarivo
const currentPosition = ref<[number, number] | null>(null);
const showDetail = ref(false);
const selectedSignalement = ref<Signalement | null>(null);

const signalements = computed(() => signalementsStore.signalements);
const isAuthenticated = computed(() => authStore.isAuthenticated);

onMounted(() => {
  signalementsStore.subscribeToSignalements();
  locateMe();
});

onUnmounted(() => {
  signalementsStore.unsubscribeFromSignalements();
});

async function locateMe() {
  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true
    });
    currentPosition.value = [position.coords.latitude, position.coords.longitude];
    center.value = [position.coords.latitude, position.coords.longitude];
  } catch (error) {
    console.error('Erreur de géolocalisation:', error);
  }
}

function onMapClick(event: any) {
  // Possibilité d'ajouter un signalement en cliquant sur la carte
}

function openSignalementDetail(signalement: Signalement) {
  selectedSignalement.value = signalement;
  showDetail.value = true;
}

function closeDetail() {
  showDetail.value = false;
  selectedSignalement.value = null;
}

function goToNewSignalement() {
  router.push('/signalement/new');
}

function goToLogin() {
  router.push('/login');
}

function getStatusColor(statutCode: StatutCode): string {
  switch (statutCode) {
    case 'NOUVEAU':
      return '#f44336';
    case 'EN_COURS':
      return '#FF9800';
    case 'TERMINE':
      return '#4CAF50';
    default:
      return '#9E9E9E';
  }
}

function getStatusLabel(statutCode: StatutCode): string {
  switch (statutCode) {
    case 'NOUVEAU':
      return 'Nouveau';
    case 'EN_COURS':
      return 'En cours';
    case 'TERMINE':
      return 'Terminé';
    default:
      return 'Inconnu';
  }
}

function formatDate(dateString: string): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatCurrency(amount: number | null | undefined): string {
  if (!amount) return 'N/A';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'MGA',
    minimumFractionDigits: 0
  }).format(amount);
}
</script>

<style scoped>
.map-content {
  --background: #f5f5f5;
}

ion-toolbar {
  --background: #1a1a2e;
}

.map-container {
  width: 100%;
  height: 100%;
}

.tooltip-content {
  min-width: 160px;
}

.tooltip-content strong {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
}

.tooltip-info {
  font-size: 12px;
  line-height: 1.6;
}

.detail-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
}

.detail-card h2 {
  margin: 0 0 12px 0;
  font-size: 20px;
  color: #1a1a2e;
}

.detail-card .description {
  color: #666;
  font-size: 14px;
  margin-bottom: 20px;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-item.full-width {
  grid-column: span 2;
}

.detail-label {
  font-size: 12px;
  color: #666;
}

.detail-value {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  color: white;
  font-size: 13px;
}

ion-fab-button[color="light"] {
  --background: white;
  --color: #1a1a2e;
}

ion-fab-button[color="warning"] {
  --background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%);
  --color: #1a1a2e;
}
</style>
