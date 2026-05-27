-- Database Test Script for RLS
-- Run this in the SQL Editor or via a test runner

BEGIN;
-- Setup test users
INSERT INTO auth.users (id, email) VALUES 
('00000000-0000-0000-0000-000000000001', 'teacher@test.com'),
('00000000-0000-0000-0000-000000000002', 'student1@test.com'),
('00000000-0000-0000-0000-000000000003', 'student2@test.com');

-- Setup test course
INSERT INTO public.courses (id, name, github_org, teacher_id) 
VALUES ('c0000000-0000-0000-0000-000000000001', 'Test Course', 'test-org', '00000000-0000-0000-0000-000000000001');

-- Enroll student 1
INSERT INTO public.course_roster (course_id, student_id, student_email)
VALUES ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'student1@test.com');

-- 1. Test: Teacher can see their course
SET ROLE authenticated;
SET auth.uid = '00000000-0000-0000-0000-000000000001';
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM public.courses WHERE id = 'c0000000-0000-0000-0000-000000000001') THEN
        RAISE EXCEPTION 'Teacher should see their own course';
    END IF;
END $$;

-- 2. Test: Enrolled student can see their course
SET auth.uid = '00000000-0000-0000-0000-000000000002';
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM public.courses WHERE id = 'c0000000-0000-0000-0000-000000000001') THEN
        RAISE EXCEPTION 'Enrolled student should see the course';
    END IF;
END $$;

-- 3. Test: Non-enrolled student CANNOT see the course
SET auth.uid = '00000000-0000-0000-0000-000000000003';
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM public.courses WHERE id = 'c0000000-0000-0000-0000-000000000001') THEN
        RAISE EXCEPTION 'Non-enrolled student should NOT see the course';
    END IF;
END $$;

ROLLBACK;
