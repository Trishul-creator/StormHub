-- StormHub patch: profile, roster, and signup hardening.
-- Run this in Supabase SQL Editor after the existing StormHub patches.

BEGIN;

-- Let club officers/presidents see names in their managed club roster, not just
-- teacher sponsors. This fixes "Unknown user" rows for student club leaders.
DROP POLICY IF EXISTS "profiles_roster_read" ON public.profiles;
CREATE POLICY "profiles_roster_read" ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_memberships m
      WHERE m.user_id = profiles.id
        AND public.can_manage_club(m.club_id)
    )
  );

-- A student who was rejected/banned from a club cannot use a client-side update
-- to set their own membership back to active. Teacher sponsors/admins can still
-- manage the row through can_manage_club_roster/is_admin.
DROP POLICY IF EXISTS "memberships_update_own" ON public.club_memberships;
CREATE POLICY "memberships_update_own" ON public.club_memberships FOR UPDATE
  USING (
    (user_id = auth.uid() AND status <> 'rejected')
    OR can_manage_club_roster(club_id)
    OR is_admin()
  )
  WITH CHECK (
    (
      user_id = auth.uid()
      AND role = 'member'
      AND status IN ('active', 'left')
    )
    OR can_manage_club_roster(club_id)
    OR is_admin()
  );

-- Preserve signup grade metadata when Supabase Auth creates the profile.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  target_school_id UUID;
  raw_grade TEXT;
  parsed_grade INT;
BEGIN
  SELECT id INTO target_school_id
  FROM public.schools
  WHERE slug = 'elkhorn-south'
  LIMIT 1;

  IF target_school_id IS NULL THEN
    INSERT INTO public.schools (name, slug)
    VALUES ('Elkhorn South High School', 'elkhorn-south')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO target_school_id;
  END IF;

  raw_grade := NEW.raw_user_meta_data->>'grade_level';
  IF raw_grade ~ '^[0-9]+$' THEN
    parsed_grade := raw_grade::INT;
  END IF;
  IF parsed_grade NOT BETWEEN 6 AND 12 THEN
    parsed_grade := NULL;
  END IF;

  INSERT INTO public.profiles (
    id, email, full_name, role, school_id, grade_level, created_at, updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email, 'New user'),
    'student',
    target_school_id,
    parsed_grade,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMIT;
