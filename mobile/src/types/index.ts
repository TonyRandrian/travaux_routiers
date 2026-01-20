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

export interface Signalement {
  id?: string;
  titre: string;
  description: string;
  latitude: number;
  longitude: number;
  surface_m2?: number | null;
  budget?: number | null;
  date_signalement: string;
  statut_code: 'NOUVEAU' | 'EN_COURS' | 'TERMINE';
  id_utilisateur: string;
  id_entreprise?: string | null;
  entreprise?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Entreprise {
  id: string;
  nom: string;
  contact?: string;
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
