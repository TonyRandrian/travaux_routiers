-- Mettre à jour les signalements existants qui ont type_reparation à NULL
-- pour leur attribuer la valeur par défaut 0
-- Le niveau est maintenant de 0 à 10
UPDATE signalement 
SET type_reparation = 0 
WHERE type_reparation IS NULL;
