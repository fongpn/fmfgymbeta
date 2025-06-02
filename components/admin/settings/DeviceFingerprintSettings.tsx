import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { Switch } from '../../ui/switch';
import { Label } from '../../ui/label';
import { toast } from 'react-hot-toast';
import { Loader2, ShieldCheck, History, Settings as SettingsIcon } from 'lucide-react';
import { useAuthStore, AuthUser } from '../../../store/auth';
import DeviceApprovalLog from './DeviceApprovalLog';
import { Button } from '../../ui/button';

interface DeviceSettings {
  device_fingerprinting_enabled?: boolean;
}

const DeviceFingerprintSettings: React.FC = () => {
  const [settings, setSettings] = useState<DeviceSettings | null>(null);
  const [configLoading, setConfigLoading] = useState<boolean>(true);
  const [configSaving, setConfigSaving] = useState<boolean>(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const authUser = useAuthStore((state) => state.user);
  
  const isFetchingConfigRef = useRef(false);
  const configLoadedForUserIdRef = useRef<string | null>(null);

  type SubTab = 'pending' | 'historical' | 'configuration';
  const [currentSubTab, setCurrentSubTab] = useState<SubTab>('pending');

  const fetchDeviceConfig = useCallback(async (currentUser: AuthUser | null) => {
    if (isFetchingConfigRef.current) return;
    if (!currentUser || !currentUser.id || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
      setConfigError('You are not authorized to view or manage these settings.');
      setConfigLoading(false);
      setSettings(null);
      configLoadedForUserIdRef.current = currentUser?.id || null;
      return;
    }

    isFetchingConfigRef.current = true;
    setConfigLoading(true); 
    setConfigError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'device_fingerprinting_enabled')
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }
      setSettings(data ? { device_fingerprinting_enabled: !!data.value } : { device_fingerprinting_enabled: false });
      configLoadedForUserIdRef.current = currentUser.id;
    } catch (err: any) {
      setConfigError(`Failed to load settings: ${err.message}`);
      setSettings(null);
      configLoadedForUserIdRef.current = currentUser.id;
    } finally {
      setConfigLoading(false);
      isFetchingConfigRef.current = false;
    }
  }, []);

  useEffect(() => {
    const currentUser = authUser;
    if (currentUser && currentUser.id && (currentUser.role === 'admin' || currentUser.role === 'superadmin')) {
      if (currentUser.id !== configLoadedForUserIdRef.current && !isFetchingConfigRef.current) {
        fetchDeviceConfig(currentUser);
      } else if (!isFetchingConfigRef.current && settings === null && configLoadedForUserIdRef.current === currentUser.id){
        setConfigLoading(false);
      }
    } else if (currentUser) {
        setConfigError('You are not authorized to view these settings.');
        setConfigLoading(false);
        setSettings(null);
        configLoadedForUserIdRef.current = currentUser.id;
    } else {
        setConfigLoading(true);
        setSettings(null);
        setConfigError(null);
        configLoadedForUserIdRef.current = null;
    }
  }, [authUser, fetchDeviceConfig, settings]);

  const handleToggleChange = async (checked: boolean) => {
    if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'superadmin')) {
      toast.error('You are not authorized to change these settings.');
      return;
    }
    setConfigSaving(true);
    setConfigError(null);
    const optimisticPreviousSettings = settings ? { ...settings } : { device_fingerprinting_enabled: !checked };
    setSettings({ device_fingerprinting_enabled: checked });

    try {
      const { error: updateError } = await supabase
        .from('settings')
        .upsert({ key: 'device_fingerprinting_enabled', value: checked }, { onConflict: 'key' });

      if (updateError) throw updateError;
      toast.success('Settings saved successfully!');
      configLoadedForUserIdRef.current = authUser.id;
    } catch (err: any) {
      setConfigError(`Failed to save settings: ${err.message}`);
      toast.error(`Failed to save settings: ${err.message}`);
      setSettings(optimisticPreviousSettings);
    } finally {
      setConfigSaving(false);
    }
  };

  const renderConfiguration = () => {
    if (configLoading && !settings) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2">Loading configuration...</p>
        </div>
      );
    }
    if (configError && !settings && !configLoading) {
      return <div className="p-4 text-red-500">Error: {configError}</div>;
    }
    if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'superadmin')) {
      if (!configLoading) return <div className="p-4 text-orange-500">You are not authorized to manage device fingerprinting configurations.</div>;
    }
    if (!settings && !configLoading && !configError) {
        return <div className="p-4 text-muted-foreground">Configuration not available or could not be loaded.</div>;
    }
    if (settings) {
        return (
          <div className="space-y-6 p-1">
            {configError && (
              <p className="text-sm text-red-500 bg-red-100 p-3 rounded-md mb-4">{configError}</p>
            )}
            <div className="flex items-center justify-between p-4 border rounded-lg shadow-sm bg-card">
              <div>
                <Label htmlFor="device-fingerprinting-switch" className="text-lg font-medium">
                  Enable Device Fingerprinting
                </Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, new devices will require admin approval before they can access the POS system.
                </p>
              </div>
              <Switch
                id="device-fingerprinting-switch"
                checked={settings.device_fingerprinting_enabled}
                onCheckedChange={handleToggleChange}
                disabled={configSaving}
              />
            </div>
            {configSaving && (
              <div className="flex items-center justify-center mt-4">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {'Saving changes...'}
              </div>
            )}
          </div>
        );
    }
    return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2">Loading configuration...</p>
        </div>
      );
  };

  return (
    <div className="w-full">
      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Sub Tabs">
          <Button
            variant={currentSubTab === 'pending' ? 'default' : 'ghost'}
            onClick={() => setCurrentSubTab('pending')}
            className={`py-3 px-4 font-medium text-sm flex items-center rounded-t-md whitespace-nowrap ${currentSubTab === 'pending' ? 'border-b-2 border-primary text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground hover:border-gray-300'}`}
          >
            <ShieldCheck className="mr-2 h-4 w-4" /> Pending Approval
          </Button>
          <Button
            variant={currentSubTab === 'historical' ? 'default' : 'ghost'}
            onClick={() => setCurrentSubTab('historical')}
            className={`py-3 px-4 font-medium text-sm flex items-center rounded-t-md whitespace-nowrap ${currentSubTab === 'historical' ? 'border-b-2 border-primary text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground hover:border-gray-300'}`}
          >
            <History className="mr-2 h-4 w-4" /> Historical Log
          </Button>
          <Button
            variant={currentSubTab === 'configuration' ? 'default' : 'ghost'}
            onClick={() => setCurrentSubTab('configuration')}
            className={`py-3 px-4 font-medium text-sm flex items-center rounded-t-md whitespace-nowrap ${currentSubTab === 'configuration' ? 'border-b-2 border-primary text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground hover:border-gray-300'}`}
          >
            <SettingsIcon className="mr-2 h-4 w-4" /> Configuration
          </Button>
        </nav>
      </div>

      <div style={{ display: currentSubTab === 'pending' ? 'block' : 'none' }}>
        <DeviceApprovalLog displayMode="pending" />
      </div>
      <div style={{ display: currentSubTab === 'historical' ? 'block' : 'none' }}>
        <DeviceApprovalLog displayMode="historical" />
      </div>
      <div style={{ display: currentSubTab === 'configuration' ? 'block' : 'none' }}>
        {renderConfiguration()}
      </div>
    </div>
  );
};

export default DeviceFingerprintSettings; 