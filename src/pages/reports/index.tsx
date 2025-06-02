import React from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { CreditCard, ShoppingCart, Users, BarChart2 } from 'lucide-react';
import FinancialReport from './financial';
import SalesReport from './sales';
import MembershipReport from './membership';
import AttendanceReport from './attendance';
import { useAuthStore } from '../../store/auth';

export default function ReportsPanel() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reports</h1>
      
      <div className="mb-8 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <Link
            to="/reports/financial"
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${location.pathname.includes('/financial') || location.pathname === '/reports'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            <CreditCard className="inline-block mr-2 h-4 w-4" />
            Collections
          </Link>
          <Link
            to="/reports/sales"
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${location.pathname.includes('/sales')
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            <ShoppingCart className="inline-block mr-2 h-4 w-4" />
            Point of Sales
          </Link>
          {isAdmin && (
            <>
              <Link
                to="/reports/membership"
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  ${location.pathname.includes('/membership')
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `}
              >
                <Users className="inline-block mr-2 h-4 w-4" />
                Membership
              </Link>
              <Link
                to="/reports/attendance"
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  ${location.pathname.includes('/attendance')
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `}
              >
                <BarChart2 className="inline-block mr-2 h-4 w-4" />
                Attendance
              </Link>
            </>
          )}
        </nav>
      </div>

      <Routes>
        {/* Redirect to financial report by default */}
        <Route 
          path="/" 
          element={<Navigate to="/reports/financial" replace />}
        />
        
        {/* Routes accessible to all users */}
        <Route path="financial" element={<FinancialReport />} />
        <Route path="sales" element={<SalesReport />} />
        
        {/* Protected routes for admin-only reports */}
        {isAdmin && (
          <>
            <Route path="membership" element={<MembershipReport />} />
            <Route path="attendance" element={<AttendanceReport />} />
          </>
        )}
        
        {/* Redirect unauthorized access attempts to financial report */}
        <Route path="*" element={<Navigate to="/reports/financial" replace />} />
      </Routes>
    </div>
  );
}