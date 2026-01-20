<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="dark">
        <ion-buttons slot="start">
          <ion-back-button default-href="/home"></ion-back-button>
        </ion-buttons>
        <ion-title>Mon profil</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="profile-content">
      <div class="profile-container">
        <!-- Avatar et infos principales -->
        <div class="profile-header">
          <div class="avatar">
            <span>{{ getInitials(userProfile?.displayName) }}</span>
          </div>
          <h2>{{ userProfile?.displayName || 'Utilisateur' }}</h2>
          <p>{{ userProfile?.email }}</p>
        </div>

        <!-- Formulaire de modification -->
        <div class="profile-form">
          <div v-if="error" class="error-message">
            {{ error }}
          </div>

          <div v-if="success" class="success-message">
            {{ success }}
          </div>

          <div class="form-group">
            <ion-label>Nom complet</ion-label>
            <ion-input
              :value="form.displayName"
              @ion-input="form.displayName = $event.target.value"
              type="text"
              placeholder="Votre nom"
            ></ion-input>
          </div>

          <div class="form-group">
            <ion-label>Téléphone</ion-label>
            <ion-input
              :value="form.phone"
              @ion-input="form.phone = $event.target.value"
              type="tel"
              placeholder="+261 34 00 000 00"
            ></ion-input>
          </div>

          <ion-button
            expand="block"
            @click="handleUpdate"
            :disabled="loading"
            class="save-button"
          >
            <ion-spinner v-if="loading" name="crescent"></ion-spinner>
            <span v-else>Enregistrer les modifications</span>
          </ion-button>
        </div>

        <!-- Section déconnexion -->
        <div class="logout-section">
          <ion-button
            expand="block"
            color="danger"
            fill="outline"
            @click="handleLogout"
          >
            <ion-icon :icon="logOutOutline" slot="start"></ion-icon>
            Déconnexion
          </ion-button>
        </div>

        <!-- Infos compte -->
        <div class="account-info">
          <p><strong>Membre depuis:</strong> {{ formatDate(userProfile?.createdAt) }}</p>
          <p><strong>Rôle:</strong> {{ getRoleLabel(userProfile?.role) }}</p>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
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
  IonIcon,
  IonSpinner
} from '@ionic/vue';
import { logOutOutline } from 'ionicons/icons';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const userProfile = computed(() => authStore.userProfile);

const form = ref({
  displayName: '',
  phone: ''
});

const loading = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);

onMounted(() => {
  if (userProfile.value) {
    form.value.displayName = userProfile.value.displayName || '';
    form.value.phone = userProfile.value.phone || '';
  }
});

watch(userProfile, (newVal) => {
  if (newVal) {
    form.value.displayName = newVal.displayName || '';
    form.value.phone = newVal.phone || '';
  }
});

function getInitials(name: string | undefined): string {
  if (!name) return 'U';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getRoleLabel(role: string | undefined): string {
  switch (role) {
    case 'user':
      return 'Utilisateur';
    case 'manager':
      return 'Manager';
    default:
      return 'Utilisateur';
  }
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

async function handleUpdate() {
  loading.value = true;
  error.value = null;
  success.value = null;

  try {
    await authStore.updateUserProfile({
      displayName: form.value.displayName,
      phone: form.value.phone
    });
    success.value = 'Profil mis à jour avec succès !';
  } catch (err) {
    error.value = 'Erreur lors de la mise à jour du profil';
  } finally {
    loading.value = false;
  }
}

async function handleLogout() {
  try {
    await authStore.logout();
    router.push('/login');
  } catch (err) {
    console.error('Erreur de déconnexion:', err);
  }
}
</script>

<style scoped>
.profile-content {
  --background: #f5f5f5;
}

ion-toolbar {
  --background: #1a1a2e;
}

.profile-container {
  padding: 20px;
}

.profile-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px 20px;
  background: white;
  border-radius: 16px;
  margin-bottom: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.avatar span {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a2e;
}

.profile-header h2 {
  margin: 0 0 4px 0;
  font-size: 22px;
  color: #1a1a2e;
}

.profile-header p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.profile-form {
  background: white;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
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
  margin-bottom: 16px;
}

.form-group ion-label {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 8px;
}

.form-group ion-input {
  --background: #f8f9fa;
  --padding-start: 14px;
  --padding-end: 14px;
  --padding-top: 12px;
  --padding-bottom: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 15px;
}

.form-group ion-input:focus-within {
  border-color: #FFC107;
  --background: white;
}

.save-button {
  --background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%);
  --color: #1a1a2e;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  height: 48px;
  --border-radius: 8px;
  margin-top: 8px;
}

.logout-section {
  margin-bottom: 20px;
}

.account-info {
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.account-info p {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #666;
}

.account-info p:last-child {
  margin-bottom: 0;
}

.account-info strong {
  color: #1a1a2e;
}
</style>
