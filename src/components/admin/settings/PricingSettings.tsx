import React, { useState, useEffect } from 'react';
import { Save, Loader2, Info } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';

// Define interfaces needed for this component
interface WalkInPrices {
  adult: number;
  youth: number;
}

interface CouponPriceSettings {
  adult: number;
  youth: number;
  max_uses: number;
}

// Interface for the full 'membership' settings object to ensure we preserve other fields
interface MembershipSettingsValue {
  adult_walkin_price: number;
  youth_walkin_price: number;
  grace_period_days?: number; 
  enable_password_reset?: boolean;
}

// Define default values
const defaultWalkInPrices: WalkInPrices = {
  adult: 10,
  youth: 8,
};

const defaultCouponPrices: CouponPriceSettings = {
  adult: 45,
  youth: 35,
  max_uses: 1 
};

const defaultFullMembershipSettingsValue: MembershipSettingsValue = {
  adult_walkin_price: defaultWalkInPrices.adult,
  youth_walkin_price: defaultWalkInPrices.youth,
  grace_period_days: 7, // Default from GeneralBrandingSettings
  enable_password_reset: true // Default from GeneralBrandingSettings
};

export default function PricingSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // State for form inputs
  const [walkInPrices, setWalkInPrices] = useState<WalkInPrices>(defaultWalkInPrices);
  const [couponPrices, setCouponPrices] = useState<CouponPriceSettings>(defaultCouponPrices);
  
  // State to hold the full 'membership' settings object from DB
  const [membershipSettingsFromDB, setMembershipSettingsFromDB] = useState<MembershipSettingsValue>(defaultFullMembershipSettingsValue);

  const [activeTab, setActiveTab] = useState<'walkin-prices' | 'coupon-prices'>('walkin-prices');

  useEffect(() => {
    fetchPrices();
  }, []);

  const fetchPrices = async () => {
    setLoading(true);
    try {
      // Fetch full 'membership' settings object
      const { data: membershipData, error: membershipFetchError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'membership')
        .single();

      if (membershipFetchError && membershipFetchError.code !== 'PGRST116') { // PGRST116: single row not found
        throw membershipFetchError;
      }
      
      const currentMembershipValue = (membershipData?.value || {}) as Partial<MembershipSettingsValue>;
      const completeMembershipValue: MembershipSettingsValue = {
        ...defaultFullMembershipSettingsValue, // Start with all defaults
        ...currentMembershipValue,           // Override with any fetched values
      };
      setMembershipSettingsFromDB(completeMembershipValue);
      setWalkInPrices({
        adult: completeMembershipValue.adult_walkin_price,
        youth: completeMembershipValue.youth_walkin_price,
      });

      // Fetch coupon price settings
      const { data: couponPriceData, error: couponPriceFetchError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'coupon_prices')
        .single();

      if (couponPriceFetchError && couponPriceFetchError.code !== 'PGRST116') {
        throw couponPriceFetchError;
      }

      if (couponPriceData?.value) {
        const fetchedCouponSettings = couponPriceData.value as Partial<CouponPriceSettings>;
        setCouponPrices({
            adult: fetchedCouponSettings.adult ?? defaultCouponPrices.adult,
            youth: fetchedCouponSettings.youth ?? defaultCouponPrices.youth,
            max_uses: fetchedCouponSettings.max_uses ?? defaultCouponPrices.max_uses,
        });
      } else {
        // If coupon price settings don't exist, use defaults (they will be created on save if not present)
        setCouponPrices(defaultCouponPrices);
      }

    } catch (error) {
      console.error('Error fetching pricing settings:', error);
      toast.error('Error loading pricing settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrices = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Construct the updated 'membership' object, preserving other fields
      const updatedMembershipValue: MembershipSettingsValue = {
        ...membershipSettingsFromDB, // Preserve existing grace_period_days, enable_password_reset etc.
        adult_walkin_price: walkInPrices.adult,
        youth_walkin_price: walkInPrices.youth,
      };
      
      const { error: walkInError } = await supabase.rpc('update_settings', {
        p_key: 'membership', 
        p_value: updatedMembershipValue
      });
      if (walkInError) throw walkInError;

      // Save coupon price settings
      const { error: couponPriceError } = await supabase.rpc('update_settings', {
        p_key: 'coupon_prices',
        p_value: couponPrices
      });
      if (couponPriceError) {
        // If key doesn't exist, try insert
        if ((couponPriceError as any).code === 'PGRST116' || (couponPriceError as any).details?.includes('0 rows')) { // Needs more robust error check for non-existence
            const { error: couponInsertError } = await supabase.from('settings').insert({key: 'coupon_prices', value: couponPrices});
            if (couponInsertError) throw couponInsertError;
        } else {
            throw couponPriceError;
        }
      }

      toast.success('Pricing settings saved successfully');
      fetchPrices(); // Re-fetch to confirm and update state
    } catch (error) {
      console.error('Error saving pricing settings:', error);
      toast.error('Error saving pricing settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSavePrices}>
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            type="button"
            onClick={() => setActiveTab('walkin-prices')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'walkin-prices'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Walk-in Prices
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('coupon-prices')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'coupon-prices'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Coupon Book Prices
          </button>
        </nav>
      </div>

      <div className="mt-6 min-h-[200px]"> {/* Added min-height for content area */}
        {activeTab === 'walkin-prices' && (
          <div>
            <h3 className="text-md font-medium text-gray-800 mb-1">Set Walk-in Entry Prices</h3>
            <p className="text-xs text-gray-500 mb-4">Define the standard prices for non-member single entries.</p>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <div>
                <label htmlFor="adult_walkin_price" className="block text-sm font-medium text-gray-700">
                  Adult Walk-in (RM)
                </label>
                <Input
                  id="adult_walkin_price"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={walkInPrices.adult}
                  onChange={(e) => setWalkInPrices({ ...walkInPrices, adult: parseFloat(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="youth_walkin_price" className="block text-sm font-medium text-gray-700">
                  Youth Walk-in (RM)
                </label>
                <Input
                  id="youth_walkin_price"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={walkInPrices.youth}
                  onChange={(e) => setWalkInPrices({ ...walkInPrices, youth: parseFloat(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        )}
        {activeTab === 'coupon-prices' && (
          <div>
            <h3 className="text-md font-medium text-gray-800 mb-1">Set Coupon Book Prices & Max Uses</h3>
            <p className="text-xs text-gray-500 mb-4">Define the prices for pre-paid coupon books and their usage limit.</p>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <div>
                <label htmlFor="adult_coupon_price" className="block text-sm font-medium text-gray-700">
                  Adult Coupon Book (RM)
                </label>
                <Input
                  id="adult_coupon_price"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={couponPrices.adult}
                  onChange={(e) => setCouponPrices({ ...couponPrices, adult: parseFloat(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="youth_coupon_price" className="block text-sm font-medium text-gray-700">
                  Youth Coupon Book (RM)
                </label>
                <Input
                  id="youth_coupon_price"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={couponPrices.youth}
                  onChange={(e) => setCouponPrices({ ...couponPrices, youth: parseFloat(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="coupon_max_uses" className="block text-sm font-medium text-gray-700">
                  Maximum Uses Per Coupon
                </label>
                <Input
                  id="coupon_max_uses"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={couponPrices.max_uses}
                  onChange={(e) => setCouponPrices({ ...couponPrices, max_uses: parseInt(e.target.value) || 1 })}
                  className="mt-1 max-w-xs"
                />
                 <p className="mt-1 text-xs text-gray-500">
                    Number of entries each coupon in a book is valid for.
                 </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end mt-8 pt-5 border-t border-gray-200">
        <Button type="submit" disabled={saving || loading}>
          {saving ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Prices...</>
          ) : (
            <><Save className="mr-2 h-4 w-4" /> Save Pricing Settings</>
          )}
        </Button>
      </div>
    </form>
  );
} 