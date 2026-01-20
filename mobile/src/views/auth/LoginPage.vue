<template>
  <ion-page>
    <ion-content :fullscreen="true" class="login-content">
      <!-- Animated Background -->
      <div class="animated-bg">
        <div class="blob blob-1"></div>
        <div class="blob blob-2"></div>
      </div>

      <div class="login-container">
        <!-- Back Button -->
        <div class="back-section">
          <ion-button fill="clear" class="back-btn" @click="goBack">
            <ion-icon :icon="arrowBackOutline"></ion-icon>
          </ion-button>
        </div>

        <!-- Logo -->
        <div class="logo-section">
          <div class="logo-icon">
            <ion-icon :icon="constructOutline"></ion-icon>
          </div>
          <h1>Connexion</h1>
          <p>Travaux Routiers - Antananarivo</p>
        </div>

        <!-- Login Form -->
        <div class="form-section glass">
          <div v-if="error" class="error-box">
            <ion-icon :icon="alertCircleOutline"></ion-icon>
            <span>{{ error }}</span>
          </div>

          <form @submit.prevent="handleLogin">
            <div class="input-group">
              <ion-icon :icon="mailOutline" class="input-icon"></ion-icon>
              <ion-input
                v-model="email"
                type="email"
                placeholder="Email"
                class="modern-input"
              ></ion-input>
            </div>

            <div class="input-group">
              <ion-icon :icon="lockClosedOutline" class="input-icon"></ion-icon>
              <ion-input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Mot de passe"
                class="modern-input"
              ></ion-input>
              <ion-button fill="clear" class="toggle-password" @click="showPassword = !showPassword">
                <ion-icon :icon="showPassword ? eyeOffOutline : eyeOutline"></ion-icon>
              </ion-button>
            </div>

            <ion-button 
              expand="block" 
              type="submit" 
              class="login-button"
              :disabled="loading"
            >
              <ion-spinner v-if="loading" name="crescent"></ion-spinner>
              <span v-else>Se connecter</span>
              <ion-icon v-if="!loading" :icon="arrowForwardOutline" slot="end"></ion-icon>
            </ion-button>
          </form>
        </div>

        <!-- Info -->
        <div class="info-section glass">
          <ion-icon :icon="informationCircleOutline"></ion-icon>
          <p>Inscription disponible sur le site web</p>
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
  IonButton,
  IonSpinner,
  IonIcon
} from '@ionic/vue';
import {
  constructOutline,
  arrowBackOutline,
  mailOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  arrowForwardOutline,
  alertCircleOutline,
  informationCircleOutline
} from 'ionicons/icons';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const email = ref('user1@gmail.com');
const password = ref('user1pass');
const showPassword = ref(false);
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
    const redirect = route.query.redirect as string || '/home';
    router.push(redirect);
  } catch (err) {
    error.value = authStore.error;
  } finally {
    loading.value = false;
  }
}

function goBack() {
  router.push('/home');
}
</script>

<style scoped>
.login-content {
  --background: #0a0a0f;
}

/* Animated Background */
.animated-bg {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  z-index: 0;
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
  animation: float 8s ease-in-out infinite;
}

.blob-1 {
  width: 350px;
  height: 350px;
  background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%);
  top: -150px;
  right: -100px;
}

.blob-2 {
  width: 300px;
  height: 300px;
  background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%);
  bottom: -100px;
  left: -100px;
  animation-delay: -4s;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -30px) scale(1.05); }
  66% { transform: translate(-20px, 20px) scale(0.95); }
}

/* Glass Effect - Transparent */
.glass {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.login-container {
  position: relative;
  z-index: 1;
  min-height: 100%;
  padding: 24px;
  display: flex;
  flex-direction: column;
}

/* Back Button */
.back-section {
  padding-top: 40px;
}

.back-btn {
  --color: white;
  --padding-start: 0;
}

.back-btn ion-icon {
  font-size: 24px;
}

/* Logo Section */
.logo-section {
  text-align: center;
  padding: 40px 0;
}

.logo-icon {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24px;
  box-shadow: 0 16px 48px rgba(255, 193, 7, 0.3);
}

.logo-icon ion-icon {
  font-size: 40px;
  color: #0a0a0f;
}

.logo-section h1 {
  margin: 0;
  font-size: 32px;
  font-weight: 800;
  color: white;
}

.logo-section p {
  margin: 8px 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
}

/* Form Section */
.form-section {
  border-radius: 24px;
  padding: 32px 24px;
  margin-bottom: 24px;
}

.error-box {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(244, 67, 54, 0.15);
  border: 1px solid rgba(244, 67, 54, 0.3);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 24px;
}

.error-box ion-icon {
  font-size: 20px;
  color: #f44336;
  flex-shrink: 0;
}

.error-box span {
  font-size: 13px;
  color: #f44336;
}

.input-group {
  position: relative;
  margin-bottom: 16px;
}

.input-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 20px;
  color: rgba(255, 255, 255, 0.4);
  z-index: 1;
}

.modern-input {
  --background: rgba(255, 255, 255, 0.06);
  --color: white;
  --placeholder-color: rgba(255, 255, 255, 0.3);
  --padding-start: 52px;
  --padding-end: 52px;
  --padding-top: 18px;
  --padding-bottom: 18px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  font-size: 16px;
}

.modern-input:focus-within {
  border-color: #FFC107;
}

.toggle-password {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  --color: rgba(255, 255, 255, 0.4);
  z-index: 1;
}

.login-button {
  --background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%);
  --color: #0a0a0f;
  --border-radius: 14px;
  font-weight: 700;
  font-size: 16px;
  height: 56px;
  margin-top: 8px;
}

.login-button ion-icon {
  font-size: 20px;
}

/* Info Section */
.info-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px 24px;
  border-radius: 14px;
}

.info-section ion-icon {
  font-size: 18px;
  color: #FFC107;
}

.info-section p {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}
</style>
