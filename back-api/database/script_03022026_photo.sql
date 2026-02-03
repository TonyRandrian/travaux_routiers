-- Script de migration pour ajouter la gestion des photos aux signalements
-- Date: 03/02/2026
-- Description: Ajout de la table photo_signalement pour stocker les URLs des photos

-- ============================================
-- TABLE: photo_signalement
-- Stocke les URLs des photos uploadées sur Firebase Storage
-- ============================================
CREATE TABLE IF NOT EXISTS photo_signalement (
    id SERIAL PRIMARY KEY,
    id_signalement INT NOT NULL REFERENCES signalement(id) ON DELETE CASCADE,
    url TEXT NOT NULL,                          -- URL Firebase Storage
    firebase_path TEXT,                         -- Chemin dans Firebase Storage (ex: signalements/{id}/photo_1.jpg)
    nom_fichier VARCHAR(255),                   -- Nom original du fichier
    taille_bytes INT,                           -- Taille du fichier en bytes
    mime_type VARCHAR(50) DEFAULT 'image/jpeg', -- Type MIME (image/jpeg, image/png, etc.)
    ordre INT DEFAULT 0,                        -- Ordre d'affichage de la photo
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP                         -- Timestamp de synchronisation depuis Firebase
);

-- Index pour optimiser les recherches par signalement
CREATE INDEX IF NOT EXISTS idx_photo_signalement_id_signalement ON photo_signalement(id_signalement);

-- Index pour les photos non synchronisées
CREATE INDEX IF NOT EXISTS idx_photo_signalement_synced_at ON photo_signalement(synced_at);

-- ============================================
-- COMMENTAIRES
-- ============================================
COMMENT ON TABLE photo_signalement IS 'Table des photos associées aux signalements';
COMMENT ON COLUMN photo_signalement.url IS 'URL publique de la photo sur Firebase Storage';
COMMENT ON COLUMN photo_signalement.firebase_path IS 'Chemin complet du fichier dans Firebase Storage';
COMMENT ON COLUMN photo_signalement.nom_fichier IS 'Nom original du fichier uploadé';
COMMENT ON COLUMN photo_signalement.taille_bytes IS 'Taille du fichier en bytes';
COMMENT ON COLUMN photo_signalement.ordre IS 'Ordre d affichage (0 = première photo, 1 = deuxième, etc.)';
