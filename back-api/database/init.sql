-- Script d'initialisation automatique de la base de données
-- Ce script sera exécuté automatiquement lors du premier démarrage de PostgreSQL

-- Script principal de création des tables et données initiales
\i /docker-entrypoint-initdb.d/combined_script.sql

-- Ajout du champ pourcentage
\i /docker-entrypoint-initdb.d/add_pourcentage_to_signalement.sql

-- Migration pour la synchronisation
\i /docker-entrypoint-initdb.d/migration_sync.sql

-- Vue pour les statistiques de traitement (dashboard)
\i /docker-entrypoint-initdb.d/vue_dashboard_traitement.sql
