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
          <div class="status-indicator" :style="{ background: getStatusColor(signalement.statut?.code) }" slot="start"></div>
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
            <div class="detail-item full-width">
              <span class="detail-label">📍 Coordonnées</span>
              <span class="detail-value coords">
                {{ selectedSignalement.latitude?.toFixed(6) }}, {{ selectedSignalement.longitude?.toFixed(6) }}
              </span>
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
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonFab,
  IonFabButton,
  IonSpinner,
  IonModal
} from '@ionic/vue';
import { add } from 'ionicons/icons';
import { useSignalementsStore } from '@/stores/signalements';
import { useAuthStore } from '@/stores/auth';
import type { Signalement, StatutCode } from '@/types';

const router = useRouter();
const signalementsStore = useSignalementsStore();
const authStore = useAuthStore();

const loading = computed(() => signalementsStore.loading);
const showDetail = ref(false);
const selectedSignalement = ref<Signalement | null>(null);

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
</style>
