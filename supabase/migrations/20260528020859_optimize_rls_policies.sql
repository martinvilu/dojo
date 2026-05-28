-- Optimization of RLS policies to resolve performance warnings (auth_rls_initplan)
-- and multiple permissive policies warnings.

-- 1. Profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "View profiles" ON public.profiles
    FOR SELECT USING (
        (id = (SELECT auth.uid())) 
        OR 
        (((SELECT auth.jwt()) -> 'user_metadata' ->> 'role') = 'admin')
    );

-- 2. Course Teachers (Only admins can manage, teachers see their own assignments)
DROP POLICY IF EXISTS "Admins can assign teachers" ON public.course_teachers;
CREATE POLICY "Manage course teachers" ON public.course_teachers
    FOR ALL USING (
        ((SELECT auth.jwt()) -> 'user_metadata' ->> 'role') = 'admin'
    );

-- 3. Courses
DROP POLICY IF EXISTS "Admins have full access to courses" ON public.courses;
DROP POLICY IF EXISTS "Students can see enrolled courses" ON public.courses;
DROP POLICY IF EXISTS "Teachers can view assigned courses" ON public.courses;

CREATE POLICY "Admin manage courses" ON public.courses
    FOR ALL USING (
        ((SELECT auth.jwt()) -> 'user_metadata' ->> 'role') = 'admin'
    );

CREATE POLICY "User view courses" ON public.courses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.course_teachers 
            WHERE course_id = public.courses.id AND teacher_id = (SELECT auth.uid())
        ) OR
        EXISTS (
            SELECT 1 FROM public.course_roster 
            WHERE public.course_roster.course_id = public.courses.id 
            AND (
                public.course_roster.student_id = (SELECT auth.uid()) 
                OR 
                public.course_roster.student_email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
            )
        )
    );

-- 4. Course Roster
DROP POLICY IF EXISTS "Teachers can manage roster" ON public.course_roster;
DROP POLICY IF EXISTS "Students can see their own roster entry" ON public.course_roster;

CREATE POLICY "Teacher manage roster" ON public.course_roster
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.course_teachers 
            WHERE course_id = public.course_roster.course_id AND teacher_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Student view roster" ON public.course_roster
    FOR SELECT USING (
        student_id = (SELECT auth.uid()) 
        OR 
        student_email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
    );

-- 5. Assignments
DROP POLICY IF EXISTS "Teachers can manage assignments" ON public.assignments;
DROP POLICY IF EXISTS "Everyone in course can see assignments" ON public.assignments;

CREATE POLICY "Teacher manage assignments" ON public.assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.course_teachers 
            WHERE course_id = public.assignments.course_id AND teacher_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "User view assignments" ON public.assignments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.course_roster 
            WHERE course_id = public.assignments.course_id 
            AND (
                student_id = (SELECT auth.uid()) 
                OR 
                student_email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
            )
        )
    );

-- 6. Course Schedules
DROP POLICY IF EXISTS "Teachers can manage their course schedules" ON public.course_schedules;
DROP POLICY IF EXISTS "Students can view schedules for enrolled courses" ON public.course_schedules;

CREATE POLICY "Teacher manage schedules" ON public.course_schedules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.course_teachers 
            WHERE course_id = public.course_schedules.course_id AND teacher_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Student view schedules" ON public.course_schedules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.course_roster 
            WHERE course_id = public.course_schedules.course_id AND student_id = (SELECT auth.uid())
        )
    );

-- 7. Class Sessions
DROP POLICY IF EXISTS "Teachers can manage sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Students can view active sessions" ON public.class_sessions;

CREATE POLICY "Teacher manage sessions" ON public.class_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.course_teachers 
            WHERE course_id = public.class_sessions.course_id AND teacher_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Student view sessions" ON public.class_sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.course_roster 
            WHERE course_id = public.class_sessions.course_id AND student_id = (SELECT auth.uid())
        )
    );

-- 8. Attendance
DROP POLICY IF EXISTS "Everyone can see their own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Students can mark their own attendance" ON public.attendance;

CREATE POLICY "Teacher view attendance" ON public.attendance
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.class_sessions s
            JOIN public.course_teachers ct ON s.course_id = ct.course_id
            WHERE s.id = public.attendance.session_id AND ct.teacher_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Student manage attendance" ON public.attendance
    FOR ALL USING (student_id = (SELECT auth.uid()));

-- 9. Course Plan Items
DROP POLICY IF EXISTS "Teachers can manage plan items" ON public.course_plan_items;
DROP POLICY IF EXISTS "Students can view plan items" ON public.course_plan_items;

CREATE POLICY "Teacher manage plan items" ON public.course_plan_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.course_teachers 
            WHERE course_id = public.course_plan_items.course_id AND teacher_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Student view plan items" ON public.course_plan_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.course_roster 
            WHERE course_id = public.course_plan_items.course_id AND student_id = (SELECT auth.uid())
        )
    );

-- 10. Course Events
DROP POLICY IF EXISTS "Teachers can manage events" ON public.course_events;
DROP POLICY IF EXISTS "Students can view events" ON public.course_events;

CREATE POLICY "Teacher manage events" ON public.course_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.course_teachers 
            WHERE course_id = public.course_events.course_id AND teacher_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Student view events" ON public.course_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.course_roster 
            WHERE course_id = public.course_events.course_id AND student_id = (SELECT auth.uid())
        )
    );

-- 11. Submissions
DROP POLICY IF EXISTS "Teachers can see submissions for their assignments" ON public.submissions;
DROP POLICY IF EXISTS "Students can manage their own submissions" ON public.submissions;

CREATE POLICY "Teacher view submissions" ON public.submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.assignments 
            JOIN public.course_teachers ON public.assignments.course_id = public.course_teachers.course_id
            WHERE public.assignments.id = public.submissions.assignment_id 
            AND public.course_teachers.teacher_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Student manage submissions" ON public.submissions
    FOR ALL USING (student_id = (SELECT auth.uid()));

-- 12. Course Announcements
DROP POLICY IF EXISTS "Teachers can manage announcements" ON public.course_announcements;
DROP POLICY IF EXISTS "Everyone in course can view announcements" ON public.course_announcements;

CREATE POLICY "Teacher manage announcements" ON public.course_announcements
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.course_teachers 
            WHERE course_id = public.course_announcements.course_id AND teacher_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Student view announcements" ON public.course_announcements
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.course_roster 
            WHERE course_id = public.course_announcements.course_id AND student_id = (SELECT auth.uid())
        )
    );

-- 13. Direct Messages
DROP POLICY IF EXISTS "Receivers can mark as read" ON public.direct_messages;
DROP POLICY IF EXISTS "Receivers can update read_at" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can view their own messages" ON public.direct_messages;

CREATE POLICY "User manage own messages" ON public.direct_messages
    FOR ALL USING (
        (sender_id = (SELECT auth.uid())) 
        OR 
        (receiver_id = (SELECT auth.uid()))
    );

-- Grant select on auth.users for RLS evaluation (required if not already done)
GRANT SELECT ON auth.users TO authenticated;
