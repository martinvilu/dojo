-- Extend user profiles with roles
CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'student');

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'student',
    full_name TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Update courses to allow admins to create and assign teachers
ALTER TABLE public.courses DROP COLUMN teacher_id;
ALTER TABLE public.courses ADD COLUMN created_by UUID REFERENCES auth.users(id);

CREATE TABLE public.course_teachers (
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    PRIMARY KEY (course_id, teacher_id)
);

-- Enable RLS on course_teachers
ALTER TABLE public.course_teachers ENABLE ROW LEVEL SECURITY;

-- Policies for Admins
CREATE POLICY "Admins have full access to courses" ON public.courses
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can assign teachers" ON public.course_teachers
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Update existing policies for teachers to use course_teachers table
DROP POLICY IF EXISTS "Teachers can manage their own courses" ON public.courses;
CREATE POLICY "Teachers can view assigned courses" ON public.courses
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.course_teachers WHERE course_id = public.courses.id AND teacher_id = auth.uid())
    );

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', COALESCE((new.raw_user_meta_data->>'role')::user_role, 'student'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
