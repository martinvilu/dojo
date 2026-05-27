-- Course Content Plan (Class by class details)
CREATE TABLE public.course_plan_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    topic_date DATE NOT NULL,
    recording_url TEXT,
    materials_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Course Events (Exams, holidays, guest lectures, external events)
CREATE TABLE public.course_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    is_external BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.course_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Teachers can manage plan items" ON public.course_plan_items
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.course_teachers WHERE course_id = public.course_plan_items.course_id AND teacher_id = auth.uid())
    );

CREATE POLICY "Students can view plan items" ON public.course_plan_items
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.course_roster WHERE course_id = public.course_plan_items.course_id AND student_id = auth.uid())
    );

CREATE POLICY "Teachers can manage events" ON public.course_events
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.course_teachers WHERE course_id = public.course_events.course_id AND teacher_id = auth.uid())
    );

CREATE POLICY "Students can view events" ON public.course_events
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.course_roster WHERE course_id = public.course_events.course_id AND student_id = auth.uid())
    );
