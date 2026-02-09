<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="dark">
        <ion-buttons slot="start">
          <ion-back-button default-href="/home"></ion-back-button>
        </ion-buttons>
        <ion-title>Mes signalements</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="list-content">
      <!-- Loading -->
      <div v-if="loading" class="loading-container">
        <ion-spinner name="crescent" color="warning"></ion-spinner>
        <p>Chargement...</p>
      </div>

      <!-- Liste vide -->
      <div v-else-if="mySignalements.length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <h3>Aucun signalement</h3>
        <p>Vous n'avez pas encore créé de signalement</p>
        <ion-button color="warning" @click="goToNewSignalement">
          Créer un signalement
        </ion-button>
      </div>

      <!-- Liste des signalements -->
      <ion-list v-else>
        <ion-item
          v-for="signalement in mySignalements"
          :key="signalement.id"
          button
          @click="openDetail(signalement)"
          detail
        >
          <div class="item-start" slot="start">
            <img :src="(signalement.photos && signalement.photos.length > 0) ? signalement.photos[0].url : defaultPhoto" alt="Vignette" class="item-thumb" />
            <div class="status-indicator" :style="{ background: getStatusColor(signalement.statut?.code) }"></div>
          </div>
          <ion-label>
            <h2>{{ signalement.titre || 'Sans titre' }}</h2>
            <p>{{ signalement.description || 'Aucune description' }}</p>
            <div class="item-meta">
              <span class="meta-item">📅 {{ formatDate(signalement.date_signalement) }}</span>
              <span class="meta-item status" :style="{ color: getStatusColor(signalement.statut?.code) }">
                {{ signalement.statut?.libelle || 'Inconnu' }}
              </span>
            </div>
          </ion-label>
        </ion-item>
      </ion-list>

      <!-- FAB nouveau signalement -->
      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button color="warning" @click="goToNewSignalement">
          <ion-icon :icon="add"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>

    <!-- Modal détail -->
    <ion-modal :is-open="showDetail" @did-dismiss="closeDetail">
      <ion-header>
        <ion-toolbar color="dark">
          <ion-title>Détail</ion-title>
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
              <span class="detail-value status-badge" :style="{ background: getStatusColor(selectedSignalement.statut?.code) }">
                {{ selectedSignalement.statut?.libelle || 'Inconnu' }}
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
              <span class="detail-value">{{ selectedSignalement.entreprise?.nom || 'Non assignée' }}</span>
            </div>
            <!-- <div class="detail-item full-width">
              <span class="detail-label">📍 Coordonnées</span>
              <span class="detail-value coords">
                {{ selectedSignalement.latitude?.toFixed(6) }}, {{ selectedSignalement.longitude?.toFixed(6) }}
              </span>
            </div> -->
          </div>
          <!-- Photos -->
          <div class="sheet-photos">
            <h4>📷 Photos ({{ selectedSignalement.photos?.length ?? 0 }})</h4>
            <div class="photos-scroll">
              <template v-if="selectedSignalement.photos && selectedSignalement.photos.length > 0">
                <div v-for="(photo, idx) in selectedSignalement.photos" :key="photo.id || idx" class="photo-thumbnail" @click="openPhotoViewer(idx)">
                  <img :src="photo.url" :alt="'Photo ' + (idx + 1)" loading="lazy" />
                </div>
              </template>
              <template v-else>
                <div class="photo-thumbnail default-photo">
                  <img :src="defaultPhoto" alt="Photo par défaut" />
                  <span class="default-badge">Par défaut</span>
                </div>
              </template>
            </div>
          </div>
        </div>
      </ion-content>
    </ion-modal>

    <!-- Photo Viewer Modal -->
    <ion-modal :is-open="showPhotoViewer" @did-dismiss="closePhotoViewer" class="photo-viewer-modal">
      <ion-header>
        <ion-toolbar color="dark">
          <ion-title>Photos</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="closePhotoViewer">Fermer</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding photo-viewer" v-if="selectedSignalement?.photos && selectedSignalement.photos.length > 0">
        <div class="photo-viewer-header">
          <span>{{ currentPhotoIndex + 1 }} / {{ selectedSignalement.photos.length }}</span>
        </div>
        <div class="photo-viewer-content">
          <img :src="selectedSignalement.photos[currentPhotoIndex]?.url" :alt="'Photo ' + (currentPhotoIndex + 1)" />
        </div>
        <div class="photo-viewer-nav" v-if="selectedSignalement.photos.length > 1">
          <ion-button fill="clear" :disabled="currentPhotoIndex === 0" @click="prevPhoto"><ion-icon :icon="chevronBackOutline"></ion-icon></ion-button>
          <ion-button fill="clear" :disabled="currentPhotoIndex >= selectedSignalement.photos.length - 1" @click="nextPhoto"><ion-icon :icon="chevronForwardOutline"></ion-icon></ion-button>
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
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonFab,
  IonFabButton,
  IonSpinner,
  IonModal
} from '@ionic/vue';
import { add, chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';
import { useSignalementsStore } from '@/stores/signalements';
import { useAuthStore } from '@/stores/auth';
import { useReferentielsStore } from '@/stores/referentiels';
import defaultPhoto from '@/assets/default-photo.svg';
import type { Signalement, StatutCode } from '@/types';

const router = useRouter();
const signalementsStore = useSignalementsStore();
const authStore = useAuthStore();
const referentielsStore = useReferentielsStore();

const loading = computed(() => signalementsStore.loading);
const showDetail = ref(false);
const selectedSignalement = ref<Signalement | null>(null);
const showPhotoViewer = ref(false);
const currentPhotoIndex = ref(0);

const mySignalements = computed(() => {
  if (!authStore.currentUser) return [];
  const userEmail = authStore.currentUser.email?.toLowerCase();
  return signalementsStore.signalements.filter(s => {
    // Support nouvelle structure (utilisateur.email) ET ancienne (id_utilisateur)
    const signalementEmail = s.utilisateur?.email?.toLowerCase();
    const oldUserId = (s as any).id_utilisateur;
    return signalementEmail === userEmail || oldUserId === authStore.currentUser!.uid;
  });
});

onMounted(() => {
  signalementsStore.subscribeToSignalements();
});

onUnmounted(() => {
  signalementsStore.unsubscribeFromSignalements();
});

function goToNewSignalement() {
  router.push('/signalement/new');
}

function openDetail(signalement: Signalement) {
  selectedSignalement.value = signalement;
  showDetail.value = true;
}

function closeDetail() {
  showDetail.value = false;
  selectedSignalement.value = null;
}

function openPhotoViewer(index: number) {
  currentPhotoIndex.value = index;
  showPhotoViewer.value = true;
}

function closePhotoViewer() {
  showPhotoViewer.value = false;
}

function prevPhoto() {
  if (currentPhotoIndex.value > 0) currentPhotoIndex.value--;
}

function nextPhoto() {
  if (selectedSignalement.value?.photos && currentPhotoIndex.value < selectedSignalement.value.photos.length - 1) currentPhotoIndex.value++;
} 

function getStatusColor(statutCode: string | undefined): string {
  return referentielsStore.getColorByCode(statutCode);
}

function getStatusLabel(statutCode: string | undefined): string {
  if (!statutCode) return 'Inconnu';
  const statut = referentielsStore.getStatutByCode(statutCode);
  return statut?.libelle || statutCode;
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
.list-content {
  --background: #f5f5f5;
}

ion-toolbar {
  --background: #1a1a2e;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 50%;
  color: #666;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60%;
  padding: 20px;
  text-align: center;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 0 0 8px 0;
  color: #1a1a2e;
}

.empty-state p {
  margin: 0 0 20px 0;
  color: #666;
}

ion-list {
  background: transparent;
  padding: 16px;
}

ion-item {
  --background: white;
  --border-radius: 12px;
  margin-bottom: 12px;
  --padding-start: 12px;
  --padding-end: 16px;
  --inner-padding-end: 0;
}

.status-indicator {
  width: 8px;
  height: 40px;
  border-radius: 4px;
  margin-right: 12px;
}

ion-item h2 {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 4px;
}

ion-item p {
  font-size: 13px;
  color: #666;
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 250px;
}

.item-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
}

.meta-item {
  color: #888;
}

.meta-item.status {
  font-weight: 600;
}

ion-fab-button {
  --background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%);
  --color: #1a1a2e;
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

/* Thumbnail for list */
.item-start {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-thumb {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  object-fit: cover;
  border: 2px solid rgba(0,0,0,0.06);
}

.detail-value {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
}

.detail-value.coords {
  font-size: 13px;
  font-family: monospace;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  color: white;
  font-size: 13px;
}

/* Photos Section (list detail) */
.sheet-photos {
  margin-top: 20px;
}
.photos-scroll {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 8px;
}
.photo-thumbnail {
  flex-shrink: 0;
  width: 120px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid rgba(0,0,0,0.06);
}
.photo-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.photo-thumbnail.default-photo {
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.9;
}
.photo-viewer {
  background: #000;
  height: 100%;
}
.photo-viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(0,0,0,0.85);
  color: white;
}
.photo-viewer-content {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.photo-viewer-content img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
}
.photo-viewer-nav {
  display: flex;
  justify-content: center;
  gap: 20px;
  padding: 12px;
}
.photo-viewer-nav ion-button {
  --color: white;
}
.photo-viewer-nav ion-button:disabled {
  --color: rgba(255,255,255,0.3);
}
</style>
