-- Up
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS period_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS traffic_mb integer,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at timestamp without time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone NOT NULL DEFAULT now();

-- Мягкая миграция из старой колонки active → is_active
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='plans' AND column_name='active'
  ) THEN
    UPDATE public.plans SET is_active = COALESCE(active, TRUE)
    WHERE is_active IS DISTINCT FROM COALESCE(active, TRUE);
  END IF;
END $$;

-- Триггер автообновления updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_plans_updated_at') THEN
    CREATE TRIGGER trg_plans_updated_at
    BEFORE UPDATE ON public.plans
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Down
DROP TRIGGER IF EXISTS trg_plans_updated_at ON public.plans;
DROP FUNCTION IF EXISTS public.set_updated_at();
ALTER TABLE public.plans
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS is_active,
  DROP COLUMN IF EXISTS traffic_mb,
  DROP COLUMN IF EXISTS period_days;
