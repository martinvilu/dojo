-- Class Schedules (Course Plan)
CREATE TABLE public.course_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 1=Monday...
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Class Sessions (Specific instances of a class)
CREATE TABLE public.class_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    otp_secret TEXT NOT NULL, -- Secret to validate dynamic QR
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendance Records
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.class_sessions(id) ON DELETE CASCADE,
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, student_id)
);

-- Enable RLS
ALTER TABLE public.course_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Teachers can manage their course schedules" ON public.course_schedules
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.course_teachers WHERE course_id = public.course_schedules.course_id AND teacher_id = auth.uid())
    );

CREATE POLICY "Students can view schedules for enrolled courses" ON public.course_schedules
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.course_roster WHERE course_id = public.course_schedules.course_id AND student_id = auth.uid())
    );

CREATE POLICY "Teachers can manage sessions" ON public.class_sessions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.course_teachers WHERE course_id = public.class_sessions.course_id AND teacher_id = auth.uid())
    );

CREATE POLICY "Students can view active sessions" ON public.class_sessions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.course_roster WHERE course_id = public.class_sessions.course_id AND student_id = auth.uid())
    );

CREATE POLICY "Students can mark their own attendance" ON public.attendance
    FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Everyone can see their own attendance" ON public.attendance
    FOR SELECT USING (
        student_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM public.class_sessions s
            JOIN public.course_teachers ct ON s.course_id = ct.course_id
            WHERE s.id = public.attendance.session_id AND ct.teacher_id = auth.uid()
        )
    );
