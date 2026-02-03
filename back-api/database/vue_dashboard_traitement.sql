CREATE OR REPLACE VIEW v_statistiques_traitement AS
SELECT 
    e.id AS entreprise_id,
    e.nom AS entreprise_nom,

    COUNT(s.id) AS nombre_signalements_termines,

    AVG(
        (sst.date_changement::date - s.date_signalement)
    ) AS delai_moyen_jours,

    MIN(
        (sst.date_changement::date - s.date_signalement)
    ) AS delai_min_jours,

    MAX(
        (sst.date_changement::date - s.date_signalement)
    ) AS delai_max_jours,

    SUM(s.budget) AS budget_total,
    SUM(s.surface_m2) AS surface_totale_m2,

    -- POURCENTAGE
    AVG(s.pourcentage_completion) AS avancement_moyen

FROM signalement s
JOIN entreprise e 
  ON s.id_entreprise = e.id

JOIN LATERAL (
    SELECT sst_inner.date_changement
    FROM signalement_statut sst_inner
    JOIN statut_signalement ss 
      ON ss.id = sst_inner.id_statut_signalement
    WHERE sst_inner.id_signalement = s.id
      AND ss.code = 'TERMINE'
    ORDER BY sst_inner.date_changement DESC
    LIMIT 1
) sst ON TRUE

GROUP BY e.id, e.nom;

