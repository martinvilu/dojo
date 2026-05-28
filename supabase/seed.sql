-- Seed data for Gaula Classroom local testing

-- 1. Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create Users in auth.users with all required fields for GoTrue scanner
-- We also store the role in 'app_metadata' which is server-side managed and safer than 'user_metadata'
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token,
    is_super_admin,
    is_sso_user,
    is_anonymous
)
VALUES 
    (
        '00000000-0000-0000-0000-000000000000',
        '00000000-0000-0000-0000-000000000001', 
        'authenticated',
        'authenticated',
        'admin@gaula.com', 
        crypt('password123', gen_salt('bf')), 
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"],"role":"admin"}', 
        '{"full_name":"System Admin","role":"admin"}', 
        now(), 
        now(),
        '', '', '', '', 
        false, false, false
    ),
    (
        '00000000-0000-0000-0000-000000000000',
        '00000000-0000-0000-0000-000000000002', 
        'authenticated',
        'authenticated',
        'teacher@gaula.com', 
        crypt('password123', gen_salt('bf')), 
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"],"role":"teacher"}', 
        '{"full_name":"Professor Oak","role":"teacher"}', 
        now(), 
        now(),
        '', '', '', '',
        false, false, false
    ),
    (
        '00000000-0000-0000-0000-000000000000',
        '00000000-0000-0000-0000-000000000003', 
        'authenticated',
        'authenticated',
        'student@gaula.com', 
        crypt('password123', gen_salt('bf')), 
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"],"role":"student"}', 
        '{"full_name":"Ash Ketchum","role":"student"}', 
        now(), 
        now(),
        '', '', '', '',
        false, false, false
    )
ON CONFLICT (id) DO UPDATE SET 
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = now(),
    raw_app_meta_data = EXCLUDED.raw_app_meta_data,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

-- 3. Ensure Profiles are correct
INSERT INTO public.profiles (id, role, full_name)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'admin', 'System Admin'),
    ('00000000-0000-0000-0000-000000000002', 'teacher', 'Professor Oak'),
    ('00000000-0000-0000-0000-000000000003', 'student', 'Ash Ketchum')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name;

-- 4. Create a Course
INSERT INTO public.courses (id, name, description, github_org, created_by)
VALUES (
    'c1111111-1111-1111-1111-111111111111', 
    'Computer Science 101', 
    'Introduction to Programming', 
    'gaula-test-org', 
    '00000000-0000-0000-0000-000000000001'
) ON CONFLICT (id) DO NOTHING;

-- 5. Assign Teacher to Course
INSERT INTO public.course_teachers (course_id, teacher_id)
VALUES ('c1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

-- 6. Enroll Student in Course
INSERT INTO public.course_roster (course_id, student_id, student_email)
VALUES ('c1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000003', 'student@gaula.com')
ON CONFLICT (course_id, student_email) DO NOTHING;

-- 7. Create an Assignment
INSERT INTO public.assignments (id, course_id, title, description, template_repo_url)
VALUES (
    'a2222222-2222-2222-2222-222222222222', 
    'c1111111-1111-1111-1111-111111111111', 
    'Lab 1: Hello World', 
    'First coding assignment using JavaScript', 
    'gaula-test-org/js-template'
) ON CONFLICT (id) DO NOTHING;
