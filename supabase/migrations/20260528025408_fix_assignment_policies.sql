-- Update Assignment policies to include Admins and improve performance
DROP POLICY IF EXISTS "Teacher manage assignments" ON public.assignments;

CREATE POLICY "Manage assignments" ON public.assignments
    FOR ALL USING (
        (get_my_role() = 'admin')
        OR
        EXISTS (
            SELECT 1 FROM public.course_teachers 
            WHERE course_id = public.assignments.course_id AND teacher_id = (SELECT auth.uid())
        )
    );
