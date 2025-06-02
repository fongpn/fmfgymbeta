import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Replace with your app's domain for production
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("Edge Function: update-user-password-admin invoked."); // Log invocation
    const requestBody = await req.json();
    console.log("Edge Function: Received request body:", JSON.stringify(requestBody)); // Log the received body

    const { user_id, new_password } = requestBody; // Destructure from the logged body

    if (!user_id || !new_password) {
      console.error("Edge Function: Missing user_id or new_password. Body:", JSON.stringify(requestBody));
      return new Response(JSON.stringify({ error: 'Missing user_id or new_password' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
    
    // Ensure password meets minimum length (example: 6 characters)
    // Supabase Auth has its own length requirements, but good to check here too.
    if (new_password.length < 6) {
        console.error("Edge Function: Password too short. Length:", new_password.length);
        return new Response(JSON.stringify({ error: 'Password must be at least 6 characters long' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }

    console.log(`Edge Function: Attempting to update password for user_id: ${user_id}`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { password: new_password }
    )

    if (error) {
      console.error('Edge Function: Error updating user password via Supabase admin:', error);
      return new Response(JSON.stringify({ error: error.message || 'Failed to update password' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    console.log("Edge Function: Password updated successfully for user_id:", user_id);
    return new Response(JSON.stringify({ message: 'Password updated successfully', user: data.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    console.error('Edge Function: Unhandled error:', e);
    console.error("Edge Function: Request method during error:", req.method);
    // Attempt to get more details if it's an error from req.json()
    if (e instanceof SyntaxError && req.body) {
        try {
            const rawBody = await req.text(); // Deno specific way to get raw body as text
            console.error("Edge Function: Raw request body that caused SyntaxError:", rawBody);
        } catch (readError) {
            console.error("Edge Function: Could not read raw body after SyntaxError:", readError);
        }
    }
    return new Response(JSON.stringify({ error: e.message || 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}) 