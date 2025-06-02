import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'

console.log('Deny device request function booting up...')

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { requestId, adminNotes } = await request.json()

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
      console.error('Error fetching user for deny operation:', userError)
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
      console.error('Error fetching admin profile for deny:', adminProfileError)
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

    // Fetch the device authorization request to ensure it's still pending
    const { data: requestDetails, error: fetchError } = await supabaseClient
      .from('device_authorization_requests')
      .select('status')
      .eq('id', requestId)
      .single()

    if (fetchError) {
      console.error('Error fetching device request for denial:', fetchError)
      return new Response(JSON.stringify({ error: 'Device authorization request not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    if (requestDetails.status !== 'pending') {
      return new Response(JSON.stringify({ error: `Request is not pending, current status: ${requestDetails.status}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400, // Bad request, action no longer valid
      })
    }

    // Update the device_authorization_requests table
    const { error: updateError } = await supabaseClient
      .from('device_authorization_requests')
      .update({
        status: 'denied',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        admin_notes: adminNotes || 'Denied by admin function.',
      })
      .eq('id', requestId)

    if (updateError) {
      console.error('Error updating device request to denied:', updateError)
      return new Response(JSON.stringify({ error: 'Failed to deny device request' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    return new Response(JSON.stringify({ message: 'Device request denied successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Unexpected error in deny-device-request:', error)
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}
