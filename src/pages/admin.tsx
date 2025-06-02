import React from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Package, Settings, /* Users, */ Tag, ListChecks, UploadCloud, ShieldCheck, DollarSign, BarChart3, UsersRound, Files } from 'lucide-react';
import ProductsPanel from './admin/products';
import AdminSettingsPage from './admin/AdminSettingsPage';
import ActiveShiftsPage from './admin/active-shifts';
import MemberImportPage from './admin/MemberImportPage';
import DeviceRequestsPage from './admin/DeviceRequestsPage';
import ReportsPanel from './admin/reports';
import CouponsPanel from './admin/coupons';
import DailySummaryPage from './admin/daily-summary';

export default function AdminPanel() {
  const location = useLocation();
  
  const navItems = [
    { path: '/admin/daily-summary', label: 'Daily Summary', icon: BarChart3, component: DailySummaryPage },
    { path: '/admin/reports', label: 'Reports', icon: Files, component: ReportsPanel },
    { path: '/admin/settings', label: 'Settings', icon: Settings, component: AdminSettingsPage },
    { path: '/admin/products', label: 'POS Products', icon: Package, component: ProductsPanel },
    { path: '/admin/coupons', label: 'Coupon Books', icon: Tag, component: CouponsPanel },
    { path: '/admin/active-shifts', label: 'Active Shifts', icon: ListChecks, component: ActiveShiftsPage },
    { path: '/admin/member-import', label: 'Member Import', icon: UploadCloud, component: MemberImportPage },
    { path: '/admin/device-requests', label: 'Device Requests', icon: ShieldCheck, component: DeviceRequestsPage },
  ].filter(item => item);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 border-b border-gray-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto pb-2" aria-label="Admin sections">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center
                ${
                  location.pathname.startsWith(item.path) || 
                  (item.path === '/admin/settings' && location.pathname === '/admin') || 
                  (item.path === '/admin/settings' && location.pathname.startsWith('/admin/users'))
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <item.icon className="inline-block mr-2 h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <Routes>
        <Route path="/" element={<Navigate to="/admin/daily-summary" replace />} />
        {navItems.map(item => (
          <Route key={item.path + "-route"} path={item.path.replace('/admin/', '') + '/*'} element={<item.component />} />
        ))}
      </Routes>
    </div>
  );
}