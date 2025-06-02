import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LoginPage from './pages/login';
import DashboardLayout from './layouts/DashboardLayout';
// ... other imports
import { useAuthStore, AuthState } from './store/auth';
import { User as AppUser } from './types';

function App() {
  const { user, loading, initializeAuthListener, deviceAuthStatus, clearDeviceAuthStatus } = useAuthStore((state) => ({
    user: state.user,
    loading: state.loading,
    initializeAuthListener: state.initializeAuthListener,
    deviceAuthStatus: state.deviceAuthStatus,
    clearDeviceAuthStatus: state.clearDeviceAuthStatus,
  }));

  useEffect(() => {
    const unsubscribe = initializeAuthListener();
    return () => unsubscribe();
  }, [initializeAuthListener]);

  if (loading) {
    return (
      <div className="h-screen flex justify-center items-center">
        <div>Loading application...</div>
      </div>
    );
  }

  return (
    <>
      <Router>
        <InnerAppRouter user={user} deviceAuthStatus={deviceAuthStatus} clearDeviceAuthStatus={clearDeviceAuthStatus} />
      </Router>
      <Toaster position="top-right" />
    </>
  );
}

const InnerAppRouter = ({ user, deviceAuthStatus, clearDeviceAuthStatus }: { user: AppUser | null, deviceAuthStatus: AuthState['deviceAuthStatus'], clearDeviceAuthStatus: AuthState['clearDeviceAuthStatus'] }) => {
  const location = useLocation();
  console.log(`[InnerAppRouter] Rendering. Path: "${location.pathname}", User ID: ${user ? user.id : 'null'}, Device Needs Approval: ${deviceAuthStatus?.needsApproval}, RequestID: ${deviceAuthStatus?.requestId}, Location state:`, JSON.stringify(location.state));

  // --- START OF TEMPORARY MODIFICATION IN App.tsx ---
  // TODO: Revisit and re-enable device approval redirection. Temporarily bypassing.
  /*
  // Priority 0: Device Awaiting Approval (takes precedence over everything)
  if (
    deviceAuthStatus &&
    deviceAuthStatus.needsApproval &&
    deviceAuthStatus.requestId &&
    deviceAuthStatus.userId &&
    location.pathname !== '/waiting-for-approval' // Prevent re-navigation if already on the page
  ) {
    console.log('[InnerAppRouter] Branch 0: Device Awaiting Approval. Navigating to /waiting-for-approval from path:', location.pathname, 'Request ID:', deviceAuthStatus.requestId);
    return (
      <Routes>
        <Route
          path="*" // Match any path when device approval is pending
          element={ <Navigate to="/waiting-for-approval"
                            state={{ requestId: deviceAuthStatus.requestId, userId: deviceAuthStatus.userId }}
                            replace /> }
        />
      </Routes>
    );
  }
  */
  // --- END OF TEMPORARY MODIFICATION IN App.tsx ---

  // Priority 1: Explicitly on /waiting-for-approval path
  // This branch might still be reachable if navigated to directly, but the above bypass
  // aims to prevent automatic redirection to it.
  if (location.pathname === '/waiting-for-approval') {
    console.log('[InnerAppRouter] Branch 1 HIT: Path is /waiting-for-approval. Location state received by InnerAppRouter:', JSON.stringify(location.state));
    return (
      <Routes>
        <Route path="/waiting-for-approval" element={<WaitingForApprovalPage />} />
        <Route path="*" element={<Navigate to="/waiting-for-approval" replace />} />
      </Routes>
    );
  }

  // Priority 2: Handle logged-in user (and not on /waiting-for-approval, and device is not pending approval)
  if (user) {
    console.log('[InnerAppRouter] Branch 2: User exists, path is not /waiting-for-approval, device not pending.');
    // ... rest of logged-in user routes
    return (
      <Routes>
        <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<MemberValidation />} />
          <Route path="coupons" element={<CouponValidation />} />
          <Route path="coupons/list" element={<CouponsList />} />
          <Route path="coupons/new" element={<NewCoupon />} />
          <Route path="coupons/edit/:id" element={<EditCoupon />} />
          
          <Route path="members" element={<MemberList />} />
          <Route path="members/:id" element={<MemberDetails />} />
          <Route path="members/:id/edit" element={<EditMember />} />
          <Route path="members/:id/renew" element={<RenewMembership />} />
          <Route path="members/new" element={<NewMember />} />

          <Route path="walk-ins" element={<WalkInList />} />
          <Route path="pos" element={<POSPage />} />
          <Route path="reports/*" element={<ReportsPanel />} />
          <Route path="end-shift" element={<EndShiftPage />} />

          <Route element={<AdminRoute />}>
            <Route path="admin/daily-summary" element={<DailySummaryPage />} />
            <Route path="admin/member-import" element={<MemberImportPage />} />
            <Route path="admin/device-requests" element={<DeviceRequestsPage />} />
            <Route path="admin/settings" element={<AdminSettingsPage />} />
            <Route path="admin/*" element={<AdminPanel />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Priority 3: Handle logged-out user (and not on /waiting-for-approval)
  console.log('[InnerAppRouter] Branch 3: No user, path is not /waiting-for-approval.');
  // ... rest of logged-out user routes
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default App;