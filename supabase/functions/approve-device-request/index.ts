import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'

console.log('Approve device request function booting up...')

// Standard Supabase Edge Function structure
addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      // Supabase API URL - env var applied automatically by Supabase
      Deno.env.get('SUPABASE_URL') ?? '',
      // Supabase Service Role Key - env var applied automatically by Supabase
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { requestId, deviceDescription } = await request.json()

    if (!requestId) {
      return new Response(JSON.stringify({ error: 'Request ID is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }
    const token = authHeader.replace('Bearer ', '')

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError || !user) {
      console.error('Error fetching user:', userError)
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { data: adminProfile, error: adminProfileError } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (adminProfileError || !adminProfile) {
      console.error('Error fetching admin profile:', adminProfileError)
      return new Response(JSON.stringify({ error: 'Could not retrieve admin profile' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    if (adminProfile.role !== 'admin' && adminProfile.role !== 'superadmin') {
      return new Response(JSON.stringify({ error: 'Unauthorized: Admin access required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const { data: requestDetails, error: requestError } = await supabaseClient
      .from('device_authorization_requests')
      .select('user_id, fingerprint, status')
      .eq('id', requestId)
      .single()

    if (requestError) {
      console.error('Error fetching device request:', requestError)
      return new Response(JSON.stringify({ error: 'Device authorization request not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    if (requestDetails.status !== 'pending') {
      return new Response(JSON.stringify({ error: `Request is not pending, current status: ${requestDetails.status}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Call the database function to handle the transaction
    const { data, error: rpcError } = await supabaseClient.rpc('execute_approve_device_request', {
      p_request_id: requestId,
      p_admin_id: user.id,
      p_admin_notes: 'Approved via admin function.', // Consider making this configurable
      p_device_description: deviceDescription || 'N/A',
      p_user_id: requestDetails.user_id, // Pass user_id from the fetched request
      p_fingerprint: requestDetails.fingerprint, // Pass fingerprint from the fetched request
    })

    if (rpcError) {
      console.error('RPC error in approve-device-request:', rpcError)
      // Check if the RPC error has a more specific message, e.g., from the RAISE EXCEPTION in PL/pgSQL
      const errorMessage = rpcError.details || rpcError.message || 'Failed to approve device.'
      return new Response(JSON.stringify({ error: errorMessage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    return new Response(JSON.stringify({ message: 'Device approved successfully', data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Unexpected error in approve-device-request:', error)
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}

/*
Database function (PostgreSQL) to handle the transaction:

CREATE OR REPLACE FUNCTION execute_approve_device_request(
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
    SELECT user_id, fingerprint INTO request_details
    FROM public.device_authorization_requests
    WHERE id = p_request_id AND status = 'pending'
    FOR UPDATE; -- Lock the row

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Device authorization request not found or not pending.';
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
            authorized_at = EXCLUDED.authorized_at,
            authorized_by = EXCLUDED.authorized_by,
            last_used_at = EXCLUDED.last_used_at,
            updated_at = timezone('utc'::text, now()) -- Ensure updated_at is also set on conflict
        RETURNING id
    )
    SELECT id INTO new_authorized_device_id FROM ins;

    IF new_authorized_device_id IS NULL THEN
        -- This case should ideally not be hit if ON CONFLICT DO UPDATE RETURNING id works as expected.
        -- However, as a fallback, try selecting the existing one if insert didn't return an ID.
        SELECT id INTO new_authorized_device_id
        FROM public.authorized_devices
        WHERE user_id = request_details.user_id AND fingerprint = request_details.fingerprint;

        IF new_authorized_device_id IS NULL THEN
             RAISE EXCEPTION 'Failed to insert or find the authorized device entry.';
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'message', 'Device approved and authorized successfully.',
        'requestId', p_request_id,
        'authorizedDeviceId', new_authorized_device_id
    );

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in execute_approve_device_request: %', SQLERRM;
        RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

Grant execute on function public.execute_approve_device_request to supabase_functions_user;
Grant select on public.users to supabase_functions_user; -- If not already granted for role checks
Grant select, update on public.device_authorization_requests to supabase_functions_user;
Grant select, insert, update on public.authorized_devices to supabase_functions_user;

-- To deploy this SQL:
-- 1. Save it as a .sql file in your supabase/migrations/ directory.
-- 2. Run 'supabase db push' (if using local dev) or apply through Supabase dashboard.
*/