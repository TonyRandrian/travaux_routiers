import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';

// Interface pour les statuts
export interface StatutSignalement {
  id: number;
  code: 'NOUVEAU' | 'EN_COURS' | 'TERMINE';
  libelle: string;
  couleur: string;
}

// Interface pour les entreprises
export interface Entreprise {
  id: number;
  nom: string;
  contact?: string;
}

const STATUTS_FALLBACK: StatutSignalement[] = [
  { id: 1, code: 'NOUVEAU', libelle: 'Nouveau', couleur: '#f44336' },
  { id: 2, code: 'EN_COURS', libelle: 'En cours', couleur: '#FF9800' },
  { id: 3, code: 'TERMINE', libelle: 'Terminé', couleur: '#4CAF50' }
];

const ENTREPRISES_FALLBACK: Entreprise[] = [
  { id: 1, nom: 'COLAS Madagascar ', contact: 'colas@example.mg' },
  { id: 2, nom: 'SOGEA SATOM ', contact: 'sogea@example.mg' },
  { id: 3, nom: 'EIFFAGE Madagascar ', contact: 'eiffage@example.mg' },
  { id: 4, nom: 'ENTREPRISE GÉNÉRALE ', contact: 'general@example.mg' }
];

export const useReferentielsStore = defineStore('referentiels', () => {
  const statuts = ref<StatutSignalement[]>(STATUTS_FALLBACK);
  const entreprises = ref<Entreprise[]>(ENTREPRISES_FALLBACK);
  const loading = ref(false);
  const statutsFromFirebase = ref(false);
  const entreprisesFromFirebase = ref(false);

  // Getters
  const getStatutByCode = computed(() => {
    return (code: string) => statuts.value.find(s => s.code === code) || STATUTS_FALLBACK[0];
  });

  const getStatutById = computed(() => {
    return (id: number) => statuts.value.find(s => s.id === id) || STATUTS_FALLBACK[0];
  });

  const getEntrepriseById = computed(() => {
    return (id: number) => entreprises.value.find(e => e.id === id) || null;
  });

  const getColorByCode = computed(() => {
    return (code: string | undefined): string => {
      if (!code) return '#888888';
      const statut = statuts.value.find(s => s.code === code);
      return statut?.couleur || '#888888';
    };
  });

  // Charger tous les référentiels
  async function loadAll() {
    loading.value = true;
    await Promise.all([
      loadStatuts(),
      loadEntreprises()
    ]);
    loading.value = false;
  }

  // Charger les statuts depuis Firebase
  async function loadStatuts() {
    try {
      if (!db) {
        console.warn('Firestore non initialisé - statuts non chargés');
        statuts.value = STATUTS_FALLBACK;
        statutsFromFirebase.value = false;
        return;
      }

      const statutsRef = collection(db, 'statuts');
      const snapshot = await getDocs(statutsRef);

      if (!snapshot.empty) {
        statuts.value = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: data.id || parseInt(doc.id),
            code: data.code,
            libelle: data.libelle,
            couleur: data.couleur || getDefaultColor(data.code)
          };
        });
        statutsFromFirebase.value = true;
        console.log('Statuts chargés depuis Firebase:', statuts.value.length);
      } else {
        console.log('Collection statuts vide, utilisation des données en dur');
        statuts.value = STATUTS_FALLBACK;
        statutsFromFirebase.value = false;
      }
    } catch (err) {
      console.error('Erreur chargement statuts Firebase:', err);
      statuts.value = STATUTS_FALLBACK;
      statutsFromFirebase.value = false;
    }
  }

  // Charger les entreprises depuis Firebase
  async function loadEntreprises() {
    try {
      if (!db) {
        console.warn('Firestore non initialisé - entreprises non chargées');
        entreprises.value = ENTREPRISES_FALLBACK;
        entreprisesFromFirebase.value = false;
        return;
      }

      const entreprisesRef = collection(db, 'entreprises');
      const snapshot = await getDocs(entreprisesRef);

      if (!snapshot.empty) {
        entreprises.value = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: data.id || parseInt(doc.id),
            nom: data.nom,
            contact: data.contact
          };
        });
        entreprisesFromFirebase.value = true;
        console.log('Entreprises chargées depuis Firebase:', entreprises.value.length);
      } else {
        console.log('Collection entreprises vide, utilisation des données en dur');
        entreprises.value = ENTREPRISES_FALLBACK;
        entreprisesFromFirebase.value = false;
      }
    } catch (err) {
      console.error('Erreur chargement entreprises Firebase:', err);
      entreprises.value = ENTREPRISES_FALLBACK;
      entreprisesFromFirebase.value = false;
    }
  }

  // Couleur par défaut selon le code
  function getDefaultColor(code: string): string {
    switch (code) {
      case 'NOUVEAU': return '#f44336';
      case 'EN_COURS': return '#FF9800';
      case 'TERMINE': return '#4CAF50';
      default: return '#888888';
    }
  }

  return {
    statuts,
    entreprises,
    loading,
    statutsFromFirebase,
    entreprisesFromFirebase,
    getStatutByCode,
    getStatutById,
    getEntrepriseById,
    getColorByCode,
    loadAll,
    loadStatuts,
    loadEntreprises
  };
});
