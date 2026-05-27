-- Course Announcements (General Communication)
CREATE TABLE public.course_announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    author_id UUID REFERENCES auth.users(id) NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Direct Messages (Specific Communication)
CREATE TABLE public.direct_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) NOT NULL,
    receiver_id UUID REFERENCES auth.users(id) NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.course_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Policies for Announcements
CREATE POLICY "Everyone in course can view announcements" ON public.course_announcements
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.course_roster WHERE course_id = public.course_announcements.course_id AND student_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.course_teachers WHERE course_id = public.course_announcements.course_id AND teacher_id = auth.uid())
    );

CREATE POLICY "Teachers can manage announcements" ON public.course_announcements
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.course_teachers WHERE course_id = public.course_announcements.course_id AND teacher_id = auth.uid())
    );

-- Policies for Direct Messages
CREATE POLICY "Users can view their own messages" ON public.direct_messages
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages" ON public.direct_messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Receivers can mark as read" ON public.direct_messages
    FOR UPDATE USING (auth.uid() = receiver_id);
