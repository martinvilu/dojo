-- 1. Drop policies that depend on courses.teacher_id
DROP POLICY IF EXISTS "Teachers can manage their own courses" ON public.courses;
DROP POLICY IF EXISTS "Teachers can manage roster" ON public.course_roster;
DROP POLICY IF EXISTS "Everyone in course can see assignments" ON public.assignments;
DROP POLICY IF EXISTS "Teachers can manage assignments" ON public.assignments;
DROP POLICY IF EXISTS "Teachers can see submissions for their assignments" ON public.submissions;

-- 2. Now it is safe to drop the column
ALTER TABLE public.courses DROP COLUMN IF EXISTS teacher_id;

-- 3. Add created_by if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='courses' AND column_name='created_by') THEN
        ALTER TABLE public.courses ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- 4. Re-create course_teachers if it doesn't exist (from previous migration)
CREATE TABLE IF NOT EXISTS public.course_teachers (
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    PRIMARY KEY (course_id, teacher_id)
);

-- 5. Enable RLS on course_teachers (safe if already enabled)
ALTER TABLE public.course_teachers ENABLE ROW LEVEL SECURITY;

-- 6. Re-create the updated policies using the new course_teachers structure

-- Policy for courses (Teachers)
CREATE POLICY "Teachers can view assigned courses" ON public.courses
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.course_teachers WHERE course_id = public.courses.id AND teacher_id = auth.uid())
    );

-- Policy for course_roster (Teachers)
CREATE POLICY "Teachers can manage roster" ON public.course_roster
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.course_teachers WHERE course_id = public.course_roster.course_id AND teacher_id = auth.uid())
    );

-- Policy for assignments (General)
CREATE POLICY "Everyone in course can see assignments" ON public.assignments
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.course_teachers WHERE course_id = public.assignments.course_id AND teacher_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.course_roster WHERE course_id = public.assignments.course_id AND (student_id = auth.uid() OR student_email = (SELECT email FROM auth.users WHERE id = auth.uid())))
    );

-- Policy for assignments (Teachers)
CREATE POLICY "Teachers can manage assignments" ON public.assignments
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.course_teachers WHERE course_id = public.assignments.course_id AND teacher_id = auth.uid())
    );

-- Policy for submissions (Teachers)
CREATE POLICY "Teachers can see submissions for their assignments" ON public.submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.assignments 
            JOIN public.course_teachers ON public.assignments.course_id = public.course_teachers.course_id
            WHERE public.assignments.id = public.submissions.assignment_id 
            AND public.course_teachers.teacher_id = auth.uid()
        )
    );

-- Policy for course_teachers (Admins)
DROP POLICY IF EXISTS "Admins can assign teachers" ON public.course_teachers;
CREATE POLICY "Admins can assign teachers" ON public.course_teachers
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
