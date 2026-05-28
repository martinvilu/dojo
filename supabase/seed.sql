-- Seed data for Gaula Classroom local testing

-- 1. Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create Users in auth.users
-- Password for all: 'password123'
-- Using a simpler INSERT statement to avoid length mismatches
DO $$
DECLARE
    admin_id UUID := '00000000-0000-0000-0000-000000000001';
    teacher_id UUID := '00000000-0000-0000-0000-000000000002';
    student_id UUID := '00000000-0000-0000-0000-000000000003';
BEGIN
    -- Admin
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
    VALUES (admin_id, 'admin@gaula.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","role":"admin"}', '{"full_name":"System Admin","user_name":"gaula-admin"}', 'authenticated', 'authenticated')
    ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password;

    -- Teacher
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
    VALUES (teacher_id, 'teacher@gaula.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","role":"teacher"}', '{"full_name":"Professor Oak","user_name":"prof-oak"}', 'authenticated', 'authenticated')
    ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password;

    -- Student
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
    VALUES (student_id, 'student@gaula.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","role":"student"}', '{"full_name":"Ash Ketchum","user_name":"ash-k"}', 'authenticated', 'authenticated')
    ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password;
END $$;

-- 3. Ensure Profiles are correct
INSERT INTO public.profiles (id, role, full_name, github_username, avatar_url, matricula)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'admin', 'System Admin', 'gaula-admin', 'https://github.com/identicons/admin.png', 'UNRN-0'),
    ('00000000-0000-0000-0000-000000000002', 'teacher', 'Professor Oak', 'prof-oak', 'https://github.com/identicons/oak.png', 'UNRN-1'),
    ('00000000-0000-0000-0000-000000000003', 'student', 'Ash Ketchum', 'ash-k', 'https://github.com/identicons/ash.png', 'UNRN-150')
ON CONFLICT (id) DO UPDATE SET 
    role = EXCLUDED.role, 
    full_name = EXCLUDED.full_name,
    github_username = EXCLUDED.github_username,
    avatar_url = EXCLUDED.avatar_url,
    matricula = EXCLUDED.matricula;

-- 4. Create a Course
INSERT INTO public.courses (id, name, description, github_org, created_by)
VALUES ('c1111111-1111-1111-1111-111111111111', 'Computer Science 101', 'Introduction to Programming', 'gaula-test-org', '00000000-0000-0000-0000-000000000001') ON CONFLICT (id) DO NOTHING;

-- 5. Assign Teacher to Course
INSERT INTO public.course_teachers (course_id, teacher_id)
VALUES ('c1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002') ON CONFLICT DO NOTHING;

-- 6. Enroll Student in Course
INSERT INTO public.course_roster (course_id, student_id, student_email)
VALUES ('c1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000003', 'student@gaula.com') ON CONFLICT (course_id, student_email) DO NOTHING;

-- 7. Create an Assignment
INSERT INTO public.assignments (id, course_id, title, description, template_repo_url)
VALUES ('a2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 'Lab 1: Hello World', 'First coding assignment', 'gaula-test-org/js-template') ON CONFLICT (id) DO NOTHING;
