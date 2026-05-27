-- Add read_at timestamp to direct_messages
ALTER TABLE public.direct_messages ADD COLUMN read_at TIMESTAMP WITH TIME ZONE;

-- Update RLS to allow updating the read_at column by the receiver
CREATE POLICY "Receivers can update read_at" ON public.direct_messages
    FOR UPDATE USING (auth.uid() = receiver_id)
    WITH CHECK (auth.uid() = receiver_id);
