import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { Signalement, Stats } from '@/types';

export const useSignalementsStore = defineStore('signalements', () => {
  const signalements = ref<Signalement[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  let unsubscribe: Unsubscribe | null = null;

  // Statistiques calculées
  const stats = computed<Stats>(() => {
    const total = signalements.value.length;
    const nouveaux = signalements.value.filter(s => s.statut_code === 'NOUVEAU').length;
    const en_cours = signalements.value.filter(s => s.statut_code === 'EN_COURS').length;
    const termines = signalements.value.filter(s => s.statut_code === 'TERMINE').length;

    const surface_totale = signalements.value.reduce((acc, s) => acc + (s.surface_m2 || 0), 0);
    const budget_total = signalements.value.reduce((acc, s) => acc + (s.budget || 0), 0);

    const avancement_pourcentage = total > 0 ? Math.round((termines / total) * 100) : 0;

    return {
      total_signalements: total,
      surface_totale,
      budget_total,
      avancement_pourcentage,
      nouveaux,
      en_cours,
      termines
    };
  });

  // Récupérer les signalements de l'utilisateur connecté
  function getMySignalements(userId: string) {
    return computed(() =>
      signalements.value.filter(s => s.id_utilisateur === userId)
    );
  }

  // Écouter les signalements en temps réel
  function subscribeToSignalements() {
    loading.value = true;
    error.value = null;

    try {
      const signalementsRef = collection(db, 'signalements');
      const q = query(signalementsRef, orderBy('date_signalement', 'desc'));

      unsubscribe = onSnapshot(q, (snapshot) => {
        signalements.value = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Signalement[];
        loading.value = false;
      }, (err) => {
        console.error('Erreur subscription signalements:', err);
        error.value = 'Erreur lors du chargement des signalements';
        loading.value = false;
      });
    } catch (err) {
      console.error('Erreur subscribeToSignalements:', err);
      error.value = 'Erreur lors de la connexion';
      loading.value = false;
    }
  }

  // Récupérer les signalements une seule fois
  async function fetchSignalements() {
    loading.value = true;
    error.value = null;

    try {
      const signalementsRef = collection(db, 'signalements');
      const q = query(signalementsRef, orderBy('date_signalement', 'desc'));
      const snapshot = await getDocs(q);

      signalements.value = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Signalement[];
    } catch (err) {
      console.error('Erreur fetchSignalements:', err);
      error.value = 'Erreur lors du chargement des signalements';
    } finally {
      loading.value = false;
    }
  }

  // Créer un nouveau signalement
  async function createSignalement(signalement: Omit<Signalement, 'id'>) {
    loading.value = true;
    error.value = null;

    try {
      const signalementsRef = collection(db, 'signalements');
      const docRef = await addDoc(signalementsRef, {
        ...signalement,
        statut_code: 'NOUVEAU',
        date_signalement: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      });

      return docRef.id;
    } catch (err: any) {
      console.error('Erreur createSignalement:', err);
      error.value = 'Erreur lors de la création du signalement';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Se désabonner des mises à jour
  function unsubscribeFromSignalements() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  return {
    signalements,
    loading,
    error,
    stats,
    getMySignalements,
    subscribeToSignalements,
    fetchSignalements,
    createSignalement,
    unsubscribeFromSignalements
  };
});
