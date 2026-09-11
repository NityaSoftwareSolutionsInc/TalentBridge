-- Search acceleration beyond Prisma B-tree / array GIN.
-- Apply after `prisma db push` (safe to re-run).
-- Requires: CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- People: free-text Candidate Search + global search
CREATE INDEX IF NOT EXISTS people_name_trgm_idx
  ON talentbridge.people USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS people_title_trgm_idx
  ON talentbridge.people USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS people_email_trgm_idx
  ON talentbridge.people USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS people_location_trgm_idx
  ON talentbridge.people USING gin (location gin_trgm_ops);

-- Organizations: global / module search
CREATE INDEX IF NOT EXISTS organizations_name_trgm_idx
  ON talentbridge.organizations USING gin (name gin_trgm_ops);

-- Title index: title contains filters
CREATE INDEX IF NOT EXISTS title_indexes_current_title_trgm_idx
  ON talentbridge.title_indexes USING gin (current_title gin_trgm_ops);

-- Activity timeline search (summary; body is often long — index summary only)
CREATE INDEX IF NOT EXISTS activity_events_summary_trgm_idx
  ON talentbridge.activity_events USING gin (summary gin_trgm_ops);

-- Files global search
CREATE INDEX IF NOT EXISTS files_name_trgm_idx
  ON talentbridge.files USING gin (name gin_trgm_ops);

-- Communications inbox: only open wrap-ups (partial = smaller + faster)
CREATE INDEX IF NOT EXISTS activity_events_open_wrapup_idx
  ON talentbridge.activity_events (tenant_id, created_at DESC)
  WHERE wrap_up IS NULL;

-- Requirements aging dashboard: open reqs ordered by opened_at
CREATE INDEX IF NOT EXISTS requirements_open_opened_at_idx
  ON talentbridge.requirements (tenant_id, opened_at)
  WHERE status = 'open';
