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
import type { Signalement, Stats, SignalementUtilisateur, StatutSignalement } from '@/types';
import { useReferentielsStore } from '@/stores/referentiels';

// Fonction pour normaliser un signalement (supporte format plat et imbriqué)
function normalizeSignalement(doc: any): Signalement {
  const data = doc.data ? doc.data() : doc;
  const referentielsStore = useReferentielsStore();
  
  // Normaliser le statut: supporte statut_code (plat) ou statut (imbriqué)
  let statut: StatutSignalement;
  if (data.statut && typeof data.statut === 'object' && data.statut.code) {
    // Format imbriqué: { code, libelle, id }
    statut = data.statut;
  } else if (data.statut_code) {
    // Format plat (ancien): statut_code = "NOUVEAU"
    statut = referentielsStore.getStatutByCode(data.statut_code);
  } else {
    // Fallback
    statut = referentielsStore.getStatutByCode('NOUVEAU');
  }
  
  // Normaliser l'utilisateur: supporte id_utilisateur (plat) ou utilisateur (imbriqué)
  let utilisateur = data.utilisateur;
  if (!utilisateur && data.id_utilisateur) {
    utilisateur = {
      id: data.id_utilisateur,
      email: data.email_utilisateur || '',
      nom: data.nom_utilisateur || '',
      prenom: data.prenom_utilisateur || ''
    };
  }
  
  // Normaliser l'entreprise: supporte id_entreprise (plat) ou entreprise (imbriqué)
  let entreprise = data.entreprise;
  if (!entreprise && data.id_entreprise) {
    entreprise = referentielsStore.getEntrepriseById(data.id_entreprise);
  }
  
  return {
    id: doc.id || data.id,
    titre: data.titre || '',
    description: data.description || '',
    latitude: data.latitude || 0,
    longitude: data.longitude || 0,
    surface_m2: data.surface_m2 || null,
    budget: data.budget || null,
    date_signalement: data.date_signalement || '',
    statut,
    utilisateur,
    entreprise,
    postgres_id: data.postgres_id,
    synced_at: data.synced_at,
    pourcentage_completion: data.pourcentage_completion || 0
  };
}

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
      if (!db) {
        console.warn('Firestore non initialisé - subscription signalements annulée');
        loading.value = false;
        error.value = 'Firestore non initialisé';
        return;
      }

      const signalementsRef = collection(db, 'signalements');
      const q = query(signalementsRef, orderBy('date_signalement', 'desc'));

      unsubscribe = onSnapshot(q, (snapshot) => {
        signalements.value = snapshot.docs.map(doc => normalizeSignalement(doc));
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
      if (!db) {
        console.warn('Firestore non initialisé - impossibilité de récupérer les signalements');
        error.value = 'Firestore non initialisé';
        return;
      }

      const signalementsRef = collection(db, 'signalements');
      const q = query(signalementsRef, orderBy('date_signalement', 'desc'));
      const snapshot = await getDocs(q);

      signalements.value = snapshot.docs.map(doc => normalizeSignalement(doc));
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
      if (!db) {
        console.warn('Firestore non initialisé - impossible de créer un signalement');
        throw new Error('Firestore non initialisé');
      }

      const signalementsRef = collection(db, 'signalements');
      
      // Récupérer le statut NOUVEAU depuis les référentiels
      const referentielsStore = useReferentielsStore();
      const statutNouveau = referentielsStore.getStatutByCode('NOUVEAU');
      
      const newSignalement: Omit<Signalement, 'id'> = {
        titre: data.titre,
        description: data.description,
        latitude: data.latitude,
        longitude: data.longitude,
        surface_m2: data.surface_m2 || null,
        budget: data.budget || null,
        date_signalement: new Date().toISOString().split('T')[0],
        statut: statutNouveau, // NOUVEAU par défaut depuis référentiels
        utilisateur: utilisateur,
        entreprise: entreprise ? {
          id: entreprise.id,
          nom: entreprise.nom,
          contact: entreprise.contact
        } : null,
        synced_at: null,   // Pas encore synchronisé
        pourcentage_completion: 0  // 0% au début
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
