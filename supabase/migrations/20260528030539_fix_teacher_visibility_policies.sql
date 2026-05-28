-- Fix Teacher visibility for their own assignments in course_teachers
-- This was preventing teachers from seeing their courses in the dashboard.

CREATE POLICY "Teachers can view their own course assignments" ON public.course_teachers
    FOR SELECT USING (teacher_id = (SELECT auth.uid()));

-- Also ensure students can see which teachers are in their courses if needed, 
-- but for now let's focus on the teacher dashboard fix.

-- Update Courses policy to be more secure while allowing teachers and students
DROP POLICY IF EXISTS "User view courses" ON public.courses;
CREATE POLICY "User view courses" ON public.courses
    FOR SELECT USING (
        (get_my_role() = 'admin')
        OR
        EXISTS (
            SELECT 1 FROM public.course_teachers 
            WHERE course_id = public.courses.id AND teacher_id = (SELECT auth.uid())
        ) OR
        EXISTS (
            SELECT 1 FROM public.course_roster 
            WHERE public.course_roster.course_id = public.courses.id 
            AND (
                public.course_roster.student_id = (SELECT auth.uid()) 
                OR 
                public.course_roster.student_email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
            )
        )
    );
