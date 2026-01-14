CREATE TABLE role (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL, -- VISITEUR, USER, MANAGER
    libelle VARCHAR(50)
);

CREATE TABLE utilisateur (
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

CREATE TABLE entreprise (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(150) NOT NULL,
    contact VARCHAR(100)
);

CREATE TABLE statut_signalement(
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL, -- NOUVEAU, EN_COURS, TERMINE
    libelle VARCHAR(50)
);

CREATE TABLE signalement (
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
    id_entreprise INT REFERENCES entreprise(id)
);

CREATE TABLE signalement_statut(
    id SERIAL PRIMARY KEY,
    id_signalement INT REFERENCES signalement(id),
    id_statut_signalement INT REFERENCES statut_signalement(id),
    date_changement TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

