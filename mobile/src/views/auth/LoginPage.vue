<template>
  <ion-page>
    <ion-content :fullscreen="true" class="auth-content">
      <div class="auth-container">
        <div class="auth-card">
          <div class="auth-header">
            <div class="auth-icon">🚧</div>
            <h2>Connexion</h2>
            <p>Travaux Routiers - Antananarivo</p>
          </div>

          <div v-if="error" class="auth-error">
            {{ error }}
          </div>

          <form @submit.prevent="handleLogin" class="auth-form">
            <div class="form-group">
              <ion-label>Email</ion-label>
              <ion-input
                v-model="email"
                type="email"
                placeholder="votre@email.com"
                required
              ></ion-input>
            </div>

            <div class="form-group">
              <ion-label>Mot de passe</ion-label>
              <ion-input
                v-model="password"
                type="password"
                placeholder="••••••••"
                required
              ></ion-input>
            </div>

            <ion-button
              expand="block"
              type="submit"
              :disabled="loading"
              class="auth-button"
            >
              <ion-spinner v-if="loading" name="crescent"></ion-spinner>
              <span v-else>Se connecter</span>
            </ion-button>
          </form>

          <div class="auth-links">
            <p class="web-hint">
              <ion-icon name="information-circle-outline"></ion-icon>
              Inscription et récupération de mot de passe disponibles sur le site web
            </p>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  IonPage,
  IonContent,
  IonInput,
  IonLabel,
  IonButton,
  IonSpinner,
  IonIcon
} from '@ionic/vue';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

async function handleLogin() {
  if (!email.value || !password.value) {
    error.value = 'Veuillez remplir tous les champs';
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    await authStore.login(email.value, password.value);
    // Rediriger vers la page demandée ou home par défaut
    const redirect = route.query.redirect as string || '/home';
    router.push(redirect);
  } catch (err) {
    error.value = authStore.error;
  } finally {
    loading.value = false;
  }
}


</script>

<style scoped>
.auth-content {
  --background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
}

.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100%;
  padding: 20px;
}

.auth-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 32px 24px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  border-top: 4px solid #FFC107;
}

.auth-header {
  text-align: center;
  margin-bottom: 24px;
}

.auth-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.auth-header h2 {
  margin: 0;
  color: #1a1a2e;
  font-size: 24px;
  font-weight: 700;
}

.auth-header p {
  margin: 8px 0 0 0;
  color: #666;
  font-size: 14px;
}

.auth-error {
  background: linear-gradient(135deg, #ff6b6b, #ee5a5a);
  color: white;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
  text-align: center;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group ion-label {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.form-group ion-input {
  --background: #fafafa;
  --padding-start: 16px;
  --padding-end: 16px;
  --padding-top: 12px;
  --padding-bottom: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
}

.form-group ion-input:focus-within {
  border-color: #FFC107;
  --background: white;
}

.auth-button {
  --background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%);
  --color: #1a1a2e;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-top: 8px;
  height: 48px;
  --border-radius: 8px;
}

.auth-links {
  margin-top: 20px;
  text-align: center;
}

.auth-links .web-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #666;
  font-size: 13px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 8px;
  margin: 0;
}

.auth-links .web-hint ion-icon {
  font-size: 18px;
  color: #FF9800;
}
</style>
