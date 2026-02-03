<template>
  <transition name="notification-slide">
    <div v-if="isVisible" class="notification-overlay">
      <div class="notification-card glass">
        <div class="notification-header">
          <div class="notification-icon">
            <ion-icon :icon="notificationsOutline"></ion-icon>
          </div>
          <div class="notification-meta">
            <h3 class="notification-title">{{ notification.title }}</h3>
            <p class="notification-time">{{ formatTime(notification.timestamp) }}</p>
          </div>
          <ion-button fill="clear" size="small" @click="closeNotification">
            <ion-icon :icon="closeOutline"></ion-icon>
          </ion-button>
        </div>
        
        <div class="notification-body">
          <p class="notification-message">{{ notification.body }}</p>
          
          <!-- Détails du signalement si disponible -->
          <div v-if="notification.signalementData" class="notification-details">
            <div class="detail-row">
              <ion-icon :icon="constructOutline"></ion-icon>
              <span>{{ notification.signalementData.titre }}</span>
            </div>
            <div v-if="notification.signalementData.entreprise" class="detail-row">
              <ion-icon :icon="businessOutline"></ion-icon>
              <span>{{ notification.signalementData.entreprise }}</span>
            </div>
            <div class="detail-row">
              <ion-icon :icon="checkmarkCircleOutline"></ion-icon>
              <span class="status" :class="notification.signalementData.status">
                {{ formatStatus(notification.signalementData.status) }}
              </span>
            </div>
          </div>
        </div>

        <div class="notification-actions">
          <ion-button 
            fill="clear" 
            size="small" 
            @click="viewOnMap"
            v-if="notification.signalementData"
          >
            <ion-icon :icon="locationOutline" slot="start"></ion-icon>
            Voir sur la carte
          </ion-button>
          <ion-button 
            fill="clear" 
            size="small" 
            color="medium"
            @click="closeNotification"
          >
            Fermer
          </ion-button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { 
  IonIcon, 
  IonButton 
} from '@ionic/vue';
import { 
  notificationsOutline, 
  closeOutline, 
  constructOutline, 
  businessOutline,
  checkmarkCircleOutline,
  locationOutline
} from 'ionicons/icons';

interface NotificationData {
  title: string;
  body: string;
  timestamp: string;
  signalementData?: {
    id: string;
    titre: string;
    entreprise?: string;
    status: 'EN_COURS' | 'TERMINE';
    latitude?: number;
    longitude?: number;
  };
}

interface Props {
  notification: NotificationData;
  isVisible: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isVisible: false
});

const emit = defineEmits<{
  close: [];
  viewOnMap: [{ latitude: number; longitude: number }];
}>();

const closeNotification = () => {
  emit('close');
};

const viewOnMap = () => {
  if (props.notification.signalementData?.latitude && props.notification.signalementData?.longitude) {
    emit('viewOnMap', {
      latitude: props.notification.signalementData.latitude,
      longitude: props.notification.signalementData.longitude
    });
  }
  closeNotification();
};

const formatTime = (timestamp: string) => {
  const now = new Date();
  const notifTime = new Date(timestamp);
  const diffMs = now.getTime() - notifTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  return notifTime.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
};

const formatStatus = (status: string) => {
  switch (status) {
    case 'EN_COURS':
      return 'En cours de traitement';
    case 'TERMINE':
      return 'Traité avec succès';
    default:
      return status;
  }
};
</script>

<style scoped>
.notification-overlay {
  position: fixed;
  top: 80px;
  left: 20px;
  right: 20px;
  z-index: 9999;
  max-width: 400px;
  margin: 0 auto;
  pointer-events: auto;
}

.notification-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.notification-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.notification-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #3880ff, #5260ff);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.notification-icon ion-icon {
  color: white;
  font-size: 20px;
}

.notification-meta {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 4px 0;
  line-height: 1.3;
}

.notification-time {
  font-size: 12px;
  color: #8a8a8a;
  margin: 0;
}

.notification-body {
  margin-bottom: 16px;
}

.notification-message {
  font-size: 14px;
  color: #4a4a4a;
  line-height: 1.4;
  margin: 0 0 12px 0;
}

.notification-details {
  background: rgba(248, 249, 250, 0.8);
  border-radius: 8px;
  padding: 12px;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  color: #6a6a6a;
}

.detail-row:last-child {
  margin-bottom: 0;
}

.detail-row ion-icon {
  font-size: 16px;
  color: #8a8a8a;
  flex-shrink: 0;
}

.status {
  font-weight: 500;
}

.status.EN_COURS {
  color: #f59e0b;
}

.status.TERMINE {
  color: #10b981;
}

.notification-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

/* Animations */
.notification-slide-enter-active,
.notification-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.notification-slide-enter-from {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}

.notification-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}

/* Glass effect */
.glass {
  background: rgba(255, 255, 255, 0.25);
  border-radius: 16px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

/* Responsive */
@media (max-width: 768px) {
  .notification-overlay {
    left: 12px;
    right: 12px;
    top: 70px;
  }
  
  .notification-card {
    padding: 14px;
  }
  
  .notification-title {
    font-size: 15px;
  }
  
  .notification-message {
    font-size: 13px;
  }
}
</style>