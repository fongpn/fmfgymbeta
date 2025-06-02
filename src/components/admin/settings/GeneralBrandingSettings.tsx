import React, { useState, useEffect } from 'react';
import { Save, Upload, Loader2, Calculator, ImageIcon, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { supabase } from '../../../lib/supabase';
import { compressImage } from '../../../lib/utils';
import toast from 'react-hot-toast';

interface GeneralSettingsState {
  grace_period_days: number;
  enable_password_reset: boolean;
}

interface BrandingSettings {
  logo_text: string;
  icon_enabled: boolean;
  icon_color: string;
  logo_url?: string | null;
}

const defaultGeneralSettingsState: GeneralSettingsState = {
  grace_period_days: 7,
  enable_password_reset: true,
};

const defaultBranding: BrandingSettings = {
  logo_text: 'FMF @ Alor Setar',
  icon_enabled: true,
  icon_color: '#ea580c',
  logo_url: null
};

export default function GeneralBrandingSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generalSettings, setGeneralSettings] = useState<GeneralSettingsState>(defaultGeneralSettingsState);
  const [branding, setBranding] = useState<BrandingSettings>(defaultBranding);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'branding'>('general');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      // Fetch membership settings
      const { data: membershipData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'membership')
        .single();

      if (membershipData?.value) {
        const fetchedMembershipSettings = membershipData.value as Partial<GeneralSettingsState>;
        setGeneralSettings(prev => ({ 
          grace_period_days: fetchedMembershipSettings.grace_period_days ?? defaultGeneralSettingsState.grace_period_days,
          enable_password_reset: fetchedMembershipSettings.enable_password_reset ?? defaultGeneralSettingsState.enable_password_reset,
        }));
      } else {
        setGeneralSettings(defaultGeneralSettingsState);
      }

      // Fetch branding settings
      const { data: brandingData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'branding')
        .single();

      if (brandingData?.value) {
        setBranding(brandingData.value as BrandingSettings);
        if (brandingData.value.logo_url) {
          setPhotoPreview(brandingData.value.logo_url);
        }
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

      setPhoto(compressedFile);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(compressedFile);

      toast.success('Logo selected');
    } catch (error) {
      console.error('Error processing logo:', error);
      toast.error('Error processing logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setBranding(prev => ({
      ...prev,
      logo_url: null
    }));
    setPhoto(null);
    setPhotoPreview('');
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let photoUrl = branding.logo_url;

      // Upload new photo if provided
      if (photo) {
        const fileExt = 'jpg';
        const fileName = `logo-${Date.now()}.${fileExt}`;
        const filePath = `branding/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, photo);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(filePath);

        photoUrl = publicUrl;
      }

      // Fetch current membership settings to merge
      const { data: currentMembershipData, error: fetchMembershipError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'membership')
        .single();

      const currentMembershipObject = currentMembershipData?.value || {};
      if (fetchMembershipError && fetchMembershipError.code !== 'PGRST116') {
          throw fetchMembershipError;
      }
      
      const mergedMembership = {
        ...currentMembershipObject,
        grace_period_days: generalSettings.grace_period_days,
        enable_password_reset: generalSettings.enable_password_reset,
      };

      // Save merged membership settings using RPC function
      const { error: membershipError } = await supabase.rpc('update_settings', {
        p_key: 'membership',
        p_value: mergedMembership
      });

      if (membershipError) throw membershipError;

      // Save branding settings using RPC function
      const { error: brandingError } = await supabase.rpc('update_settings', {
        p_key: 'branding',
        p_value: {
          ...branding,
          logo_url: photoUrl
        }
      });

      if (brandingError) throw brandingError;

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
    <form onSubmit={saveSettings}>
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            type="button"
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
          <button
            type="button"
            onClick={() => setActiveTab('branding')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'branding'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            Branding
          </button>
        </nav>
      </div>

      <div className="mt-6">
        {activeTab === 'general' && (
          <div>
            <h2 className="text-lg font-medium text-gray-900">General Settings</h2>
            <div className="mt-4 space-y-6">
              <div>
                <label htmlFor="grace_period_days" className="block text-sm font-medium text-gray-700">
                  Membership Grace Period (Days)
                </label>
                <Input
                  id="grace_period_days"
                  name="grace_period_days"
                  type="number"
                  value={generalSettings.grace_period_days}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, grace_period_days: parseInt(e.target.value) || 0 }))}
                  className="mt-1 block w-full max-w-xs"
                />
                <p className="mt-1 text-xs text-gray-500">Number of days after expiry before status changes to Expired.</p>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="relative flex items-start">
                  <div className="flex h-6 items-center">
                    <input
                      id="enable_password_reset"
                      name="enable_password_reset"
                      type="checkbox"
                      checked={generalSettings.enable_password_reset}
                      onChange={(e) => setGeneralSettings(prev => ({ ...prev, enable_password_reset: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                  </div>
                  <div className="ml-3 text-sm leading-6">
                    <label htmlFor="enable_password_reset" className="font-medium text-gray-900">
                      Enable Password Reset
                    </label>
                    <p className="text-gray-500 text-xs">Allow users to reset their password from the login page.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'branding' && (
          <div>
            <h2 className="text-lg font-medium text-gray-900">Branding</h2>
            <div className="mt-4 space-y-6">
              <div>
                <label htmlFor="logo_text" className="block text-sm font-medium text-gray-700">
                  Logo Text
                </label>
                <Input
                  id="logo_text"
                  name="logo_text"
                  type="text"
                  value={branding.logo_text}
                  onChange={(e) => setBranding(prev => ({ ...prev, logo_text: e.target.value }))}
                  className="mt-1 block w-full"
                />
              </div>

              <div className="flex items-center">
                <input
                  id="icon_enabled"
                  name="icon_enabled"
                  type="checkbox"
                  checked={branding.icon_enabled}
                  onChange={(e) => setBranding(prev => ({ ...prev, icon_enabled: e.target.checked }))}
                  className="h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
                <label htmlFor="icon_enabled" className="ml-2 block text-sm text-gray-900">
                  Show Logo Icon
                </label>
              </div>
              
              {branding.icon_enabled && (
                <div>
                  <label htmlFor="icon_color" className="block text-sm font-medium text-gray-700">
                    Icon Color
                  </label>
                  <input
                    id="icon_color"
                    name="icon_color"
                    type="color"
                    value={branding.icon_color}
                    onChange={(e) => setBranding(prev => ({ ...prev, icon_color: e.target.value }))}
                    className="mt-1 block"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo Image</label>
                <div className="mt-1 flex items-center space-x-4">
                  <div className="h-16 w-16 bg-gray-100 rounded-md flex items-center justify-center overflow-hidden">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Logo Preview" className="h-full w-full object-contain" />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => document.getElementById('logo-upload')?.click()} 
                      disabled={uploadingLogo}
                    >
                      {photoPreview ? 'Change Logo' : 'Upload Logo'}
                    </Button>
                    <input id="logo-upload" name="logo-upload" type="file" className="sr-only" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} />
                  </div>
                </div>
                 {photoPreview && (
                  <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="mt-2 text-red-600 hover:text-red-700" 
                      onClick={handleRemoveLogo}
                      disabled={saving || uploadingLogo}
                  >
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove Logo
                  </Button>
                 )}
                <p className="mt-1 text-xs text-gray-500">Recommended: PNG with transparent background, max 2MB.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end mt-8 pt-5 border-t border-gray-200">
        <Button
          type="submit"
          disabled={saving || loading}
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </form>
  );
} 