ALTER TABLE signalement
    ADD COLUMN IF NOT EXISTS type_reparation INTEGER DEFAULT 1;  -- syntaxe correcte : ALTER TABLE + ADD COLUMN