-- Add lock_date to assignments
ALTER TABLE public.assignments ADD COLUMN lock_date TIMESTAMP WITH TIME ZONE;

-- Add a column to track if a repo is currently locked
ALTER TABLE public.submissions ADD COLUMN is_locked BOOLEAN DEFAULT false;

-- Policy to ensure students cannot "Submit for review" if the assignment is locked
CREATE OR REPLACE FUNCTION public.is_assignment_locked(assignment_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    l_date TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT lock_date INTO l_date FROM public.assignments WHERE id = assignment_id;
    RETURN l_date IS NOT NULL AND NOW() > l_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update SUBMIT_ASSIGNMENT logic would normally happen in Edge Function,
-- but we can add a database-level check for extra safety if needed.
