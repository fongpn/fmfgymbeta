import React, { useState } from 'react';
import DeviceFingerprintSettings from '../../components/admin/settings/DeviceFingerprintSettings';
import GeneralBrandingSettings from '../../components/admin/settings/GeneralBrandingSettings';
import PricingSettings from '../../components/admin/settings/PricingSettings';
import MembershipPlansSettings from './settings/membership-plans';
import UsersPanel from './users';
import { Settings, Palette, CreditCard, UsersRound, DollarSign } from 'lucide-react';

// We will import and use DeviceFingerprintSettings here later

type AdminTab = 'device-fingerprinting' | 'system-customization' | 'pricing' | 'user-management' | 'membership-plans';

const AdminSettingsPage = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('device-fingerprinting');

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Admin Settings</h1>
      
      <div className="bg-white shadow sm:rounded-lg">
        {/* Tab Navigation */}
        <div className="px-4 py-3 sm:px-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
            <button
              type="button"
              onClick={() => setActiveTab('device-fingerprinting')}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center
                ${
                  activeTab === 'device-fingerprinting'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Settings className="mr-2 h-4 w-4" /> Device Fingerprinting
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('system-customization')}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center
                ${
                  activeTab === 'system-customization'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Palette className="mr-2 h-4 w-4" /> System Customization
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pricing')}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center
                ${
                  activeTab === 'pricing'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <CreditCard className="mr-2 h-4 w-4" /> Pricing Configuration
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('membership-plans')}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center
                ${
                  activeTab === 'membership-plans'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <DollarSign className="mr-2 h-4 w-4" /> Membership Plans
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('user-management')}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center
                ${
                  activeTab === 'user-management'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <UsersRound className="mr-2 h-4 w-4" /> User Settings
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="px-4 py-5 sm:p-6">
          <div style={{ display: activeTab === 'device-fingerprinting' ? 'block' : 'none' }}>
            <DeviceFingerprintSettings />
          </div>
          <div style={{ display: activeTab === 'system-customization' ? 'block' : 'none' }}>
            <GeneralBrandingSettings />
          </div>
          <div style={{ display: activeTab === 'pricing' ? 'block' : 'none' }}>
            <PricingSettings />
          </div>
          <div style={{ display: activeTab === 'membership-plans' ? 'block' : 'none' }}>
            <MembershipPlansSettings />
          </div>
          <div style={{ display: activeTab === 'user-management' ? 'block' : 'none' }}>
            <UsersPanel />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsPage; 