-- TalentBridge DB bootstrap (local / docker init)
CREATE SCHEMA IF NOT EXISTS talentbridge;
GRANT ALL ON SCHEMA talentbridge TO talentbridge;

-- Required for ILIKE '%…%' search acceleration (People / Organizations / Activity)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
