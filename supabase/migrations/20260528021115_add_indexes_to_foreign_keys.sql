-- Performance optimization: Adding indexes to foreign keys to resolve linter warnings (unindexed_foreign_keys)

-- 1. assignments
CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON public.assignments (course_id);

-- 2. attendance
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON public.attendance (student_id);

-- 3. class_sessions
CREATE INDEX IF NOT EXISTS idx_class_sessions_course_id ON public.class_sessions (course_id);

-- 4. course_announcements
CREATE INDEX IF NOT EXISTS idx_course_announcements_author_id ON public.course_announcements (author_id);
CREATE INDEX IF NOT EXISTS idx_course_announcements_course_id ON public.course_announcements (course_id);

-- 5. course_events
CREATE INDEX IF NOT EXISTS idx_course_events_course_id ON public.course_events (course_id);

-- 6. course_plan_items
CREATE INDEX IF NOT EXISTS idx_course_plan_items_course_id ON public.course_plan_items (course_id);

-- 7. course_roster
CREATE INDEX IF NOT EXISTS idx_course_roster_student_id ON public.course_roster (student_id);

-- 8. course_schedules
CREATE INDEX IF NOT EXISTS idx_course_schedules_course_id ON public.course_schedules (course_id);

-- 9. course_teachers
CREATE INDEX IF NOT EXISTS idx_course_teachers_teacher_id ON public.course_teachers (teacher_id);

-- 10. courses
CREATE INDEX IF NOT EXISTS idx_courses_created_by ON public.courses (created_by);

-- 11. direct_messages
CREATE INDEX IF NOT EXISTS idx_direct_messages_course_id ON public.direct_messages (course_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_id ON public.direct_messages (receiver_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_id ON public.direct_messages (sender_id);

-- 12. submissions
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON public.submissions (student_id);
