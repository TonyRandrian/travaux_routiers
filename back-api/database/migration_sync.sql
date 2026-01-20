-- Script de migration pour ajouter les colonnes de synchronisation Firebase
-- À exécuter sur la base de données existante

-- Ajouter les colonnes de synchronisation à la table signalement
ALTER TABLE signalement 
ADD COLUMN IF NOT EXISTS firebase_id VARCHAR(100) UNIQUE,
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP;

-- Créer un index pour optimiser les recherches par firebase_id
CREATE INDEX IF NOT EXISTS idx_signalement_firebase_id ON signalement(firebase_id);

-- Créer un index pour les signalements non synchronisés
CREATE INDEX IF NOT EXISTS idx_signalement_synced_at ON signalement(synced_at);

-- Afficher les colonnes pour vérification
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'signalement' 
ORDER BY ordinal_position;
