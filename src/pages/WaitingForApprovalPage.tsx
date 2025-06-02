import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuthStore } from '../store/auth'; 
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { User as AppUser } from '../types'; // Your application's User type

interface LocationState {
  requestId?: number;
  userId?: string;
}

export default function WaitingForApprovalPage() {
  console.log('[WaitingForApprovalPage] COMPONENT RENDERING TOP LEVEL. Path:', window.location.pathname, 'Location state:', useLocation().state);
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [status, setStatus] = useState<'pending' | 'approved' | 'denied' | 'error' | 'loading'>('loading');
  const [requestId, setRequestId] = useState<number | null>(null);

  const storeSignOut = useAuthStore((state) => state.signOut);
  const storeSetUser = useAuthStore((state) => state.setUser);
  const clearDeviceAuthStatus = useAuthStore((state) => state.clearDeviceAuthStatus);

  console.log('[WaitingForApprovalPage] Current status:', status);
  console.log('[WaitingForApprovalPage] Location state:', state);

  useEffect(() => {
    clearDeviceAuthStatus();
    console.log('[WaitingForApprovalPage] Cleared deviceAuthStatus in store.');

    console.log('[WaitingForApprovalPage] useEffect [state, navigate] running. Current state object:', state);
    if (!state?.requestId || !state?.userId) {
      toast.error('Required information missing for Waiting Page. Redirecting to login.');
      console.error('[WaitingForApprovalPage] Missing requestId or userId in location.state. Navigating to /login.', state);
      navigate('/login');
      return;
    }
    setRequestId(state.requestId);
    setStatus('pending'); 
    console.log(`[WaitingForApprovalPage] Now waiting for approval for request ID: ${state.requestId}, User ID: ${state.userId}`);
  }, [state, navigate, clearDeviceAuthStatus]);

  useEffect(() => {
    if (status === 'pending' && requestId) {
      console.log("[WaitingForApprovalPage] Subscribing to Realtime updates for request ID:", requestId);

      const channel = supabase
        .channel(`device_auth_request_${requestId}`)
        .on(
          'postgres_changes',
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'device_authorization_requests', 
            filter: `id=eq.${requestId}` 
          },
          (payload) => {
            console.log('[WaitingForApprovalPage] Realtime Change received!', payload);
            const newStatus = payload.new.status as 'pending' | 'approved' | 'denied';
            if (newStatus === 'approved') {
              console.log('[WaitingForApprovalPage] Status changed to APPROVED via Realtime.');
              setStatus('approved');
              supabase.removeChannel(channel).then(() => console.log('[WaitingForApprovalPage] Removed Realtime channel after approval.'));
            } else if (newStatus === 'denied') {
              console.log('[WaitingForApprovalPage] Status changed to DENIED via Realtime.');
              setStatus('denied');
              supabase.removeChannel(channel).then(() => console.log('[WaitingForApprovalPage] Removed Realtime channel after denial.'));
            }
          }
        )
        .subscribe((subscriptionStatus, err) => {
          if (subscriptionStatus === 'SUBSCRIBED') {
            console.log('[WaitingForApprovalPage] Successfully subscribed to device auth request changes!');
          } else if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT') {
            console.error('[WaitingForApprovalPage] Realtime subscription error:', err);
            toast.error('Connection issue with Realtime. Please refresh or try again later.');
          } else {
            console.log('[WaitingForApprovalPage] Realtime subscription status:', subscriptionStatus);
          }
        });
  
      return () => {
        console.log('[WaitingForApprovalPage] Cleaning up Realtime subscription for request ID:', requestId);
        supabase.removeChannel(channel);
      };
    }
  }, [status, requestId]);

  useEffect(() => {
    const handleApproval = async () => {
      console.log('[WaitingForApprovalPage] handleApproval called.');
      toast.success('Device approval granted! Logging you in...');
      
      const { data: authRefreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !authRefreshData.user) {
        console.error('[WaitingForApprovalPage] Failed to re-authenticate after approval:', refreshError);
        toast.error('Failed to re-authenticate. Please login again.');
        storeSignOut();
        navigate('/login');
        return;
      }
      const supabaseUser = authRefreshData.user;
      console.log('[WaitingForApprovalPage] Supabase user after refresh:', supabaseUser);

      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      if (profileError || !userProfile) {
        console.error('[WaitingForApprovalPage] Failed to fetch user profile after approval:', profileError);
        toast.error('Failed to fetch user details after approval. Please login again.');
        storeSignOut();
        navigate('/login');
        return;
      }
      console.log('[WaitingForApprovalPage] Fetched user profile:', userProfile);
      
      storeSetUser(userProfile as AppUser);
      console.log('[WaitingForApprovalPage] User set in store. Navigating to /.');
      navigate('/'); 
    };

    if (status === 'approved') {
      console.log('[WaitingForApprovalPage] Status is APPROVED, calling handleApproval.');
      handleApproval();
    }
  }, [status, navigate, storeSignOut, storeSetUser]);

  const handleLogout = async () => {
    console.log('[WaitingForApprovalPage] handleLogout called.');
    await supabase.auth.signOut();
    storeSignOut();
    navigate('/login');
  };

  if (status === 'loading') {
    console.log('[WaitingForApprovalPage] Rendering: Loading state');
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-orange-600 mb-4" />
        <p className="text-xl font-semibold text-gray-700">Loading...</p>
      </div>
    );
  }
  
  if (status === 'denied') {
    console.log('[WaitingForApprovalPage] Rendering: Denied state');
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 text-center">
        <h1 className="text-3xl font-bold text-red-600 mb-4">Device Authorization Denied</h1>
        <p className="text-gray-700 mb-6">Your request to authorize this device has been denied by an administrator.</p>
        <p className="text-gray-600 mb-8">Please contact support or try logging in from an authorized device.</p>
        <Button onClick={handleLogout} variant="outline">
          Back to Login
        </Button>
      </div>
    );
  }

  // This will be the UI for status === 'pending' or status === 'error' (if not handled explicitly)
  // or status === 'approved' before navigation kicks in
  console.log('[WaitingForApprovalPage] Rendering: Default/Pending state UI for status:', status);
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 text-center">
      <div className="bg-white p-8 rounded-xl shadow-2xl max-w-lg w-full">
        <Loader2 className="h-16 w-16 animate-spin text-orange-500 mb-6 mx-auto" />
        <h1 className="text-3xl font-bold text-gray-800 mb-3">Device Awaiting Approval</h1>
        <p className="text-xl text-orange-600 font-semibold mb-6">This device is not yet authorized for your account.</p>
        
        <p className="text-gray-600 mb-4">
          An administrator has been notified and needs to approve this device before you can proceed.
        </p>
        <p className="text-gray-600 mb-8">
          This page will automatically update once your device status changes. If you need to expedite this, please contact your administrator with the Request ID below.
        </p>
        
        <div className="bg-gray-50 p-3 rounded-md mb-8">
          <p className="text-sm text-gray-500">Your Request ID:</p>
          <p className="text-lg font-semibold text-gray-700">{requestId || 'N/A'}</p>
        </div>

        <Button onClick={handleLogout} variant="outline" className="w-full sm:w-auto">
          Cancel and Logout
        </Button>
      </div>
    </div>
  );
} 