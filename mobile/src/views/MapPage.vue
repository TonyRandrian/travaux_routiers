<template>
  <ion-page>
    <ion-content :fullscreen="true" class="map-content">
      <!-- Custom Header -->
      <div class="custom-header glass">
        <ion-button fill="clear" class="back-btn" @click="goBack">
          <ion-icon :icon="arrowBackOutline"></ion-icon>
        </ion-button>
        <h1>Carte</h1>
        <div class="header-right">
          <!-- Filtre Mes signalements (visible si connecté) -->
          <div 
            v-if="isAuthenticated" 
            class="filter-toggle" 
            :class="{ active: showOnlyMine }"
            @click="showOnlyMine = !showOnlyMine"
          >
            <ion-icon :icon="showOnlyMine ? personOutline : peopleOutline"></ion-icon>
          </div>
          <div class="legend-toggle" @click="showLegend = !showLegend">
            <ion-icon :icon="layersOutline"></ion-icon>
          </div>
        </div>
      </div>

      <!-- Map Container -->
      <div class="map-wrapper">
        <l-map
          ref="mapRef"
          v-model:zoom="zoom"
          :center="center"
          :use-global-leaflet="false"
          class="leaflet-map"
        >
          <l-tile-layer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            layer-type="base"
            name="OpenStreetMap"
            attribution="&copy; OpenStreetMap contributors"
          ></l-tile-layer>

          <!-- Position actuelle -->
          <l-marker v-if="currentPosition" :lat-lng="currentPosition">
            <l-popup>Votre position</l-popup>
          </l-marker>

          <!-- Signalements -->
          <l-circle-marker
            v-for="signalement in signalements"
            :key="signalement.id"
            :lat-lng="[signalement.latitude, signalement.longitude]"
            :radius="10"
            :color="getStatusColor(signalement.statut?.code)"
            :fill-color="getStatusColor(signalement.statut?.code)"
            :fill-opacity="0.8"
            :weight="2"
            @click="openSignalementDetail(signalement)"
          >
          </l-circle-marker>
        </l-map>
      </div>

      <!-- Floating Legend - Dynamique depuis Firebase -->
      <div v-if="showLegend" class="legend-panel glass">
        <div class="legend-header">
          <span>Legende</span>
          <ion-icon :icon="closeOutline" @click="showLegend = false"></ion-icon>
        </div>
        <div class="legend-items">
          <div 
            v-for="statut in referentielsStore.statuts" 
            :key="statut.id" 
            class="legend-item"
          >
            <span class="legend-dot" :style="{ background: statut.couleur }"></span>
            <span>{{ statut.libelle }}</span>
          </div>
        </div>
      </div>

      <!-- Stats Bar - Dynamique depuis Firebase -->
      <div class="stats-bar glass">
        <div class="stat-mini">
          <span class="stat-num">{{ signalements.length }}</span>
          <span class="stat-lbl">Total</span>
        </div>
        <template v-for="statut in referentielsStore.statuts" :key="statut.id">
          <div class="stat-divider"></div>
          <div class="stat-mini">
            <span class="stat-num" :style="{ color: statut.couleur }">{{ countByStatus(statut.code) }}</span>
            <span class="stat-lbl">{{ statut.libelle.split(' ')[0] }}</span>
          </div>
        </template>
      </div>

      <!-- Locate Button -->
      <div class="locate-btn glass" @click="locateMe">
        <ion-icon :icon="navigateOutline"></ion-icon>
      </div>

      <!-- Add Button -->
      <div v-if="isAuthenticated" class="add-btn" @click="goToNewSignalement">
        <ion-icon :icon="addOutline"></ion-icon>
      </div>

      <!-- Demo Button pour afficher notification -->
      <div class="demo-btn" @click="showTestNotification">
        <ion-icon :icon="notificationsOutline"></ion-icon>
      </div>

      <!-- Notification Overlay -->
      <NotificationOverlay 
        :notification="currentNotification"
        :is-visible="showNotification"
        @close="closeNotification"
        @viewOnMap="focusOnLocation"
      />
    </ion-content>

    <!-- Bottom Sheet Modal -->
    <ion-modal 
      :is-open="showDetail" 
      :initial-breakpoint="0.4"
      :breakpoints="[0, 0.4, 0.75]"
      @did-dismiss="closeDetail"
    >
      <div class="detail-sheet" v-if="selectedSignalement">
        <div class="sheet-handle"></div>
        
        <div class="sheet-header">
          <div class="status-indicator" :style="{ background: getStatusColor(selectedSignalement.statut?.code) }"></div>
          <div class="sheet-title">
            <h2>{{ selectedSignalement.titre || 'Signalement' }}</h2>
            <span class="sheet-date">{{ formatDate(selectedSignalement.date_signalement) }}</span>
          </div>
        </div>

        <p class="sheet-description">{{ selectedSignalement.description || 'Aucune description' }}</p>

        <div class="sheet-stats">
          <div class="sheet-stat">
            <ion-icon :icon="resizeOutline"></ion-icon>
            <div>
              <span class="val">{{ selectedSignalement.surface_m2 || 0 }} m2</span>
              <span class="lbl">Surface</span>
            </div>
          </div>
          <div class="sheet-stat">
            <ion-icon :icon="walletOutline"></ion-icon>
            <div>
              <span class="val">{{ formatCurrency(selectedSignalement.budget) }}</span>
              <span class="lbl">Budget</span>
            </div>
          </div>
          <div class="sheet-stat">
            <ion-icon :icon="businessOutline"></ion-icon>
            <div>
              <span class="val">{{ selectedSignalement.entreprise?.nom || 'N/A' }}</span>
              <span class="lbl">Entreprise</span>
            </div>
          </div>
        </div>

        <div class="sheet-status">
          <span class="status-badge" :style="{ background: getStatusColor(selectedSignalement.statut?.code) }">
            {{ selectedSignalement.statut?.libelle || 'Inconnu' }}
          </span>
        </div>
      </div>
    </ion-modal>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonContent,
  IonButton,
  IonIcon,
  IonModal
} from '@ionic/vue';
import {
  arrowBackOutline,
  layersOutline,
  closeOutline,
  navigateOutline,
  addOutline,
  resizeOutline,
  walletOutline,
  businessOutline,
  personOutline,
  peopleOutline,
  notificationsOutline
} from 'ionicons/icons';
import { Geolocation } from '@capacitor/geolocation';
import { LMap, LTileLayer, LMarker, LCircleMarker, LPopup } from '@vue-leaflet/vue-leaflet';
import 'leaflet/dist/leaflet.css';
import { useSignalementsStore } from '@/stores/signalements';
import { useAuthStore } from '@/stores/auth';
import NotificationOverlay from '@/components/NotificationOverlay.vue';
import { useReferentielsStore } from '@/stores/referentiels';
import type { Signalement } from '@/types';

const router = useRouter();
const signalementsStore = useSignalementsStore();
const authStore = useAuthStore();
const referentielsStore = useReferentielsStore();

const mapRef = ref(null);
const zoom = ref(13);
const center = ref<[number, number]>([-18.8792, 47.5079]);
const currentPosition = ref<[number, number] | null>(null);
const showDetail = ref(false);
const showLegend = ref(false);
const showOnlyMine = ref(false);
const selectedSignalement = ref<Signalement | null>(null);

// Signalements filtrés selon le toggle
const signalements = computed(() => {
  const allSignalements = signalementsStore.signalements;
  
  if (showOnlyMine.value && authStore.currentUser) {
    const userEmail = authStore.currentUser.email?.toLowerCase();
    return allSignalements.filter(s => {
      const signalementEmail = s.utilisateur?.email?.toLowerCase();
      const oldUserId = (s as any).id_utilisateur;
      return signalementEmail === userEmail || oldUserId === authStore.currentUser!.uid;
    });
  }
  
  return allSignalements;
});
const isAuthenticated = computed(() => authStore.isAuthenticated);

// Variables pour les notifications de test
const showNotification = ref(false);
const currentNotification = ref({
  title: 'Mise à jour de votre signalement',
  body: 'Votre signalement "Nid de poule Avenue de l\'Indépendance" est maintenant en cours de traitement. Entreprise en charge : COLAS Madagascar',
  timestamp: new Date().toISOString(),
  signalementData: {
    id: '1',
    titre: 'Nid de poule Avenue de l\'Indépendance',
    entreprise: 'COLAS Madagascar',
    status: 'EN_COURS' as 'EN_COURS' | 'TERMINE',
    latitude: -18.8792,
    longitude: 47.5079
  }
});

function countByStatus(status: string): number {
  return signalements.value.filter(s => s.statut?.code === status).length;
}

function showTestNotification() {
  console.log('🔔 Affichage notification de test...');
  
  // Alterner entre deux types de notifications pour la démo
  const notifications = [
    {
      title: 'Mise à jour de votre signalement',
      body: 'Votre signalement "Nid de poule Avenue de l\'Indépendance" est maintenant en cours de traitement. Entreprise en charge : COLAS Madagascar',
      timestamp: new Date().toISOString(),
      signalementData: {
        id: '1',
        titre: 'Nid de poule Avenue de l\'Indépendance',
        entreprise: 'COLAS Madagascar',
        status: 'EN_COURS' as 'EN_COURS' | 'TERMINE',
        latitude: -18.8792,
        longitude: 47.5079
      }
    },
    {
      title: 'Signalement terminé',
      body: 'Votre signalement "Route dégradée Analakely" a été traité avec succès. Entreprise en charge : SOGEA SATOM',
      timestamp: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
      signalementData: {
        id: '2',
        titre: 'Route dégradée Analakely',
        entreprise: 'SOGEA SATOM',
        status: 'TERMINE' as 'EN_COURS' | 'TERMINE',
        latitude: -18.91,
        longitude: 47.525
      }
    }
  ];
  
  const randomNotif = notifications[Math.floor(Math.random() * notifications.length)];
  currentNotification.value = randomNotif;
  showNotification.value = true;
  
  console.log('✅ Notification définie:', {
    visible: showNotification.value,
    notification: currentNotification.value
  });
}

function closeNotification() {
  showNotification.value = false;
}

function focusOnLocation(coords: { latitude: number; longitude: number }) {
  center.value = [coords.latitude, coords.longitude];
  zoom.value = 16; // Zoom pour bien voir le signalement
}

onMounted(() => {
  signalementsStore.subscribeToSignalements();
  locateMe();
});

onUnmounted(() => {
  signalementsStore.unsubscribeFromSignalements();
});

async function locateMe() {
  try {
    const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
    currentPosition.value = [position.coords.latitude, position.coords.longitude];
    center.value = [position.coords.latitude, position.coords.longitude];
  } catch (error) {
    console.error('Geolocation error:', error);
  }
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

function goBack() {
  router.push('/home');
}

function getStatusColor(code: string | undefined): string {
  return referentielsStore.getColorByCode(code);
}

function getStatusLabel(code: string | undefined): string {
  if (!code) return 'Inconnu';
  const statut = referentielsStore.getStatutByCode(code);
  return statut?.libelle || code;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatCurrency(amount: number | null | undefined): string {
  if (!amount) return 'N/A';
  if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'M MGA';
  if (amount >= 1000) return (amount / 1000).toFixed(0) + 'k MGA';
  return amount + ' MGA';
}
</script>

<style scoped>
.map-content {
  --background: #0a0a0f;
}

/* Glass Effect - Transparent */
.glass {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

/* Custom Header */
.custom-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 50px 16px 16px;
  background: linear-gradient(180deg, rgba(10, 10, 15, 0.95) 0%, rgba(10, 10, 15, 0.7) 100%);
}

.back-btn {
  --color: white;
  margin: 0;
}

.back-btn ion-icon {
  font-size: 24px;
}

.custom-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: white;
}

.header-right {
  display: flex;
  gap: 12px;
}

.filter-toggle,
.legend-toggle {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.filter-toggle.active {
  background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%);
}

.filter-toggle.active ion-icon {
  color: #0a0a0f;
}

.filter-toggle ion-icon,
.legend-toggle ion-icon {
  font-size: 20px;
  color: white;
}

/* Map */
.map-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.leaflet-map {
  width: 100%;
  height: 100%;
}

/* Legend Panel */
.legend-panel {
  position: absolute;
  top: 110px;
  right: 16px;
  z-index: 1000;
  border-radius: 16px;
  padding: 16px;
  min-width: 140px;
}

.legend-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  color: white;
  font-weight: 600;
  font-size: 14px;
}

.legend-header ion-icon {
  font-size: 18px;
  cursor: pointer;
  opacity: 0.6;
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.legend-dot.nouveau { background: #f44336; }
.legend-dot.en-cours { background: #FF9800; }
.legend-dot.termine { background: #4CAF50; }

/* Stats Bar */
.stats-bar {
  position: absolute;
  bottom: 30px;
  left: 16px;
  right: 16px;
  z-index: 1000;
  border-radius: 20px;
  padding: 16px 20px;
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.stat-mini {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-num {
  font-size: 20px;
  font-weight: 800;
  color: white;
}

.stat-lbl {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
}

.stat-mini.nouveau .stat-num { color: #f44336; }
.stat-mini.en-cours .stat-num { color: #FF9800; }
.stat-mini.termine .stat-num { color: #4CAF50; }

.stat-divider {
  width: 1px;
  height: 30px;
  background: rgba(255, 255, 255, 0.1);
}

/* Locate Button */
.locate-btn {
  position: absolute;
  bottom: 120px;
  left: 16px;
  z-index: 1000;
  width: 50px;
  height: 50px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.locate-btn ion-icon {
  font-size: 24px;
  color: #FFC107;
}

/* Add Button */
.add-btn {
  position: absolute;
  bottom: 120px;
  right: 16px;
  z-index: 1000;
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(255, 193, 7, 0.4);
  cursor: pointer;
}

.add-btn ion-icon {
  font-size: 28px;
  color: #0a0a0f;
}

/* Demo Notification Button */
.demo-btn {
  position: fixed;
  bottom: 140px;
  right: 20px;
  z-index: 1000;
  width: 48px;
  height: 48px;
  border-radius: 24px;
  background: linear-gradient(135deg, #3880ff 0%, #5260ff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 20px rgba(56, 128, 255, 0.4);
  cursor: pointer;
  animation: pulse 2s infinite;
}

.demo-btn ion-icon {
  font-size: 22px;
  color: white;
}

@keyframes pulse {
  0% { box-shadow: 0 6px 20px rgba(56, 128, 255, 0.4); }
  50% { box-shadow: 0 6px 20px rgba(56, 128, 255, 0.8); }
  100% { box-shadow: 0 6px 20px rgba(56, 128, 255, 0.4); }
}

/* Detail Sheet */
.detail-sheet {
  padding: 20px 24px 40px;
  background: #14141f;
  min-height: 100%;
}

.sheet-handle {
  width: 40px;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  margin: 0 auto 20px;
}

.sheet-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.status-indicator {
  width: 4px;
  height: 50px;
  border-radius: 2px;
  flex-shrink: 0;
}

.sheet-title h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: white;
}

.sheet-date {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.sheet-description {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
  margin-bottom: 24px;
}

.sheet-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.sheet-stat {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.sheet-stat ion-icon {
  font-size: 24px;
  color: #FFC107;
}

.sheet-stat .val {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: white;
}

.sheet-stat .lbl {
  display: block;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
}

.sheet-status {
  text-align: center;
}

.status-badge {
  display: inline-block;
  padding: 8px 20px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  color: white;
}
</style>
