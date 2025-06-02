import React, { useState, useEffect } from 'react';
import { Save, Loader2, Plus, Edit2, Upload, Image } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { supabase } from '../../../lib/supabase';
import { compressImage } from '../../../lib/utils';
import toast from 'react-hot-toast';

interface Settings {
  grace_period_days: number;
  adult_walkin_price: number;
  youth_walkin_price: number;
  enable_password_reset?: boolean;
}

interface BrandingSettings {
  logo_text: string;
  icon_enabled: boolean;
  icon_color: string;
  logo_url?: string;
}

interface CouponPriceSettings {
  adult: number;
  youth: number;
}

const defaultSettings: Settings = {
  grace_period_days: 3,
  adult_walkin_price: 10,
  youth_walkin_price: 8,
  enable_password_reset: false,
};

const defaultBranding: BrandingSettings = {
  logo_text: 'FMF @ Alor Setar',
  icon_enabled: true,
  icon_color: '#ea580c'
};

const defaultCouponPrices: CouponPriceSettings = {
  adult: 45,
  youth: 35
};

export default function SettingsPanel() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [branding, setBranding] = useState<BrandingSettings>(defaultBranding);
  const [couponPrices, setCouponPrices] = useState<CouponPriceSettings>(defaultCouponPrices);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'branding' | 'coupons'>('general');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      // Fetch membership settings
      const { data: membershipData, error: membershipFetchError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'membership')
        .single();

      if (membershipFetchError) {
        console.error('Error fetching membership settings:', membershipFetchError);
        if (!membershipData) {
            setSettings(defaultSettings);
        }
      } else if (membershipData?.value) {
        const fetchedValue = membershipData.value as Partial<Settings>;
        const completeSettings: Settings = {
          ...defaultSettings,
          ...fetchedValue,
        };
        setSettings(completeSettings);
      } else {
        setSettings(defaultSettings);
      }

      // Fetch branding settings
      const { data: brandingData, error: brandingFetchError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'branding')
        .single();

      if (brandingFetchError) {
        console.error('Error fetching branding settings:', brandingFetchError);
      } else if (brandingData?.value) {
        setBranding(brandingData.value as BrandingSettings);
        if (brandingData.value.logo_url) {
          setLogoPreview(brandingData.value.logo_url);
        }
      }

      // Fetch coupon price settings
      const { data: couponPriceData, error: couponFetchError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'coupon_prices')
        .single();
      
      if (couponFetchError) {
        console.error('Error fetching coupon price settings:', couponFetchError);
        if (!couponPriceData) {
            setCouponPrices(defaultCouponPrices);
        }
      } else if (couponPriceData?.value) {
        setCouponPrices(couponPriceData.value as CouponPriceSettings);
      } else {
        setCouponPrices(defaultCouponPrices);
        await supabase
          .from('settings')
          .insert({ key: 'coupon_prices', value: defaultCouponPrices });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Error loading settings');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLogo(true);

      // Compress image
      const compressedBlob = await compressImage(file);
      const compressedFile = new File([compressedBlob], file.name, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(compressedFile);

      // Upload to storage
      const fileExt = 'jpg';
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `branding/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      // Update branding settings
      setBranding(prev => ({
        ...prev,
        logo_url: publicUrl
      }));

      toast.success('Logo uploaded successfully');
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Error uploading logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    console.log('[SettingsPanel] saveSettings: Initiating save.');
    console.log('[SettingsPanel] saveSettings: Current \'settings\' (membership) state before sending:', JSON.parse(JSON.stringify(settings)));
    console.log('[SettingsPanel] saveSettings: Current \'branding\' state before sending:', JSON.parse(JSON.stringify(branding)));
    console.log('[SettingsPanel] saveSettings: Current \'couponPrices\' state before sending:', JSON.parse(JSON.stringify(couponPrices)));

    try {
      // Save membership settings using RPC function
      console.log('[SettingsPanel] saveSettings: Attempting to save \'membership\' key with p_value:', settings);
      const { error: membershipError } = await supabase.rpc('update_settings', {
        p_key: 'membership',
        p_value: settings
      });

      if (membershipError) throw membershipError;

      // Save branding settings using RPC function
      console.log('[SettingsPanel] saveSettings: Attempting to save \'branding\' key with p_value:', branding);
      const { error: brandingError } = await supabase.rpc('update_settings', {
        p_key: 'branding',
        p_value: branding
      });

      if (brandingError) throw brandingError;

      // Save coupon price settings
      console.log('[SettingsPanel] saveSettings: Attempting to save \'coupon_prices\' key with p_value:', couponPrices);
      const { error: couponPriceError } = await supabase.rpc('update_settings', {
        p_key: 'coupon_prices',
        p_value: couponPrices
      });

      if (couponPriceError) throw couponPriceError;

      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            System Settings
          </h1>

          <div className="mb-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('general')}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === 'general'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `}
              >
                General
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}