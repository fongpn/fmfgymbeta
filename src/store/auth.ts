import { create } from 'zustand';
import { User as ImportedUserType } from '../types';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { getFingerprint } from '../lib/fingerprint'; // Still imported, though getFingerprint() will be commented out

export type AuthUser = ImportedUserType;

// Potentially define a simple Shift interface here if not already available
interface ActiveShiftInfo {
  id: string;
  created_at: string;
  ip_address?: string | null; // Optional: if you want to store/use it in the frontend state
}

// New: Interface for conflicting cashier information
interface ConflictingCashierInfo {
  active_cashier_name: string;
  active_shift_created_at: string;
  active_cashier_ip?: string | null;
}

// Module-level ref to prevent concurrent processing of auth events
const isProcessingAuthEvent = { current: false };

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  activeShift: ActiveShiftInfo | null;
  isStartingShift: boolean;
  conflictingCashierInfo: ConflictingCashierInfo | null; // New state
  deviceAuthStatus: { requestId: number | null, userId: string | null, needsApproval: boolean };
  setUser: (user: AuthUser | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  fetchAndSetUserShiftState: () => Promise<void>;
  startNewShift: () => Promise<string | null>;
  clearActiveShift: () => void;
  clearConflictingCashierInfo: () => void; // New action
  clearDeviceAuthStatus: () => void;
  initializeAuthListener: () => () => void; // Returns unsubscribe function
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  activeShift: null,
  isStartingShift: false,
  conflictingCashierInfo: null, // Initialize new state
  deviceAuthStatus: { requestId: null, userId: null, needsApproval: false },

  setUser: (user) => set({ user, loading: false, conflictingCashierInfo: null }), // Clear conflict on new user set
  clearDeviceAuthStatus: () => set({ deviceAuthStatus: { requestId: null, userId: null, needsApproval: false } }),

  signIn: async (email: string, password: string) => {
    // Ensure conflictingCashierInfo is cleared if login is re-attempted or successful.
    set({ conflictingCashierInfo: null, loading: true }); // Set loading true
    try {
      // First attempt to sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        if (authError.message === 'Invalid login credentials') {
          throw new Error('Invalid login credentials');
        }
        throw authError;
      }

      if (!authData.user) {
        // This case should ideally be covered by authError, but as a safeguard:
        throw new Error('No user data returned from Supabase auth');
      }
      // Successfully initiated sign-in. onAuthStateChange will handle fetching user profile
      // from 'users' table and setting user state + loading to false.

    } catch (error: any) {
      // Ensure loading is false and user is null if signIn itself fails
      set({ user: null, loading: false, conflictingCashierInfo: null });
      throw error;
    }
  },

  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // Clear all relevant states on sign out
      set({ user: null, activeShift: null, conflictingCashierInfo: null, loading: false });
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  },

  resetPassword: async (email: string) => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, active')
        .eq('email', email)
        .single();

      if (userError || !userData) {
        throw new Error('No account found with this email in our system.');
      }

      if (!userData.active) {
        throw new Error('This account has been deactivated. Please contact your administrator.');
      }
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        console.error('Supabase reset password error:', resetError.message);
        throw new Error('Failed to send password reset email. Please try again later or contact support if the issue persists.');
      }
    } catch (error: any) {
      console.error('Error in resetPassword:', error);
      if (error.message.startsWith('No account') || error.message.startsWith('This account') || error.message.startsWith('Failed to send')) {
        throw error;
      }
      throw new Error('An unexpected error occurred during password reset.');
    }
  },

  fetchAndSetUserShiftState: async () => {
    const currentUser = get().user;
    if (!currentUser) {
      set({ activeShift: null, conflictingCashierInfo: null });
      return;
    }
    set({ conflictingCashierInfo: null }); // Clear any previous conflict info

    try {
      const { data: shiftData, error } = await supabase
        .from('shifts')
        .select('id, created_at, ip_address') // Optionally fetch ip_address if you want to display it for resumed shifts
        .eq('user_id', currentUser.id)
        .is('ended_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching active shift:', error);
        toast.error('Could not fetch active shift status.');
        set({ activeShift: null });
        return;
      }

      if (shiftData) {
        set({ activeShift: { id: shiftData.id, created_at: shiftData.created_at, ip_address: shiftData.ip_address } });
      } else {
        set({ activeShift: null });
      }
    } catch (error) {
      console.error('Error in fetchAndSetUserShiftState:', error);
      set({ activeShift: null });
      toast.error('Failed to determine shift state.');
    }
  },

  startNewShift: async (): Promise<string | null> => {
    const currentUser = get().user;
    if (!currentUser || !currentUser.id || !currentUser.role) {
      toast.error('User data or role not available.');
      set({ isStartingShift: false, conflictingCashierInfo: null });
      return null;
    }

    set({ isStartingShift: true, conflictingCashierInfo: null }); // Clear previous conflict

    let userIpAddress: string | null = null;
    try {
      // Fetch IP address using ipify.org
      const response = await fetch('https://api.ipify.org?format=json');
      if (!response.ok) {
        console.warn('Failed to fetch IP address from ipify.org, proceeding without it.');
      } else {
        const data = await response.json();
        userIpAddress = data.ip;
      }
    } catch (ipError) {
      console.warn('Error fetching IP address, proceeding without it:', ipError);
    }

    try {
      const { data: rpcResponse, error: rpcError } = await supabase.rpc(
        'handle_start_shift_attempt',
        {
          p_user_id: currentUser.id,
          p_user_role: currentUser.role,
          p_ip_address: userIpAddress,
        }
      );

      if (rpcError) {
        console.error('Error calling handle_start_shift_attempt RPC:', rpcError);
        toast.error('Server error trying to start or resume shift.');
        set({ isStartingShift: false });
        return null;
      }

      if (!rpcResponse || !rpcResponse.status) {
          console.error('Invalid response from handle_start_shift_attempt RPC:', rpcResponse);
          toast.error('Unexpected server response when starting shift.');
          set({ isStartingShift: false });
          return null;
      }


      switch (rpcResponse.status) {
        case 'another_cashier_active':
          set({
            activeShift: null,
            conflictingCashierInfo: {
              active_cashier_name: rpcResponse.active_cashier_name,
              active_shift_created_at: rpcResponse.active_shift_created_at,
              active_cashier_ip: rpcResponse.active_cashier_ip,
            },
            isStartingShift: false,
          });
          return null;

        case 'existing_shift_resumed':
          set({
            activeShift: {
              id: rpcResponse.shift_id,
              created_at: rpcResponse.created_at,
              ip_address: rpcResponse.ip_address,
            },
            isStartingShift: false,
            conflictingCashierInfo: null,
          });
          toast.success('Resumed existing shift.');
          return rpcResponse.shift_id;

        case 'new_shift_started':
          set({
            activeShift: {
              id: rpcResponse.shift_id,
              created_at: rpcResponse.created_at,
              ip_address: rpcResponse.ip_address,
            },
            isStartingShift: false,
            conflictingCashierInfo: null,
          });
          toast.success('New shift started!');
          return rpcResponse.shift_id;

        case 'error':
            console.error('RPC returned error status:', rpcResponse.message);
            toast.error(`Shift start failed: ${rpcResponse.message || 'Unknown server error'}`);
            set({ isStartingShift: false });
            return null;

        default:
          console.warn('Unhandled RPC response status:', rpcResponse.status, rpcResponse);
          toast.error('Unexpected server response when managing shift.');
          set({ isStartingShift: false });
          return null;
      }
    } catch (error: any) {
      console.error('Error in startNewShift:', error);
      toast.error(error.message || 'Failed to start new shift.');
      set({ isStartingShift: false, conflictingCashierInfo: null });
      return null;
    }
  },

  clearActiveShift: () => set({ activeShift: null }),
  clearConflictingCashierInfo: () => set({ conflictingCashierInfo: null }),

  initializeAuthListener: () => {
    console.log('[AuthStore] INITIALIZE AUTH LISTENER CALLED');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthStore] Auth event RECEIVED:', event, 'Session object:', session, 'isProcessingAlready:', isProcessingAuthEvent.current);

        if (isProcessingAuthEvent.current && event !== 'SIGNED_OUT') {
          console.log('[AuthStore] Auth event IGNORED (already processing another event):', event);
          return;
        }

        isProcessingAuthEvent.current = true;
        console.log('[AuthStore] Auth event STARTED PROCESSING:', event);
        const currentStoreState = get();

        if (currentStoreState.conflictingCashierInfo) {
          set({ conflictingCashierInfo: null });
        }

        if (event === 'SIGNED_IN' && session) {
          console.log('[AuthStore] Attempting explicit supabase.auth.setSession() for SIGNED_IN event with new token.', 'Event:', event);
          console.log('[AuthStore] PRE-AWAIT: About to call supabase.auth.setSession.'); // DETAILED LOGGING
          try {
            const { error: setError } = await supabase.auth.setSession({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            });
            console.log('[AuthStore] POST-AWAIT: supabase.auth.setSession call completed.'); // DETAILED LOGGING
            if (setError) {
              console.error('[AuthStore] Error from explicit supabase.auth.setSession():', setError, 'Event:', event);
            } else {
              console.log('[AuthStore] Explicit supabase.auth.setSession() successful.', 'Event:', event);
            }
          } catch (e) {
            console.error('[AuthStore] CATCH BLOCK: Exception during explicit supabase.auth.setSession():', e, 'Event:', event);
          }
        }

        if (event === 'PASSWORD_RECOVERY') {
          set({ loading: false });
          isProcessingAuthEvent.current = false; // Ensure flag is reset here too
          console.log('[AuthStore] Auth event FINISHED PROCESSING (PASSWORD_RECOVERY):', event);
          return;
        }

        try {
          if (session && session.user) {
            console.log('[AuthStore] Processing session for user ID:', session.user.id, 'Event:', event);

            let initialProcessingForThisUserSignIn = !currentStoreState.user || currentStoreState.user.id !== session.user.id;
            if (initialProcessingForThisUserSignIn || event === 'USER_UPDATED') {
                console.log('[AuthStore] Setting global loading: true (Initial process for this user ID, or USER_UPDATED).');
                set(state => ({ ...state, loading: true }));
            } else if (event === 'SIGNED_IN' && currentStoreState.user && currentStoreState.user.id === session.user.id) {
                 console.log('[AuthStore] SIGNED_IN for existing user (revalidation). Global loading NOT set true here; component loaders will handle UI.');
            }

            console.log('[AuthStore] Entering main try block for profile/device validation.');
            console.log('[AuthStore] PRE-PROFILE FETCH CHECKPOINT. Session user ID:', session?.user?.id);

            const { data: { session: currentInternalSessionObjForLog }, error: getSessionErrorForLog } = await supabase.auth.getSession();
            if (getSessionErrorForLog) {
              console.error('[AuthStore] Error calling supabase.auth.getSession() during log attempt:', getSessionErrorForLog, 'Event:', event);
            } else {
              console.log('[AuthStore] supabase.auth.getSession() token before profile query:', currentInternalSessionObjForLog?.access_token?.substring(0, 20) + '...', 'Event:', event);
            }
            console.log('[AuthStore] Event session token from onAuthStateChange:', session?.access_token?.substring(0, 20) + '...', 'Event:', event);

            let userProfileData: AuthUser | null = null;
            let profileError: any = null;
            const PROFILE_FETCH_TIMEOUT = 60000;

            try {
              console.log('[AuthStore] Profile fetch: Attempting Promise.race. Session User ID:', session?.user?.id, 'Event:', event);
              const profilePromise = supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();

              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Profile fetch timed out')), PROFILE_FETCH_TIMEOUT)
              );

              const result = await Promise.race([profilePromise, timeoutPromise]) as { data: AuthUser | null, error: any | null };
              console.log('[AuthStore] Profile fetch: Promise.race COMPLETED. Session User ID:', session?.user?.id, 'Event:', event);
              userProfileData = result.data;
              profileError = result.error;
            } catch (raceError: any) {
              console.error('[AuthStore] Profile fetch: Promise.race or timeout error:', raceError, 'Event:', event);
              profileError = raceError;
            }

            console.log('[AuthStore] Profile fetch completed. User ID from session for this fetch attempt:', session?.user?.id, 'Error object:', JSON.stringify(profileError, null, 2) , 'Data object:', JSON.stringify(userProfileData, null, 2), 'Event:', event);

            if (profileError || !userProfileData) {
              console.error(
                '[AuthStore] Error fetching user profile (or timeout). Session User ID:',
                session?.user?.id,
                'Full Profile Error:', JSON.stringify(profileError, Object.getOwnPropertyNames(profileError || {}), 2),
                'User Profile Data:', JSON.stringify(userProfileData, null, 2)
              );
              toast.error('Failed to fetch user details. Logging out.');
              supabase.auth.signOut().catch(signOutError => {
                console.error('[AuthStore] Error during signOut after profile fetch failure:', signOutError);
              });
              set({ user: null, loading: false, activeShift: null, deviceAuthStatus: { requestId: null, userId: null, needsApproval: false }, conflictingCashierInfo: null });
              // No return here, let finally block handle isProcessingAuthEvent
            } else if (userProfileData) { // Changed from `if (userProfileData)` to `else if (userProfileData)`
              const fetchedUserObject = userProfileData as AuthUser;
              let newDeviceAuthStatus = { ...currentStoreState.deviceAuthStatus };
              let deviceCheckError = false;

              // --- START OF TEMPORARILY BYPASSED FINGERPRINTING ---
              // TODO: Revisit and re-enable fingerprinting. Temporarily bypassing.
              console.log('[AuthStore] DeviceValidation: TEMPORARILY BYPASSED. Assuming device is approved. Event:', event);
              newDeviceAuthStatus = { requestId: null, userId: null, needsApproval: false };
              deviceCheckError = false; // Ensure this is explicitly false for the bypass

              /*
              // Original Fingerprinting Code - Commented out for now:
              try {
                console.log('[AuthStore] DeviceValidation: Starting... Attempting getFingerprint. Event:', event);
                const fpData = await getFingerprint();
                console.log('[AuthStore] DeviceValidation: getFingerprint COMPLETED. fpData:', fpData, 'Event:', event);

                console.log('[AuthStore] DeviceValidation: Attempting supabase.functions.invoke(\'validate-device\'). Event:', event);
                const { data: validationResponse, error: functionError } = await supabase.functions.invoke('validate-device', {
                  body: {
                    fingerprint: fpData.visitorId,
                    deviceDescription: fpData.deviceDescription
                  },
                });
                console.log('[AuthStore] DeviceValidation: supabase.functions.invoke(\'validate-device\') COMPLETED. Event:', event);
                console.log('[AuthStore] DeviceValidation: invoke completed.');

                if (functionError) {
                  console.error("[AuthStore] DeviceValidation: Error calling function:", functionError);
                  toast.error(`Device validation failed: ${functionError.message}. Please log in again.`);
                  deviceCheckError = true;
                } else if (validationResponse) {
                  console.log('[AuthStore] DeviceValidation: Response received:', validationResponse);
                  if (validationResponse.needsAdminApproval) {
                    newDeviceAuthStatus = {
                      requestId: validationResponse.requestId,
                      userId: fetchedUserObject.id,
                      needsApproval: true,
                    };
                  } else {
                    newDeviceAuthStatus = { requestId: null, userId: null, needsApproval: false };
                  }
                } else {
                  console.error('[AuthStore] DeviceValidation: No error but also no response.');
                  toast.error('Device validation returned an unexpected response.');
                  deviceCheckError = true;
                }
              } catch (deviceValidationError: any) {
                console.error("[AuthStore] DeviceValidation: Exception during process:", deviceValidationError);
                toast.error(deviceValidationError.message || "Critical error during device check. Please log in again.");
                deviceCheckError = true;
              }
              */
              // --- END OF TEMPORARILY BYPASSED FINGERPRINTING ---
              
              console.log('[AuthStore] DeviceValidation: Finished (Bypassed). Error status:', deviceCheckError);

              if (deviceCheckError) {
                await supabase.auth.signOut();
                set({ user: null, loading: false, activeShift: null, deviceAuthStatus: { requestId: null, userId: null, needsApproval: false } });
                // No return here, let finally block handle isProcessingAuthEvent
              } else {
                  const userProfileEssentiallyTheSame = currentStoreState.user && JSON.stringify(currentStoreState.user) === JSON.stringify(fetchedUserObject);
                  const deviceStatusEssentiallyTheSame = JSON.stringify(currentStoreState.deviceAuthStatus) === JSON.stringify(newDeviceAuthStatus);

                  console.log('[AuthStore] Comparison - User Profile Same:', userProfileEssentiallyTheSame, 'Device Status Same:', deviceStatusEssentiallyTheSame);
                  console.log('[AuthStore] Current User ID:', currentStoreState.user?.id, 'Fetched User ID:', fetchedUserObject.id, 'Event:', event);

                  if (currentStoreState.user &&
                      currentStoreState.user.id === fetchedUserObject.id &&
                      userProfileEssentiallyTheSame &&
                      deviceStatusEssentiallyTheSame &&
                      event !== 'USER_UPDATED'
                     ) {
                    console.log('[AuthStore] Data identical (and not USER_UPDATED). Ensuring loading: false.');
                    if (currentStoreState.loading) set({ loading: false });
                    else console.log('[AuthStore] Global loading was already false.');
                  } else {
                    console.log('[AuthStore] Data changed, initial, or USER_UPDATED. Updating user and device status in store, loading:false.');
                    set({
                      user: fetchedUserObject,
                      loading: false,
                      deviceAuthStatus: newDeviceAuthStatus,
                    });
                  }
              }
            }
            // Removed the `else` that was here for "User profile not found" as it's covered by "profileError || !userProfileData"
          } else if (event === 'SIGNED_OUT') {
            console.log('[AuthStore] Event: SIGNED_OUT. Clearing user state.');
            set({ user: null, loading: false, activeShift: null, deviceAuthStatus: { requestId: null, userId: null, needsApproval: false } });
          } else if (event === 'INITIAL_SESSION') {
            console.log('[AuthStore] Event: INITIAL_SESSION');
            if (!session) {
               console.log('[AuthStore] INITIAL_SESSION: No user in session. Setting user=null, loading=false.');
              set({ user: null, loading: false, deviceAuthStatus: { requestId: null, userId: null, needsApproval: false } });
            } else {
               set(state => ({...state, loading: true })); // Keep loading true, wait for SIGNED_IN
               console.log('[AuthStore] INITIAL_SESSION: Session exists. Expecting subsequent SIGNED_IN. Set loading:true.');
            }
          } else {
            console.log('[AuthStore] Unhandled or already covered Auth Event:', event, 'Session:', session, 'Current User:', currentStoreState.user);
            if (!session && !currentStoreState.user && currentStoreState.loading) {
              set({ loading: false });
              console.log('[AuthStore] Unhandled event, no session, no user, was loading. Set loading:false.');
            }
          }
          console.log('[AuthStore] Main try block successfully COMPLETED PROCESSING for event:', event);
        } catch (e: any) {
            console.error('[AuthStore] CATASTROPHIC error in onAuthStateChange try block:', e.message, e.stack, e, 'Event:', event);
            // Try to sign out to clear state, but don't await if it might also hang
            supabase.auth.signOut().catch(err => console.error('[AuthStore] SignOut during catastrophic error failed:', err));
            set({ // Ensure loading is false even in catastrophic error
              user: null,
              loading: false,
              activeShift: null,
              deviceAuthStatus: { requestId: null, userId: null, needsApproval: false },
              conflictingCashierInfo: null
            });
        } finally {
            console.log('[AuthStore] Entering FINALLY block for event:', event, '. isProcessingAuthEvent current value BEFORE reset:', isProcessingAuthEvent.current);
            isProcessingAuthEvent.current = false;
            console.log('[AuthStore] Auth event FINISHED PROCESSING (finally block executed for event):', event, '. isProcessingAuthEvent current value AFTER reset:', isProcessingAuthEvent.current);
        }
      }
    );
    return () => {
      console.log('[AuthStore] UNSUBSCRIBE FROM AUTH LISTENER CALLED');
      subscription.unsubscribe();
    };
  },
}));