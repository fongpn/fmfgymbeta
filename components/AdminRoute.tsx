import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

interface AdminRouteProps {
  // You can add any additional props you might want to pass to the route here
}

const AdminRoute: React.FC<AdminRouteProps> = () => {
  const { user, loading: authLoading } = useAuthStore(state => ({ 
    user: state.user,
    loading: state.loading 
  }));
  const location = useLocation();

  if (authLoading) {
    // You might want to return a global loading spinner here
    // For now, returning null or a simple div to avoid rendering children prematurely
    return (
      <div className="flex justify-center items-center h-screen">
        <div>Loading authentication status...</div>
      </div>
    );
  }

  if (!user) {
    // User not logged in, redirect to login page
    // Pass the current location so we can redirect back after login (optional)
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.role !== 'admin' && user.role !== 'superadmin') {
    // User is logged in but not an admin/superadmin, redirect to home or an unauthorized page
    // alert('You are not authorized to access this page.'); // Optional: show an alert
    return <Navigate to="/" replace />; // Redirect to home page
  }

  // User is authenticated and has an admin/superadmin role, render the child route content
  return <Outlet />;
};

export default AdminRoute; 