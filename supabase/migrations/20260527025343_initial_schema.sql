-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Courses Table
CREATE TABLE public.courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    github_org TEXT NOT NULL,
    teacher_id UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Roster Table (Students in a course)
CREATE TABLE public.course_roster (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    student_id UUID REFERENCES auth.users(id),
    student_email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(course_id, student_email)
);

-- Assignments Table
CREATE TABLE public.assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    template_repo_url TEXT NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Submissions Table
CREATE TABLE public.submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id UUID REFERENCES auth.users(id) NOT NULL,
    student_repo_url TEXT,
    pr_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'active', 'submitted', 'graded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(assignment_id, student_id)
);

-- Enable RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Policies for courses
CREATE POLICY "Teachers can manage their own courses" ON public.courses
    FOR ALL USING (auth.uid() = teacher_id);

CREATE POLICY "Students can see enrolled courses" ON public.courses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.course_roster 
            WHERE public.course_roster.course_id = public.courses.id 
            AND (public.course_roster.student_id = auth.uid() OR public.course_roster.student_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
        )
    );

-- Policies for course_roster
CREATE POLICY "Teachers can manage roster" ON public.course_roster
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.courses 
            WHERE public.courses.id = public.course_roster.course_id 
            AND public.courses.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Students can see their own roster entry" ON public.course_roster
    FOR SELECT USING (
        student_id = auth.uid() OR student_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- Policies for assignments
CREATE POLICY "Everyone in course can see assignments" ON public.assignments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.courses 
            WHERE public.courses.id = public.assignments.course_id 
            AND (public.courses.teacher_id = auth.uid() OR EXISTS (
                SELECT 1 FROM public.course_roster 
                WHERE public.course_roster.course_id = public.courses.id 
                AND (public.course_roster.student_id = auth.uid() OR public.course_roster.student_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
            ))
        )
    );

CREATE POLICY "Teachers can manage assignments" ON public.assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.courses 
            WHERE public.courses.id = public.assignments.course_id 
            AND public.courses.teacher_id = auth.uid()
        )
    );

-- Policies for submissions
CREATE POLICY "Students can manage their own submissions" ON public.submissions
    FOR ALL USING (auth.uid() = student_id);

CREATE POLICY "Teachers can see submissions for their assignments" ON public.submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.assignments 
            JOIN public.courses ON public.assignments.course_id = public.courses.id
            WHERE public.assignments.id = public.submissions.assignment_id 
            AND public.courses.teacher_id = auth.uid()
        )
    );
