CREATE TABLE IF NOT EXISTS role (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL, -- VISITEUR, USER, MANAGER
    libelle VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS utilisateur (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    mot_de_passe TEXT NOT NULL,
    nom VARCHAR(100),
    prenom VARCHAR(100),
    id_role INT REFERENCES role(id),
    tentatives INT DEFAULT 0,
    bloque BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entreprise (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(150) UNIQUE NOT NULL,
    contact VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS statut_signalement(
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL, -- NOUVEAU, EN_COURS, TERMINE
    libelle VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS signalement (
    id SERIAL PRIMARY KEY,
    titre VARCHAR(150),
    description TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    surface_m2 DOUBLE PRECISION,
    budget DOUBLE PRECISION,
    date_signalement DATE DEFAULT CURRENT_DATE,
    id_statut_signalement INT REFERENCES statut_signalement(id),
    id_utilisateur INT REFERENCES utilisateur(id),
    id_entreprise INT REFERENCES entreprise(id),
    firebase_id VARCHAR(100) UNIQUE,
    synced_at TIMESTAMP
);

-- Créer un index pour optimiser les recherches par firebase_id
CREATE INDEX IF NOT EXISTS idx_signalement_firebase_id ON signalement(firebase_id);

-- Créer un index pour les signalements non synchronisés
CREATE INDEX IF NOT EXISTS idx_signalement_synced_at ON signalement(synced_at);

CREATE TABLE IF NOT EXISTS signalement_statut(
    id SERIAL PRIMARY KEY,
    id_signalement INT REFERENCES signalement(id),
    id_statut_signalement INT REFERENCES statut_signalement(id),
    date_changement TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


--Creation de la table de config de prix de rreparation par m2
CREATE TABLE IF NOT EXISTS config_prix_m2 (
    id SERIAL PRIMARY KEY,
    prix DOUBLE PRECISION NOT NULL,
    date_debut DATE NOT NULL
);

INSERT INTO config_prix_m2 (prix, date_debut) VALUES 
(50000, '2025-01-01');

-- Données initiales (INSERT IGNORE pour éviter les doublons)

-- Rôles
INSERT INTO role (code, libelle) VALUES 
('VISITEUR', 'Visiteur'),
('USER', 'Utilisateur'),
('MANAGER', 'Manager')
ON CONFLICT (code) DO NOTHING;

-- Statuts des signalements
INSERT INTO statut_signalement (code, libelle) VALUES 
('NOUVEAU', 'Nouveau'),
('EN_COURS', 'En cours'),
('TERMINE', 'Terminé')
ON CONFLICT (code) DO NOTHING;

-- Entreprises de travaux
INSERT INTO entreprise (nom, contact) VALUES 
('COLAS Madagascar', 'colas@example.mg'),
('SOGEA SATOM', 'sogea@example.mg'),
('EIFFAGE Madagascar', 'eiffage@example.mg'),
('ENTREPRISE GÉNÉRALE', 'general@example.mg')
ON CONFLICT (nom) DO NOTHING;

-- Utilisateur Manager par défaut (mot de passe: manager123)
INSERT INTO utilisateur (email, mot_de_passe, nom, prenom, id_role) VALUES 
('manager@test.mg', 'manager', 'Admin', 'Manager', 3)
ON CONFLICT (email) DO NOTHING;

-- Signalements de test pour Antananarivo
INSERT INTO signalement (titre, description, latitude, longitude, surface_m2, budget, id_statut_signalement, id_utilisateur, id_entreprise, date_signalement) VALUES 
('Nid de poule Avenue de l''Indépendance', 'Grand nid de poule dangereux au centre-ville', -18.8792, 47.5079, 15.5, 2500000, 1, 1, NULL, '2026-01-15'),
('Route dégradée Analakely', 'Chaussée très abîmée sur 50 mètres', -18.9100, 47.5250, 120.0, 45000000, 2, 1, 1, '2026-01-10'),
('Travaux finalisés Isoraka', 'Réfection complète de la chaussée terminée', -18.8850, 47.5150, 200.0, 75000000, 3, 1, 2, '2025-12-20'),
('Effondrement partiel Andravoahangy', 'Affaissement de la route suite aux pluies', -18.9050, 47.5350, 35.0, 15000000, 2, 1, 3, '2026-01-18'),
('Fissures rue Rainitovo', 'Multiples fissures sur la chaussée', -18.8950, 47.5200, 80.0, 12000000, 1, 1, NULL, '2026-01-19'),
('Réparation terminée Ambohijatovo', 'Travaux de réparation achevés', -18.8820, 47.5100, 45.0, 8000000, 3, 1, 4, '2025-12-15');