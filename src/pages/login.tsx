import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuthStore } from '../store/auth';
import { Logo } from '../components/Logo';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { getFingerprint } from '../lib/fingerprint';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isPasswordResetEnabled, setIsPasswordResetEnabled] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const storeSignIn = useAuthStore((state) => state.signIn);
  const user = useAuthStore((state) => state.user);
  const resetPassword = useAuthStore((state) => state.resetPassword);
  const storeSignOut = useAuthStore((state) => state.signOut);

  useEffect(() => {
    if (location.state?.requestId) {
      console.log("[LoginPage] RequestId found in location state, skipping auto-redirect.");
      return;
    }

    if (user && window.location.pathname !== '/waiting-for-approval') {
      console.log("[LoginPage] User is already logged in and no pending requestId, navigating to /", user);
      navigate('/'); 
    }
  }, [user, navigate, location.state]);

  useEffect(() => {
    const fetchPublicSettings = async () => {
      try {
        const { data, error } = await supabase.rpc('get_public_settings');
        if (error) {
          console.error("Error fetching public settings:", error);
          return;
        }
        if (data && typeof data.enable_password_reset === 'boolean') {
          setIsPasswordResetEnabled(data.enable_password_reset);
        } else {
          console.warn("Public settings format unexpected or missing enable_password_reset flag.");
        }
      } catch (error) {
        console.error("Exception fetching public settings:", error);
      }
    };
    fetchPublicSettings();
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    useAuthStore.getState().clearConflictingCashierInfo();
    
    try {
      await storeSignIn(email, password); 
      
      const loggedInUser = useAuthStore.getState().user;
      const deviceStatus = useAuthStore.getState().deviceAuthStatus;

      if (deviceStatus.needsApproval) {
        console.log('[LoginPage] storeSignIn complete, device needs approval. Router will handle navigation.');
        return; 
      }

      if (loggedInUser) {
        const fetchShiftState = useAuthStore.getState().fetchAndSetUserShiftState;
        const startNewShiftAction = useAuthStore.getState().startNewShift;
        let currentShift = useAuthStore.getState().activeShift;

        toast.success('Login successful!');
            
        await fetchShiftState(); 
        currentShift = useAuthStore.getState().activeShift;

        if (!currentShift) {
          await startNewShiftAction();
          currentShift = useAuthStore.getState().activeShift;
          const latestConflictInfo = useAuthStore.getState().conflictingCashierInfo;

          if (latestConflictInfo) {
            const shiftTime = format(new Date(latestConflictInfo.active_shift_created_at), 'p');
            const ipPart = latestConflictInfo.active_cashier_ip ? ` at ${latestConflictInfo.active_cashier_ip}` : '';
            toast.error(
              `Cashier ${latestConflictInfo.active_cashier_name} is currently active${ipPart} since ${shiftTime}. You cannot start a new shift.`,
              { duration: 6000 }
            );
            return; 
          } else if (!currentShift) {
            toast.error("Could not start or resume a shift. Please try logging out and back in, or contact support.", { duration: 5000 });
            await supabase.auth.signOut(); 
            storeSignOut(); 
            return;
          }
        }
        
        if (loggedInUser.role === 'admin' || loggedInUser.role === 'superadmin') {
          navigate('/admin/daily-summary');
        } else {
          navigate('/'); 
        }
      } else {
        console.error('[LoginPage] User not found in store after signIn, and device does not need approval. This is unexpected.');
        toast.error("Login failed: User data not available.");
      }

    } catch (error: any) {
      let errorMessage = 'Error signing in';
      if (error.message === 'Invalid login credentials') {
        errorMessage = 'Invalid email or password';
      } else if (error.message === 'No account found with this email') {
        errorMessage = 'No account found with this email';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Please confirm your email before signing in';
      } else if (error.message.includes('deactivated')) {
        errorMessage = error.message; 
      } else {
        errorMessage = error.message || 'An unexpected error occurred during login.';
      }
      
      toast.error(errorMessage);
      setPassword('');
      if (error.message === 'Invalid login credentials') {
        const passwordInput = document.getElementById('password') as HTMLInputElement;
        if (passwordInput) passwordInput.focus();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!email) {
        toast.error('Please enter your email address');
        setLoading(false);
        return;
      }
      await resetPassword(email);
      toast.success('If an account exists with this email, you will receive a password reset link shortly.');
      setShowForgotPassword(false);
    } catch (error: any) {
      if (error.message.toLowerCase().includes('no account found')) {
        toast.error('No account found with this email. Please check and try again.');
      } else if (error.message.includes('deactivated')) {
        toast.error(error.message);
      } else {
        toast.error(error.message || 'Error sending reset link. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <Logo className="mb-1 h-[130px]" showText={false} size="large" />
          <p className="text-gray-600">Gym Membership System</p>
        </div>

        {!showForgotPassword ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
                autoFocus
                className="mt-1"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
                className="mt-1"
              />
              <div className="mt-1 text-right">
                {isPasswordResetEnabled && (
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-orange-600 hover:text-orange-500"
                    disabled={loading}
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label
                htmlFor="resetEmail"
                className="block text-sm font-medium text-gray-700"
              >
                Email
              </label>
              <Input
                id="resetEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
                autoFocus
                className="mt-1"
              />
            </div>

            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForgotPassword(false)}
                disabled={loading}
              >
                Back to Login
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}