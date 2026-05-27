-- Update submissions table with more detailed statuses and timestamps
-- Statuses: 
-- ✅ OK
-- ⚠️ Correcciones
-- 🔆 Sin Corregir
-- ❌ Rehacer
-- ⭕ Sin entregar
-- 🚫 Sin comenzar

-- First, drop the existing check constraint on status
ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_status_check;

-- Add new timestamps
ALTER TABLE public.submissions ADD COLUMN last_commit_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.submissions ADD COLUMN submitted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.submissions ADD COLUMN corrected_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.submissions ADD COLUMN feedback_message TEXT;

-- Update status constraint with new values
ALTER TABLE public.submissions ADD CONSTRAINT submissions_status_check 
CHECK (status IN ('sin_comenzar', 'sin_entregar', 'sin_corregir', 'ok', 'correcciones', 'rehacer', 'accepted', 'submitted'));

-- Default status for new submissions is 'sin_comenzar'
ALTER TABLE public.submissions ALTER COLUMN status SET DEFAULT 'sin_comenzar';

-- Ensure all current records are consistent
UPDATE public.submissions SET status = 'sin_comenzar' WHERE status IS NULL;
