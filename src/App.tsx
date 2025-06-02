import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LoginPage from './pages/login';
import DashboardLayout from './layouts/DashboardLayout';
import MemberValidation from './pages/member-validation';
import CouponValidation from './pages/coupon-validation';
import MemberList from './pages/members/list';
import MemberDetails from './pages/members/details';
import NewMember from './pages/members/new';
import EditMember from './pages/members/edit';
import RenewMembership from './pages/members/renew';
import WalkInList from './pages/walk-ins/list';
import POSPage from './pages/pos';
import AdminPanel from './pages/admin';
import EndShiftPage from './pages/end-shift';
import { ProtectedRoute } from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import CouponsList from './pages/coupons/list';
import NewCoupon from './pages/coupons/new';
import EditCoupon from './pages/coupons/edit';
import ReportsPanel from './pages/reports';
import ResetPassword from './pages/reset-password';
import DailySummaryPage from './pages/admin/daily-summary';
import MemberImportPage from './pages/admin/MemberImportPage';
import WaitingForApprovalPage from './pages/WaitingForApprovalPage';
import DeviceRequestsPage from './pages/admin/DeviceRequestsPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
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

  // Priority 0: Device Awaiting Approval (takes precedence over everything)
  if (
    deviceAuthStatus &&
    deviceAuthStatus.needsApproval &&
    deviceAuthStatus.requestId &&
    deviceAuthStatus.userId &&
    location.pathname !== '/waiting-for-approval' // Prevent re-navigation if already on the page
  ) {
    console.log('[InnerAppRouter] Branch 0: Device Awaiting Approval. Navigating to /waiting-for-approval from path:', location.pathname, 'Request ID:', deviceAuthStatus.requestId);
    // Important: Clear the status immediately after deciding to navigate to prevent loops
    // However, navigate is a side effect. Clearing should happen after navigation is committed or in WaitingForApprovalPage.
    // For now, let InnerAppRouter trigger navigation. WaitingForApprovalPage can clear it on mount.
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

  // Priority 1: Explicitly on /waiting-for-approval path
  if (location.pathname === '/waiting-for-approval') {
    console.log('[InnerAppRouter] Branch 1 HIT: Path is /waiting-for-approval. Location state received by InnerAppRouter:', JSON.stringify(location.state));
    // If we are here, deviceAuthStatus.needsApproval should be false (or Branch 0 would have hit).
    // WaitingForApprovalPage will handle missing location.state by redirecting to /login.
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
        {/* For a logged-in user, if no other explicitly defined route matches, redirect to dashboard home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Priority 3: Handle logged-out user (and not on /waiting-for-approval)
  console.log('[InnerAppRouter] Branch 3: No user, path is not /waiting-for-approval.');
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* If a logged-out user somehow lands on any other path, redirect to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default App;