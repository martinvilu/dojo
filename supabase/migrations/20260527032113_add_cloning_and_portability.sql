-- Function to clone a course structure to a new course
CREATE OR REPLACE FUNCTION public.clone_course_structure(source_course_id UUID, target_course_id UUID)
RETURNS void AS $$
BEGIN
    -- Clone Assignments
    INSERT INTO public.assignments (course_id, title, description, template_repo_url)
    SELECT target_course_id, title, description, template_repo_url
    FROM public.assignments WHERE course_id = source_course_id;

    -- Clone Schedules
    INSERT INTO public.course_schedules (course_id, day_of_week, start_time, end_time)
    SELECT target_course_id, day_of_week, start_time, end_time
    FROM public.course_schedules WHERE course_id = source_course_id;

    -- Clone Curriculum Items
    INSERT INTO public.course_plan_items (course_id, title, description, topic_date, recording_url, materials_url)
    SELECT target_course_id, title, description, topic_date, recording_url, materials_url
    FROM public.course_plan_items WHERE course_id = source_course_id;

    -- Clone Events
    INSERT INTO public.course_events (course_id, title, description, event_date, is_external)
    SELECT target_course_id, title, description, event_date, is_external
    FROM public.course_events WHERE course_id = source_course_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
