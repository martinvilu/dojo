-- Extend profiles with educational and social data
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS secondary_emails TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS matricula TEXT,
ADD COLUMN IF NOT EXISTS github_username TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Constraints
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_matricula_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_matricula_check CHECK (matricula ~ '^UNRN-[0-9]+$');

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_secondary_emails_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_secondary_emails_check CHECK (array_length(secondary_emails, 1) IS NULL OR array_length(secondary_emails, 1) <= 3);

-- Update the handle_new_user trigger to capture GitHub data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, avatar_url, github_username)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), 
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'student'),
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'user_name'
  )
  ON CONFLICT (id) DO UPDATE SET
    avatar_url = EXCLUDED.avatar_url,
    github_username = EXCLUDED.github_username;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
