-- Refactor Foreign Keys to reference public.profiles(id) instead of auth.users(id)
-- This makes joining tables in the Supabase Client much easier and more intuitive.

-- 1. course_teachers
ALTER TABLE public.course_teachers DROP CONSTRAINT IF EXISTS course_teachers_teacher_id_fkey;
ALTER TABLE public.course_teachers ADD CONSTRAINT course_teachers_teacher_id_fkey 
    FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. courses (created_by)
ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_created_by_fkey;
ALTER TABLE public.courses ADD CONSTRAINT courses_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. course_roster (student_id)
ALTER TABLE public.course_roster DROP CONSTRAINT IF EXISTS course_roster_student_id_fkey;
ALTER TABLE public.course_roster ADD CONSTRAINT course_roster_student_id_fkey 
    FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4. submissions (student_id)
ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_student_id_fkey;
ALTER TABLE public.submissions ADD CONSTRAINT submissions_student_id_fkey 
    FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 5. attendance (student_id)
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_student_id_fkey;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_student_id_fkey 
    FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 6. direct_messages (sender_id and receiver_id)
ALTER TABLE public.direct_messages DROP CONSTRAINT IF EXISTS direct_messages_sender_id_fkey;
ALTER TABLE public.direct_messages ADD CONSTRAINT direct_messages_sender_id_fkey 
    FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.direct_messages DROP CONSTRAINT IF EXISTS direct_messages_receiver_id_fkey;
ALTER TABLE public.direct_messages ADD CONSTRAINT direct_messages_receiver_id_fkey 
    FOREIGN KEY (receiver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 7. course_announcements (author_id)
ALTER TABLE public.course_announcements DROP CONSTRAINT IF EXISTS course_announcements_author_id_fkey;
ALTER TABLE public.course_announcements ADD CONSTRAINT course_announcements_author_id_fkey 
    FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
