-- Debug Migration: Temporary allow-all for admins to check visibility
-- We'll check against JWT role directly to bypass any get_my_role() issues temporarily
DROP POLICY IF EXISTS "Admin manage courses" ON public.courses;
CREATE POLICY "Admin manage courses" ON public.courses
    FOR ALL USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
        OR 
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    );

-- Also add a generic SELECT policy for all authenticated users for now
-- to see if they can at least see the table content.
-- This will be restricted again once we confirm the issue.
DROP POLICY IF EXISTS "User view courses" ON public.courses;
CREATE POLICY "User view courses" ON public.courses
    FOR SELECT USING (auth.role() = 'authenticated');
