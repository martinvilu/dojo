-- Seed data for Gaula Classroom local testing

-- 1. Create Profiles for testing
-- Admin
INSERT INTO public.profiles (id, role, full_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin', 'System Admin');

-- Teacher
INSERT INTO public.profiles (id, role, full_name)
VALUES ('00000000-0000-0000-0000-000000000002', 'teacher', 'Professor Oak');

-- Student
INSERT INTO public.profiles (id, role, full_name)
VALUES ('00000000-0000-0000-0000-000000000003', 'student', 'Ash Ketchum');

-- 2. Create a Course
INSERT INTO public.courses (id, name, description, github_org, created_by)
VALUES (
    'c1111111-1111-1111-1111-111111111111', 
    'Computer Science 101', 
    'Introduction to Programming', 
    'gaula-test-org', 
    '00000000-0000-0000-0000-000000000001'
);

-- 3. Assign Teacher to Course
INSERT INTO public.course_teachers (course_id, teacher_id)
VALUES ('c1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002');

-- 4. Enroll Student in Course
INSERT INTO public.course_roster (course_id, student_id, student_email)
VALUES ('c1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000003', 'ash@pallet.com');

-- 5. Create an Assignment
INSERT INTO public.assignments (id, course_id, title, description, template_repo_url)
VALUES (
    'a2222222-2222-2222-2222-222222222222', 
    'c1111111-1111-1111-1111-111111111111', 
    'Lab 1: Hello World', 
    'First coding assignment using JavaScript', 
    'gaula-test-org/js-template'
);
