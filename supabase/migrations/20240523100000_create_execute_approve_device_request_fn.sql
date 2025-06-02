CREATE OR REPLACE FUNCTION public.execute_approve_device_request(
    p_request_id UUID,
    p_admin_id UUID,
    p_admin_notes TEXT,
    p_device_description TEXT,
    p_user_id UUID,
    p_fingerprint TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_authorized_device_id UUID;
    request_details RECORD;
BEGIN
    -- Ensure the request exists and is pending
    SELECT ar.user_id, ar.fingerprint INTO request_details
    FROM public.device_authorization_requests ar
    WHERE ar.id = p_request_id AND ar.status = 'pending'
    FOR UPDATE OF ar; -- Lock the specific row in device_authorization_requests

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Device authorization request % not found or not pending.', p_request_id;
    END IF;

    -- Check if the provided p_user_id and p_fingerprint match the ones from the request
    -- This is an important validation step if these are passed as separate parameters
    IF request_details.user_id IS DISTINCT FROM p_user_id OR request_details.fingerprint IS DISTINCT FROM p_fingerprint THEN
        RAISE EXCEPTION 'Mismatch between provided user/fingerprint and the target request. Request UserID: %, Provided UserID: %, Request Fingerprint: %, Provided Fingerprint: %', 
                        request_details.user_id, p_user_id, request_details.fingerprint, p_fingerprint;
    END IF;

    -- Update the device_authorization_requests table
    UPDATE public.device_authorization_requests
    SET
        status = 'approved',
        reviewed_by = p_admin_id,
        reviewed_at = timezone('utc'::text, now()),
        admin_notes = p_admin_notes
    WHERE id = p_request_id;

    -- Insert into authorized_devices table
    -- Use a CTE to handle potential conflict and return the id
    WITH ins AS (
        INSERT INTO public.authorized_devices (user_id, fingerprint, description, authorized_at, authorized_by, last_used_at)
        VALUES (request_details.user_id, request_details.fingerprint, p_device_description, timezone('utc'::text, now()), p_admin_id, timezone('utc'::text, now()))
        ON CONFLICT (user_id, fingerprint) DO UPDATE
        SET
            description = EXCLUDED.description,
            authorized_at = EXCLUDED.authorized_at, -- Or keep original authorized_at if preferred
            authorized_by = EXCLUDED.authorized_by, -- Or keep original authorized_by
            last_used_at = timezone('utc'::text, now()), -- Always update last_used_at
            updated_at = timezone('utc'::text, now()) -- Ensure updated_at is also set on conflict
        RETURNING id
    )
    SELECT id INTO new_authorized_device_id FROM ins;

    IF new_authorized_device_id IS NULL THEN
        -- This case should ideally not be hit if ON CONFLICT DO UPDATE RETURNING id works as expected.
        -- However, as a fallback, try selecting the existing one if insert didn't return an ID (e.g., due to some race condition if not locked properly, though FOR UPDATE should prevent this).
        SELECT ad.id INTO new_authorized_device_id
        FROM public.authorized_devices ad
        WHERE ad.user_id = request_details.user_id AND ad.fingerprint = request_details.fingerprint;

        IF new_authorized_device_id IS NULL THEN
             RAISE EXCEPTION 'Failed to insert or find the authorized device entry for user_id %, fingerprint %', request_details.user_id, request_details.fingerprint;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'message', 'Device approved and authorized successfully.',
        'requestId', p_request_id,
        'authorizedDeviceId', new_authorized_device_id,
        'userId', request_details.user_id,
        'fingerprint', request_details.fingerprint
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Log the error to the server logs for debugging
        RAISE WARNING 'Error in execute_approve_device_request for request_id %: %', p_request_id, SQLERRM;
        -- Return a JSON object with error information
        RETURN jsonb_build_object(
            'error', SQLERRM,
            'details', 'Failed to process approval for request ID: ' || p_request_id::text
        );
END;
$$;

-- Grant necessary permissions for the function to be callable by Supabase functions invoker role
-- and to operate on the tables.
GRANT EXECUTE ON FUNCTION public.execute_approve_device_request(
    UUID,
    UUID,
    TEXT,
    TEXT,
    UUID,
    TEXT
) TO supabase_functions_user;

-- It's generally better to grant specific permissions to a dedicated role
-- that supabase_functions_user inherits, or directly if simpler for the project.
-- Ensure this role has the necessary permissions on the involved tables.

-- Assuming 'supabase_functions_user' role will be used by the calling Edge Function (via service_role or specific user context for RPC)
-- This role needs SELECT on users to verify admin status if not done prior to calling this SQL function.
-- However, the provided Edge function does admin check BEFORE calling this RPC.

-- Permissions for device_authorization_requests
GRANT SELECT, UPDATE ON TABLE public.device_authorization_requests TO supabase_functions_user;

-- Permissions for authorized_devices
GRANT SELECT, INSERT, UPDATE ON TABLE public.authorized_devices TO supabase_functions_user;

-- If RLS is enabled on these tables, ensure that the 'supabase_functions_user' role
-- (or the role under which this SECURITY DEFINER function executes, which is the owner)
-- has policies that allow these operations, or that RLS is bypassed for these specific operations (e.g. using `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` for the owner within the function, or `SET SESSION ROLE` if appropriate and safe).
-- Since it's SECURITY DEFINER, it runs with the permissions of the user who defined the function (typically a superuser or the table owner).
-- Thus, direct grants to supabase_functions_user might not be strictly necessary for table access *within* this SECURITY DEFINER function,
-- but the EXECUTE grant on the function itself *is* necessary for supabase_functions_user to call it.

-- Verify existing grants to ensure no conflicts or missing privileges.
-- For example, the `users` table is accessed by the Edge Function directly before calling this SQL, so grants there are handled separately. 