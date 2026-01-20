<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="dark">
        <ion-buttons slot="start">
          <ion-back-button default-href="/home"></ion-back-button>
        </ion-buttons>
        <ion-title>Nouveau signalement</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="signalement-content">
      <div class="form-container">
        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <div v-if="success" class="success-message">
          {{ success }}
        </div>

        <form @submit.prevent="handleSubmit">
          <!-- Titre -->
          <div class="form-group">
            <ion-label>Titre *</ion-label>
            <ion-input
              v-model="form.titre"
              type="text"
              placeholder="Ex: Nid de poule rue..."
              required
            ></ion-input>
          </div>

          <!-- Description -->
          <div class="form-group">
            <ion-label>Description</ion-label>
            <ion-textarea
              v-model="form.description"
              placeholder="Décrivez le problème..."
              :rows="4"
            ></ion-textarea>
          </div>

          <!-- Localisation -->
          <div class="location-section">
            <div class="section-header">
              <h3>📍 Localisation</h3>
              <ion-button fill="clear" size="small" @click="useCurrentLocation">
                <ion-icon :icon="locateOutline" slot="start"></ion-icon>
                Ma position
              </ion-button>
            </div>

            <div class="map-preview">
              <l-map
                ref="mapRef"
                v-model:zoom="mapZoom"
                :center="mapCenter"
                :use-global-leaflet="false"
                @click="onMapClick"
                style="height: 200px; width: 100%;"
              >
                <l-tile-layer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  layer-type="base"
                  name="OpenStreetMap"
                ></l-tile-layer>

                <l-marker
                  v-if="form.latitude && form.longitude"
                  :lat-lng="[form.latitude, form.longitude]"
                  :draggable="true"
                  @update:lat-lng="onMarkerDrag"
                ></l-marker>
              </l-map>
            </div>

            <p class="location-hint">
              Tapez sur la carte ou utilisez votre position GPS
            </p>

            <div class="coords-display" v-if="form.latitude && form.longitude">
              <span>Lat: {{ form.latitude.toFixed(6) }}</span>
              <span>Lng: {{ form.longitude.toFixed(6) }}</span>
            </div>
          </div>

          <!-- Bouton de soumission -->
          <ion-button
            expand="block"
            type="submit"
            :disabled="loading || !isFormValid"
            class="submit-button"
          >
            <ion-spinner v-if="loading" name="crescent"></ion-spinner>
            <span v-else>Envoyer le signalement</span>
          </ion-button>
        </form>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
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
  IonLabel,
  IonInput,
  IonTextarea,
  IonIcon,
  IonSpinner
} from '@ionic/vue';
import { locateOutline } from 'ionicons/icons';
import { Geolocation } from '@capacitor/geolocation';
import { LMap, LTileLayer, LMarker } from '@vue-leaflet/vue-leaflet';
import 'leaflet/dist/leaflet.css';
import { useSignalementsStore } from '@/stores/signalements';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const signalementsStore = useSignalementsStore();
const authStore = useAuthStore();

const mapRef = ref(null);
const mapZoom = ref(15);
const mapCenter = ref<[number, number]>([-18.8792, 47.5079]);

const form = ref({
  titre: '',
  description: '',
  latitude: null as number | null,
  longitude: null as number | null
});

const loading = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);

const isFormValid = computed(() => {
  return form.value.titre.trim() !== '' &&
         form.value.latitude !== null &&
         form.value.longitude !== null;
});

onMounted(async () => {
  await useCurrentLocation();
});

async function useCurrentLocation() {
  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true
    });
    form.value.latitude = position.coords.latitude;
    form.value.longitude = position.coords.longitude;
    mapCenter.value = [position.coords.latitude, position.coords.longitude];
  } catch (err) {
    console.error('Erreur de géolocalisation:', err);
    error.value = 'Impossible d\'obtenir votre position. Placez un point manuellement.';
  }
}

function onMapClick(event: any) {
  const { lat, lng } = event.latlng;
  form.value.latitude = lat;
  form.value.longitude = lng;
}

function onMarkerDrag(newLatLng: any) {
  form.value.latitude = newLatLng.lat;
  form.value.longitude = newLatLng.lng;
}

async function handleSubmit() {
  if (!isFormValid.value) {
    error.value = 'Veuillez remplir tous les champs obligatoires et placer un point sur la carte';
    return;
  }

  if (!authStore.currentUser) {
    error.value = 'Vous devez être connecté pour créer un signalement';
    return;
  }

  loading.value = true;
  error.value = null;
  success.value = null;

  try {
    await signalementsStore.createSignalement({
      titre: form.value.titre,
      description: form.value.description,
      latitude: form.value.latitude!,
      longitude: form.value.longitude!,
      id_utilisateur: authStore.currentUser.uid,
      statut_code: 'NOUVEAU',
      date_signalement: new Date().toISOString().split('T')[0]
    });

    success.value = 'Signalement créé avec succès !';
    
    setTimeout(() => {
      router.push('/home');
    }, 1500);
  } catch (err) {
    console.error('Erreur création signalement:', err);
    error.value = 'Erreur lors de la création du signalement';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.signalement-content {
  --background: #f5f5f5;
}

ion-toolbar {
  --background: #1a1a2e;
}

.form-container {
  padding: 20px;
}

.error-message {
  background: linear-gradient(135deg, #ff6b6b, #ee5a5a);
  color: white;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
  text-align: center;
}

.success-message {
  background: linear-gradient(135deg, #51cf66, #40c057);
  color: white;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
  text-align: center;
}

.form-group {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.form-group ion-label {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 8px;
}

.form-group ion-input,
.form-group ion-textarea {
  --background: #f8f9fa;
  --padding-start: 14px;
  --padding-end: 14px;
  --padding-top: 12px;
  --padding-bottom: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 15px;
}

.form-group ion-input:focus-within,
.form-group ion-textarea:focus-within {
  border-color: #FFC107;
  --background: white;
}

.location-section {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
  color: #1a1a2e;
}

.map-preview {
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid #e0e0e0;
}

.location-hint {
  font-size: 12px;
  color: #666;
  text-align: center;
  margin: 12px 0 8px 0;
}

.coords-display {
  display: flex;
  justify-content: center;
  gap: 20px;
  font-size: 12px;
  color: #888;
  font-family: monospace;
}

.submit-button {
  --background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%);
  --color: #1a1a2e;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  height: 52px;
  --border-radius: 12px;
  margin-top: 8px;
}

.submit-button:disabled {
  --background: #ccc;
  --color: #888;
}
</style>
