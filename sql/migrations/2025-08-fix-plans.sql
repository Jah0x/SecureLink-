BEGIN;
-- Convert price_cents to price NUMERIC(12,2) in rubles
ALTER TABLE plans RENAME COLUMN price_cents TO price;
ALTER TABLE plans ALTER COLUMN price TYPE NUMERIC(12,2) USING price / 100.0;

-- Rename active flag
ALTER TABLE plans RENAME COLUMN active TO is_active;

-- Add new columns
ALTER TABLE plans ADD COLUMN period_days INTEGER NOT NULL DEFAULT 30;
ALTER TABLE plans ADD COLUMN traffic_mb INTEGER;
ALTER TABLE plans ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE plans ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Promote id to BIGINT
ALTER TABLE plans ALTER COLUMN id TYPE BIGINT;

-- Remove defaults if not needed
ALTER TABLE plans ALTER COLUMN period_days DROP DEFAULT;
COMMIT;
