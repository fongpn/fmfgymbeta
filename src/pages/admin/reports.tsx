import React, { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { BarChart2, Users, CreditCard, ShoppingCart } from 'lucide-react';
import AttendanceReport from './reports/attendance';
import FinancialReport from './reports/financial';
import MembershipReport from './reports/membership';
import SalesReport from './reports/sales';

export default function ReportsPanel() {
  const location = useLocation();
  
  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <Link
            to="/admin/reports/attendance"
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
          <Link
            to="/admin/reports/financial"
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${location.pathname.includes('/financial')
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            <CreditCard className="inline-block mr-2 h-4 w-4" />
            Financial
          </Link>
          <Link
            to="/admin/reports/membership"
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
            to="/admin/reports/sales"
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${location.pathname.includes('/sales')
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            <ShoppingCart className="inline-block mr-2 h-4 w-4" />
            Sales
          </Link>
        </nav>
      </div>

      <Routes>
        <Route path="attendance" element={<AttendanceReport />} />
        <Route path="financial" element={<FinancialReport />} />
        <Route path="membership" element={<MembershipReport />} />
        <Route path="sales" element={<SalesReport />} />
      </Routes>
    </div>
  );
}