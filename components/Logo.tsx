import React from 'react';
import { Dumbbell } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'default' | 'medium' | 'large' | 'menu';
}

interface BrandingSettings {
  logo_text: string;
  icon_enabled: boolean;
  icon_color: string;
  logo_url: string | null;
}

// Global cache for branding settings
let globalBrandingSettings: BrandingSettings | null = null;

// Function to preload image
const preloadImage = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject();
    img.src = url;
  });
};

export function Logo({ className = '', showText = false, size = 'default' }: LogoProps) {
  const [settings, setSettings] = React.useState<BrandingSettings>(() => 
    globalBrandingSettings || {
      logo_text: 'Friendly Muscle Fitness',
      icon_enabled: true,
      icon_color: '#ea580c',
      logo_url: null
    }
  );
  const [loaded, setLoaded] = React.useState(!!globalBrandingSettings);
  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;

    const fetchSettings = async () => {
      try {
        // Use cached settings if available
        if (globalBrandingSettings) {
          if (isMounted) {
            setSettings(globalBrandingSettings);
            setLoaded(true);
          }
          return;
        }

        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'branding')
          .maybeSingle();

        if (error) throw error;

        if (data?.value && isMounted) {
          const brandingSettings: BrandingSettings = {
            logo_text: data.value.logo_text || 'Friendly Muscle Fitness',
            icon_enabled: data.value.icon_enabled ?? true,
            icon_color: data.value.icon_color || '#ea580c',
            logo_url: data.value.logo_url || null
          };

          // Store in global cache
          globalBrandingSettings = brandingSettings;

          // Preload image if URL exists
          if (brandingSettings.logo_url) {
            try {
              await preloadImage(brandingSettings.logo_url);
            } catch (err) {
              if (isMounted) {
                setImageError(true);
              }
            }
          }

          if (isMounted) {
            setSettings(brandingSettings);
          }
        }
      } catch (error) {
        console.error('Error fetching logo settings:', error);
        // Keep using default values
      } finally {
        if (isMounted) {
          setLoaded(true);
        }
      }
    };

    if (!globalBrandingSettings) {
      fetchSettings();
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // Get size based on variant
  const getIconSize = () => {
    switch (size) {
      case 'menu':
        return 'h-24 w-24'; // 3x default size
      case 'large':
        return 'h-16 w-16';
      case 'medium':
        return 'h-12 w-12';
      default:
        return 'h-8 w-8';
    }
  };

  const getImageSize = () => {
    switch (size) {
      case 'menu':
        return 'h-96 w-96'; // 3x default size
      case 'large':
        return 'h-64 w-64';
      case 'medium':
        return 'h-48 w-48';
      default:
        return 'h-32 w-32';
    }
  };

  const getTextSize = () => {
    switch (size) {
      case 'menu':
        return 'text-3xl'; // 3x default size
      case 'large':
        return 'text-2xl';
      case 'medium':
        return 'text-xl';
      default:
        return 'text-lg';
    }
  };

  const renderFallbackLogo = () => (
    <>
      {settings.icon_enabled && (
        <Dumbbell 
          className={getIconSize()}
          style={{ color: settings.icon_color }}
        />
      )}
      {showText && (
        <span className={`font-semibold ${getTextSize()} ${settings.icon_enabled ? 'ml-2' : ''}`}>
          {settings.logo_text}
        </span>
      )}
    </>
  );

  // Show loading state
  if (!loaded) {
    return (
      <div className={`flex-shrink-0 flex items-center ${className}`}>
        <div className={`animate-pulse bg-gray-200 rounded ${getImageSize()}`} />
      </div>
    );
  }

  return (
    <div className={`flex-shrink-0 flex items-center ${className}`}>
      {settings.logo_url && !imageError ? (
        <img 
          src={settings.logo_url} 
          alt={settings.logo_text}
          className={`object-contain ${getImageSize()}`}
          onError={() => setImageError(true)}
          loading="eager"
          crossOrigin="anonymous"
        />
      ) : (
        renderFallbackLogo()
      )}
    </div>
  );
}