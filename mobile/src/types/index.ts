// Types pour l'application Travaux Routiers

export interface User {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  role: 'user' | 'manager' | 'visiteur';
  tentatives: number;
  bloque: boolean;
  createdAt: string;
  updatedAt?: string;
}

// Structure imbriquée pour le statut
export interface StatutSignalement {
  id: number;
  code: 'NOUVEAU' | 'EN_COURS' | 'TERMINE';
  libelle: string;
}

// Structure imbriquée pour l'utilisateur dans un signalement
export interface SignalementUtilisateur {
  id: number;
  email: string;
  nom: string;
  prenom: string;
}

// Structure imbriquée pour l'entreprise
export interface Entreprise {
  id: number;
  nom: string;
  contact?: string;
}

// Structure Signalement alignée avec PostgreSQL et Firebase
export interface Signalement {
  id?: string;                          // Firebase document ID (= postgres id en string)
  titre: string;
  description: string;
  latitude: number;
  longitude: number;
  surface_m2: number | null;
  budget: number | null;
  date_signalement: string;             // Format: YYYY-MM-DD
  statut: StatutSignalement;            // Objet imbriqué
  utilisateur: SignalementUtilisateur;  // Objet imbriqué
  entreprise: Entreprise | null;        // Objet imbriqué ou null
  postgres_id?: number;                 // ID dans PostgreSQL pour sync
  synced_at?: string | null;            // Timestamp de dernière sync
}

export interface Stats {
  total_signalements: number;
  surface_totale: number;
  budget_total: number;
  avancement_pourcentage: number;
  nouveaux: number;
  en_cours: number;
  termines: number;
}

export type StatutCode = 'NOUVEAU' | 'EN_COURS' | 'TERMINE';

export interface MapCenter {
  lat: number;
  lng: number;
}

// Constantes pour les statuts (correspondant à PostgreSQL)
export const STATUTS: StatutSignalement[] = [
  { id: 1, code: 'NOUVEAU', libelle: 'Nouveau' },
  { id: 2, code: 'EN_COURS', libelle: 'En cours' },
  { id: 3, code: 'TERMINE', libelle: 'Terminé' }
];
