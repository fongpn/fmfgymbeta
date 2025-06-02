import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  console.log('[ProtectedRoute] Rendering. Path:', window.location.pathname);
  const { user, loading } = useAuthStore((state) => ({
    user: state.user,
    loading: state.loading,
  }));

  if (loading) {
    // Optionally show a loading spinner or nothing
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}