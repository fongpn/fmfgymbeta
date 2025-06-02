import { serve } from "https://deno.land/std@0.218.2/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// console.log("validate-device function starting V3"); // For debugging deployment

async function isDeviceFingerprintingEnabled(supabaseClient: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabaseClient
    .from('settings')
    .select('value')
    .eq('key', 'device_fingerprinting_enabled')
    .single();

  if (error) {
    // If error (e.g., row not found), or if not explicitly true, treat as disabled for safety.
    console.warn("Error fetching device_fingerprinting_enabled setting or setting not found, defaulting to false:", error?.message);
    return false; 
  }
  // Ensure the value is explicitly true
  return data.value === true; 
}

async function getFingerprintRoles(supabaseClient: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabaseClient
    .from('settings')
    .select('value')
    .eq('key', 'fingerprint_roles')
    .single();
  if (error || !data) {
    console.error("Error fetching fingerprint_roles settings from 'settings' table:", error?.message);
    return [];
  }
  const roles = data.value as unknown;
  if (Array.isArray(roles) && roles.every(item => typeof item === 'string')) {
    return roles as string[];
  }
  console.warn("fingerprint_roles setting value is not a valid string array, defaulting to empty.", data.value);
  return [];
}

async function getUserRole(supabaseClient: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await supabaseClient
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();
  if (error || !data) {
    console.error(`Error fetching role for user ${userId}:`, error?.message);
    return null;
  }
  return data.role;
}

async function checkDeviceAuthorization(supabaseClient: SupabaseClient, userId: string, fingerprint: string): Promise<boolean> {
  const { count, error } = await supabaseClient
    .from('authorized_devices')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('fingerprint', fingerprint);

  if (error) {
    console.error(`Error checking authorized_devices for user ${userId}:`, error?.message);
    return false;
  }
  return (count !== null && count > 0);
}

async function createAuthorizationRequest(
  supabaseServiceRoleClient: SupabaseClient, 
  userId: string, 
  fingerprint: string, 
  deviceDescription?: string
): Promise<number | null> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: existingPending, error: existingError } = await supabaseServiceRoleClient
    .from('device_authorization_requests')
    .select('id, requested_at, user_description')
    .eq('user_id', userId)
    .eq('fingerprint', fingerprint)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error("Error checking existing pending requests:", existingError?.message);
  }

  const descriptionToSave = deviceDescription || 'Device details not captured';

  if (existingPending && existingPending.requested_at > tenMinutesAgo) {
    if (descriptionToSave !== existingPending.user_description && 
        (existingPending.user_description === 'Device details not captured' || 
         existingPending.user_description === null || 
         descriptionToSave !== 'Device details not captured')) {
      const { error: updateError } = await supabaseServiceRoleClient
        .from('device_authorization_requests')
        .update({ user_description: descriptionToSave, requested_at: new Date().toISOString() })
        .eq('id', existingPending.id);
      if (updateError) {
        console.warn(`Could not update description for existing request ${existingPending.id}:`, updateError.message);
      }
    }
    return existingPending.id;
  }

  const { data: requestData, error: insertError } = await supabaseServiceRoleClient
    .from('device_authorization_requests')
    .insert({
      user_id: userId,
      fingerprint: fingerprint,
      status: 'pending',
      user_description: descriptionToSave,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error("Error creating device authorization request:", insertError?.message);
    return null;
  }
  return requestData.id;
}

serve(async (req: Request) => {
  // console.log("Handling request V2:", req.method, req.url);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { fingerprint, deviceDescription } = await req.json();
    if (!fingerprint) {
      return new Response(JSON.stringify({ error: "Fingerprint missing" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error("Supabase environment variables not set.");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "User not authenticated" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    const userId = user.id;

    // Check if the entire feature is enabled globally
    const featureEnabled = await isDeviceFingerprintingEnabled(supabaseClient);
    if (!featureEnabled) {
      // console.log("Device fingerprinting feature is globally disabled. Authorizing device.");
      return new Response(JSON.stringify({ authorized: true, needsAdminApproval: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // console.log("Device fingerprinting feature is globally enabled. Proceeding with checks.");

    const requiredRoles = await getFingerprintRoles(supabaseClient);
    const userRole = await getUserRole(supabaseClient, userId);

    if (!userRole) {
      return new Response(JSON.stringify({ error: "Could not retrieve user profile." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (!requiredRoles.includes(userRole)) {
      return new Response(JSON.stringify({ authorized: true, needsAdminApproval: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const isDeviceAuthorized = await checkDeviceAuthorization(supabaseClient, userId, fingerprint);

    if (isDeviceAuthorized) {
      supabaseClient
        .from('authorized_devices')
        .update({ last_used_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('fingerprint', fingerprint)
        .then(({ error: updateError }) => {
          if (updateError) console.error("Error updating last_used_at for authorized device:", updateError?.message);
        });
      return new Response(JSON.stringify({ authorized: true, needsAdminApproval: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      const supabaseServiceRoleClient = createClient(supabaseUrl, supabaseServiceRoleKey);
      const requestId = await createAuthorizationRequest(supabaseServiceRoleClient, userId, fingerprint, deviceDescription);

      if (!requestId) {
        return new Response(JSON.stringify({ error: "Failed to initiate device authorization process." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      return new Response(JSON.stringify({
        authorized: false,
        needsAdminApproval: true,
        requestId: requestId,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
  } catch (error) {
    console.error("Main function error in validate-device:", error.message, error.stack);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 