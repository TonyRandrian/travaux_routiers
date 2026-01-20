<template>
  <ion-page>
    <ion-content :fullscreen="true" class="auth-content">
      <div class="auth-container">
        <div class="auth-card">
          <div class="auth-header">
            <div class="auth-icon">🚧</div>
            <h2>Inscription</h2>
            <p>Créer un compte</p>
          </div>

          <div v-if="error" class="auth-error">
            {{ error }}
          </div>

          <div v-if="success" class="auth-success">
            {{ success }}
          </div>

          <form @submit.prevent="handleRegister" class="auth-form">
            <div class="form-row">
              <div class="form-group">
                <ion-label>Nom</ion-label>
                <ion-input
                  v-model="nom"
                  type="text"
                  placeholder="Votre nom"
                  required
                ></ion-input>
              </div>

              <div class="form-group">
                <ion-label>Prénom</ion-label>
                <ion-input
                  v-model="prenom"
                  type="text"
                  placeholder="Votre prénom"
                  required
                ></ion-input>
              </div>
            </div>

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
              <ion-label>Téléphone</ion-label>
              <ion-input
                v-model="phone"
                type="tel"
                placeholder="+261 34 00 000 00"
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

            <div class="form-group">
              <ion-label>Confirmer le mot de passe</ion-label>
              <ion-input
                v-model="confirmPassword"
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
              <span v-else>S'inscrire</span>
            </ion-button>
          </form>

          <div class="auth-links">
            <p>
              Déjà un compte ?
              <ion-button fill="clear" size="small" class="highlight" @click="goToLogin">
                Se connecter
              </ion-button>
            </p>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonContent,
  IonInput,
  IonLabel,
  IonButton,
  IonSpinner
} from '@ionic/vue';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const nom = ref('');
const prenom = ref('');
const email = ref('');
const phone = ref('');
const password = ref('');
const confirmPassword = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);

async function handleRegister() {
  error.value = null;
  success.value = null;

  if (!nom.value || !prenom.value || !email.value || !password.value) {
    error.value = 'Veuillez remplir tous les champs obligatoires';
    return;
  }

  if (password.value !== confirmPassword.value) {
    error.value = 'Les mots de passe ne correspondent pas';
    return;
  }

  if (password.value.length < 6) {
    error.value = 'Le mot de passe doit contenir au moins 6 caractères';
    return;
  }

  loading.value = true;

  try {
    const displayName = `${prenom.value} ${nom.value}`;
    await authStore.signup(email.value, password.value, displayName, phone.value);
    success.value = 'Compte créé avec succès !';
    setTimeout(() => {
      router.push('/home');
    }, 1500);
  } catch (err) {
    error.value = authStore.error;
  } finally {
    loading.value = false;
  }
}

function goToLogin() {
  router.push('/login');
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

.auth-success {
  background: linear-gradient(135deg, #51cf66, #40c057);
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
  gap: 14px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
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
  --padding-top: 10px;
  --padding-bottom: 10px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 15px;
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

.auth-links p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.auth-links .highlight {
  --color: #FF9800;
  font-weight: 600;
}
</style>
