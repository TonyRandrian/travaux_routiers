ALTER TABLE signalement 
ADD COLUMN IF NOT EXISTS pourcentage_completion DECIMAL(8, 2) DEFAULT 0.00;