import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { Signalement, Stats, SignalementUtilisateur } from '@/types';
import { STATUTS } from '@/types';

export const useSignalementsStore = defineStore('signalements', () => {
  const signalements = ref<Signalement[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  let unsubscribe: Unsubscribe | null = null;

  // Statistiques calculées (utilise statut.code au lieu de statut_code)
  const stats = computed<Stats>(() => {
    const total = signalements.value.length;
    const nouveaux = signalements.value.filter(s => s.statut?.code === 'NOUVEAU').length;
    const en_cours = signalements.value.filter(s => s.statut?.code === 'EN_COURS').length;
    const termines = signalements.value.filter(s => s.statut?.code === 'TERMINE').length;

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

  // Récupérer les signalements de l'utilisateur connecté (par id utilisateur)
  function getMySignalements(userId: number) {
    return computed(() =>
      signalements.value.filter(s => s.utilisateur?.id === userId)
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

  // Créer un nouveau signalement (structure alignée avec PostgreSQL)
  async function createSignalement(
    data: {
      titre: string;
      description: string;
      latitude: number;
      longitude: number;
      surface_m2?: number | null;
      budget?: number | null;
    },
    utilisateur: SignalementUtilisateur,
    entreprise?: { id: number; nom: string; contact?: string } | null
  ) {
    loading.value = true;
    error.value = null;

    try {
      const signalementsRef = collection(db, 'signalements');
      
      const newSignalement: Omit<Signalement, 'id'> = {
        titre: data.titre,
        description: data.description,
        latitude: data.latitude,
        longitude: data.longitude,
        surface_m2: data.surface_m2 || null,
        budget: data.budget || null,
        date_signalement: new Date().toISOString().split('T')[0],
        statut: STATUTS[0], // NOUVEAU par défaut
        utilisateur: utilisateur,
        entreprise: entreprise ? {
          id: entreprise.id,
          nom: entreprise.nom,
          contact: entreprise.contact
        } : null,
        synced_at: null   // Pas encore synchronisé
      };

      const docRef = await addDoc(signalementsRef, newSignalement);
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
