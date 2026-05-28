-- Security Fix: Resolve insecure usage of user_metadata in RLS policies (rls_references_user_metadata)
-- End users can edit user_metadata, so it must not be used for security checks.

-- 1. Create a secure helper function to get the current user's role
-- Using SECURITY DEFINER avoids infinite recursion in RLS policies
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role AS $$
BEGIN
  RETURN (
    SELECT role FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Update Profiles policies
DROP POLICY IF EXISTS "View profiles" ON public.profiles;
CREATE POLICY "View profiles" ON public.profiles
    FOR SELECT USING (
        (id = (SELECT auth.uid())) 
        OR 
        (get_my_role() = 'admin')
    );

-- 3. Update Course Teachers policies
DROP POLICY IF EXISTS "Manage course teachers" ON public.course_teachers;
CREATE POLICY "Manage course teachers" ON public.course_teachers
    FOR ALL USING (
        (get_my_role() = 'admin')
    );

-- 4. Update Courses policies
DROP POLICY IF EXISTS "Admin manage courses" ON public.courses;
CREATE POLICY "Admin manage courses" ON public.courses
    FOR ALL USING (
        (get_my_role() = 'admin')
    );

-- Extra safety: Ensure app_metadata is also used as a backup if available
-- but the security definer function above is the primary fix for the linter.
