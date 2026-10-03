-- Stop sign-up from creating admins.
--
-- Run once in the Supabase SQL Editor.
--
-- The trigger that creates a profile for each new user used to copy "role"
-- straight from the sign-up data. That data is written by the person signing
-- up, so calling the sign-up API with role "admin" created an admin account.
--
-- After this change:
--   * a role set in app_metadata (only the service-role key or the dashboard
--     can write it) is trusted as before, so admins are still created from the
--     Supabase dashboard;
--   * a role in user_metadata is accepted only when it is resident, collector
--     or user -- anything else, including admin, becomes "user" (a resident).
--
-- Existing accounts are not changed.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    assigned_role public.user_role;
    trusted_role  TEXT := NEW.raw_app_meta_data->>'role';
    chosen_role   TEXT := lower(NEW.raw_user_meta_data->>'role');
    meta_role     TEXT;
BEGIN
    meta_role := COALESCE(
        trusted_role,
        CASE WHEN chosen_role IN ('resident', 'collector', 'user') THEN chosen_role END,
        'user'
    );

    BEGIN
        assigned_role := meta_role::public.user_role;
    EXCEPTION WHEN invalid_text_representation THEN
        assigned_role := 'user';
    END;

    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        assigned_role
    );

    RETURN NEW;
END;
$function$;
