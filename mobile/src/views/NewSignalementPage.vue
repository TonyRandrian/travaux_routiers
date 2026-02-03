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
              :value="form.titre"
              @ion-input="form.titre = ($event.detail?.value ?? '')"
              type="text"
              placeholder="Ex: Nid de poule rue..."
              required
            ></ion-input>
          </div>

          <!-- Description -->
          <div class="form-group">
            <ion-label>Description</ion-label>
            <ion-textarea
              :value="form.description"
              @ion-input="form.description = ($event.detail?.value ?? '')"
              placeholder="Décrivez le problème..."
              :rows="3"
            ></ion-textarea>
          </div>

          <!-- Section Photos -->
          <div class="photos-section">
            <div class="section-header">
              <h3>📷 Photos</h3>
              <div class="photo-buttons">
                <ion-button fill="clear" size="small" @click="takePhoto">
                  <ion-icon :icon="cameraOutline" slot="start"></ion-icon>
                  Caméra
                </ion-button>
                <ion-button fill="clear" size="small" @click="pickFromGallery">
                  <ion-icon :icon="imagesOutline" slot="start"></ion-icon>
                  Galerie
                </ion-button>
              </div>
            </div>

            <!-- Grille de photos -->
            <div class="photos-grid" v-if="photoPreviews.length > 0">
              <div 
                v-for="(preview, index) in photoPreviews" 
                :key="index" 
                class="photo-item"
              >
                <img :src="preview" alt="Photo" />
                <div class="photo-remove" @click="removePhoto(index)">
                  <ion-icon :icon="closeOutline"></ion-icon>
                </div>
                <div class="photo-order">{{ index + 1 }}</div>
              </div>
              
              <!-- Bouton ajouter plus -->
              <div class="photo-add-more" @click="takePhoto">
                <ion-icon :icon="addOutline"></ion-icon>
              </div>
            </div>

            <!-- État vide -->
            <div v-else class="photos-empty">
              <ion-icon :icon="imagesOutline"></ion-icon>
              <p>Utilisez les boutons ci-dessus pour ajouter des photos</p>
            </div>

            <!-- Erreur photo -->
            <div v-if="photoUpload.error.value" class="photo-error">
              <ion-icon :icon="alertCircleOutline"></ion-icon>
              {{ photoUpload.error.value }}
            </div>

            <!-- Indicateur d'upload -->
            <div v-if="photoUpload.uploading.value" class="upload-progress">
              <ion-spinner name="crescent"></ion-spinner>
              <span>Upload en cours... {{ photoUpload.uploadProgress.value }}%</span>
            </div>
          </div>

          <!-- Surface en m² -->
          <div class="form-group">
            <ion-label>Surface (m²)</ion-label>
            <ion-input
              :value="form.surface_m2"
              @ion-input="form.surface_m2 = parseFloat(String($event.detail?.value ?? '')) || null"
              type="number"
              placeholder="Ex: 25"
              step="0.1"
              min="0"
            ></ion-input>
          </div>

          <!-- Budget estimé -->
          <div class="form-group">
            <ion-label>Budget estimé (Ar)</ion-label>
            <ion-input
              :value="form.budget"
              @ion-input="form.budget = parseFloat(String($event.detail?.value ?? '')) || null"
              type="number"
              placeholder="Ex: 500000"
              step="1000"
              min="0"
            ></ion-input>
          </div>

          <!-- Entreprise -->
          <div class="form-group">
            <ion-label>Entreprise (optionnel)</ion-label>
            <ion-select
              :value="form.entreprise_id"
              @ion-change="form.entreprise_id = ($event.detail?.value ?? null)"
              placeholder="Sélectionner une entreprise"
              interface="action-sheet"
            >
              <ion-select-option :value="null">Aucune</ion-select-option>
              <ion-select-option v-for="ent in entreprises" :key="ent.id" :value="ent.id">
                {{ ent.nom }}
              </ion-select-option>
            </ion-select>
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
            :disabled="loading || !isFormValid || photoUpload.uploading.value"
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
  IonSpinner,
  IonSelect,
  IonSelectOption
} from '@ionic/vue';
import { locateOutline, cameraOutline, closeOutline, addOutline, imagesOutline, alertCircleOutline } from 'ionicons/icons';
import { Geolocation } from '@capacitor/geolocation';
import type { Photo } from '@capacitor/camera';
import { LMap, LTileLayer, LMarker } from '@vue-leaflet/vue-leaflet';
import 'leaflet/dist/leaflet.css';
import { useSignalementsStore } from '@/stores/signalements';
import { useAuthStore } from '@/stores/auth';
import { useReferentielsStore } from '@/stores/referentiels';
import { usePhotoUpload } from '@/composables/usePhotoUpload';
import type { PhotoSignalement } from '@/types';

const router = useRouter();
const signalementsStore = useSignalementsStore();
const authStore = useAuthStore();
const referentielsStore = useReferentielsStore();
const photoUpload = usePhotoUpload();

const mapRef = ref(null);
const mapZoom = ref(15);
const mapCenter = ref<[number, number]>([-18.8792, 47.5079]);

// Entreprises depuis le store referentiels
const entreprises = computed(() => referentielsStore.entreprises);

// Photos capturées (avant upload)
const capturedPhotos = ref<Photo[]>([]);
const photoPreviews = computed(() => 
  capturedPhotos.value.map(photo => photoUpload.getPhotoPreview(photo))
);

const form = ref({
  titre: '',
  description: '',
  surface_m2: null as number | null,
  budget: null as number | null,
  entreprise_id: null as number | null,
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
  await Promise.all([
    useCurrentLocation()
  ]);
});

// Prendre une photo avec la caméra
async function takePhoto() {
  console.log('Bouton caméra cliqué');
  const photo = await photoUpload.takePhotoWithCamera();
  if (photo) {
    capturedPhotos.value.push(photo);
    console.log('Photo ajoutée, total:', capturedPhotos.value.length);
  }
}

// Sélectionner une photo depuis la galerie
async function pickFromGallery() {
  console.log('Bouton galerie cliqué');
  const photo = await photoUpload.pickPhoto();
  if (photo) {
    capturedPhotos.value.push(photo);
    console.log('Photo ajoutée depuis galerie, total:', capturedPhotos.value.length);
  }
}

// Supprimer une photo
function removePhoto(index: number) {
  capturedPhotos.value.splice(index, 1);
}

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
    // Préparer les données utilisateur pour le signalement
    const utilisateur = {
      id: 0, // Sera attribué lors de la sync avec PostgreSQL
      email: authStore.currentUser.email || '',
      nom: authStore.currentUser.displayName?.split(' ')[1] || '',
      prenom: authStore.currentUser.displayName?.split(' ')[0] || ''
    };

    // Trouver l'entreprise sélectionnée
    const selectedEntreprise = form.value.entreprise_id 
      ? entreprises.value.find(e => e.id === form.value.entreprise_id) || null
      : null;

    // Créer d'abord le signalement pour obtenir l'ID
    const signalementId = await signalementsStore.createSignalement(
      {
        titre: form.value.titre,
        description: form.value.description,
        latitude: form.value.latitude!,
        longitude: form.value.longitude!,
        surface_m2: form.value.surface_m2,
        budget: form.value.budget,
        photos: [] // Photos vides initialement
      },
      utilisateur,
      selectedEntreprise
    );

    // Upload des photos si présentes
    if (capturedPhotos.value.length > 0 && signalementId) {
      const uploadedPhotos = await photoUpload.uploadPhotos(signalementId, capturedPhotos.value);
      
      // Mettre à jour le signalement avec les photos uploadées
      if (uploadedPhotos.length > 0) {
        const { doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('@/config/firebase');
        if (db) {
          const signalementRef = doc(db, 'signalements', signalementId);
          await updateDoc(signalementRef, { photos: uploadedPhotos });
        }
      }
    }

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
.form-group ion-textarea,
.form-group ion-select {
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
.form-group ion-textarea:focus-within,
.form-group ion-select:focus-within {
  border-color: #FFC107;
  --background: white;
}

.form-group ion-select {
  width: 100%;
}

/* Section Photos */
.photos-section {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.photos-section .section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}

.photos-section .section-header h3 {
  margin: 0;
  font-size: 16px;
  color: #1a1a2e;
}

.photo-buttons {
  display: flex;
  gap: 4px;
}

.photo-buttons ion-button {
  --color: #FFC107;
  font-size: 12px;
}

.photos-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.photo-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid #e0e0e0;
}

.photo-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-remove {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  background: rgba(255, 59, 48, 0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.photo-remove ion-icon {
  color: white;
  font-size: 14px;
}

.photo-order {
  position: absolute;
  bottom: 6px;
  left: 6px;
  width: 20px;
  height: 20px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 11px;
  font-weight: 600;
}

.photo-add-more {
  aspect-ratio: 1;
  border-radius: 12px;
  border: 2px dashed #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.photo-add-more:hover {
  border-color: #FFC107;
  background: rgba(255, 193, 7, 0.1);
}

.photo-add-more ion-icon {
  font-size: 28px;
  color: #999;
}

.photos-empty {
  border: 2px dashed #ccc;
  border-radius: 12px;
  padding: 30px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.photos-empty:hover {
  border-color: #FFC107;
  background: rgba(255, 193, 7, 0.05);
}

.photos-empty ion-icon {
  font-size: 48px;
  color: #bbb;
  margin-bottom: 8px;
}

.photos-empty p {
  margin: 0;
  color: #888;
  font-size: 14px;
}

.upload-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px;
  margin-top: 12px;
  background: #f0f0f0;
  border-radius: 8px;
}

.upload-progress ion-spinner {
  width: 20px;
  height: 20px;
  color: #FFC107;
}

.upload-progress span {
  font-size: 13px;
  color: #666;
}

.photo-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin-top: 12px;
  background: #fff3f3;
  border: 1px solid #ffcdd2;
  border-radius: 8px;
  color: #c62828;
  font-size: 13px;
}

.photo-error ion-icon {
  font-size: 18px;
  flex-shrink: 0;
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
