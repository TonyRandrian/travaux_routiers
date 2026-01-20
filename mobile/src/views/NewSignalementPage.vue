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
              @ion-input="form.titre = $event.target.value"
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
              @ion-input="form.description = $event.target.value"
              placeholder="Décrivez le problème..."
              :rows="3"
            ></ion-textarea>
          </div>

          <!-- Surface en m² -->
          <div class="form-group">
            <ion-label>Surface (m²)</ion-label>
            <ion-input
              :value="form.surface_m2"
              @ion-input="form.surface_m2 = parseFloat($event.target.value) || null"
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
              @ion-input="form.budget = parseFloat($event.target.value) || null"
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
              @ion-change="form.entreprise_id = $event.target.value"
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
  IonSpinner,
  IonSelect,
  IonSelectOption
} from '@ionic/vue';
import { locateOutline } from 'ionicons/icons';
import { Geolocation } from '@capacitor/geolocation';
import { LMap, LTileLayer, LMarker } from '@vue-leaflet/vue-leaflet';
import 'leaflet/dist/leaflet.css';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useSignalementsStore } from '@/stores/signalements';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const signalementsStore = useSignalementsStore();
const authStore = useAuthStore();

const mapRef = ref(null);
const mapZoom = ref(15);
const mapCenter = ref<[number, number]>([-18.8792, 47.5079]);
const loadingEntreprises = ref(true);
const entreprisesFromFirebase = ref(false);

// Entreprises en dur pour les tests (fallback si Firebase indisponible)
const ENTREPRISES_FALLBACK = [
  { id: 1, nom: 'COLAS Madagascar (en dur)', contact: 'colas@example.mg' },
  { id: 2, nom: 'SOGEA SATOM (en dur)', contact: 'sogea@example.mg' },
  { id: 3, nom: 'EIFFAGE Madagascar (en dur)', contact: 'eiffage@example.mg' },
  { id: 4, nom: 'ENTREPRISE GÉNÉRALE (en dur)', contact: 'general@example.mg' }
];

const entreprises = ref(ENTREPRISES_FALLBACK);

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
    useCurrentLocation(),
    loadEntreprises()
  ]);
});

// Charger les entreprises depuis Firebase, fallback sur les données en dur
async function loadEntreprises() {
  loadingEntreprises.value = true;
  try {
    const entreprisesRef = collection(db, 'entreprises');
    const snapshot = await getDocs(entreprisesRef);
    
    if (!snapshot.empty) {
      entreprises.value = snapshot.docs.map(doc => ({
        id: doc.data().id || parseInt(doc.id),
        nom: doc.data().nom,
        contact: doc.data().contact
      }));
      entreprisesFromFirebase.value = true;
      console.log('Entreprises chargées depuis Firebase:', entreprises.value.length);
    } else {
      // Collection vide, utiliser fallback
      console.log('Collection entreprises vide, utilisation des données en dur');
      entreprises.value = ENTREPRISES_FALLBACK;
      entreprisesFromFirebase.value = false;
    }
  } catch (err) {
    console.error('Erreur chargement entreprises Firebase:', err);
    // Fallback sur les données en dur
    entreprises.value = ENTREPRISES_FALLBACK;
    entreprisesFromFirebase.value = false;
  } finally {
    loadingEntreprises.value = false;
  }
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

    await signalementsStore.createSignalement(
      {
        titre: form.value.titre,
        description: form.value.description,
        latitude: form.value.latitude!,
        longitude: form.value.longitude!,
        surface_m2: form.value.surface_m2,
        budget: form.value.budget
      },
      utilisateur,
      selectedEntreprise
    );

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
