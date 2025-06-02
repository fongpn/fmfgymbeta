import FingerprintJS, { Agent, Component } from '@fingerprintjs/fingerprintjs';

interface FingerprintData {
  visitorId: string;
  deviceDescription: string;
}

// let fpAgentPromise: Promise<any> | null = null; // Temporarily disable caching for debugging load()
let fingerprintDataCache: FingerprintData | null = null;

const loadAgent_debug = async (): Promise<Agent> => {
  // console.log('[fingerprint.ts] Attempting FingerprintJS.load()...'); // Already confirmed working
  try {
    const agent = await FingerprintJS.load();
    // console.log('[fingerprint.ts] FingerprintJS.load() successful. Agent loaded.');
    return agent;
  } catch (error) {
    console.error('[fingerprint.ts] FingerprintJS.load() FAILED:', error);
    throw error;
  }
};

// Helper to safely get a component's value
function getComponentValue<T>(component: Component<T> | undefined): T | undefined {
  if (component && typeof component === 'object' && 'value' in component && component.value !== undefined) {
    return component.value;
  }
  return undefined;
}

export const getFingerprint = async (): Promise<FingerprintData> => {
  console.log('[fingerprint.ts] getFingerprint called (testing full parsing logic with ts-ignore).');
  try {
    const agent = await loadAgent_debug();
    
    // console.log('[fingerprint.ts] Attempting agent.get()...'); // Already confirmed working
    const result = await agent.get(); 
    // console.log('[fingerprint.ts] agent.get() successful. Result:', result); // Already confirmed working

    console.log('[fingerprint.ts] Attempting device description parsing logic...');
    // For detailed debugging, you can uncomment this:
    // console.log('[fingerprint.ts] Full FingerprintJS result.components:', JSON.stringify(result.components, null, 2));

    let browserName = 'Unknown Browser';
    let browserVersion = '';
    let osName = 'Unknown OS';
    let osVersion = '';

    const components = result.components;

    if (components && typeof components === 'object') {
      // @ts-ignore - Temporarily ignore for runtime testing due to library type complexities
      const userAgentComponent = components['userAgent'] as Component<string> | undefined;
      const uaString = getComponentValue(userAgentComponent);

      if (uaString && typeof uaString === 'string') {
        if (browserName === 'Unknown Browser') {
          const browserMatch = uaString.match(/(Firefox|Chrome|Safari|Edge|MSIE|Trident.*?rv:|Opera)\/([\d\.]+)/i);
          if (browserMatch && browserMatch[1] && browserMatch[2]) {
            browserName = browserMatch[1];
            browserVersion = browserMatch[2].split('.')[0];
          }
        }
        if (osName === 'Unknown OS') {
          if (uaString.includes('Windows')) osName = 'Windows';
          else if (uaString.includes('Mac OS X') || uaString.includes('Macintosh')) osName = 'macOS';
          else if (uaString.includes('Android')) osName = 'Android';
          else if (uaString.includes('Linux') && !uaString.includes('Android')) osName = 'Linux';
          else if (uaString.includes('iPhone') || uaString.includes('iPad')) osName = 'iOS';
        }
      }
      
      // @ts-ignore - Temporarily ignore for runtime testing due to library type complexities
      const platformComponent = components['platform'] as Component<string> | undefined;
      const platformValue = getComponentValue(platformComponent);
      if (osName === 'Unknown OS' && platformValue && typeof platformValue === 'string') {
        if (platformValue.startsWith('Win')) osName = 'Windows';
        else if (platformValue.startsWith('Mac')) osName = 'macOS';
        else if (platformValue.startsWith('Linux')) osName = 'Linux';
      }

      // Example for a structured component (if one existed like 'parsedUserAgent')
      // const parsedUAComponent = components.parsedUserAgent as Component<{ browser: { name: string, version: string }, os: { name: string, version: string }}> | undefined;
      // if (parsedUAComponent && parsedUAComponent.value) {
      //   const uaDetails = parsedUAComponent.value;
      //   if (uaDetails.browser?.name) browserName = uaDetails.browser.name;
      //   if (uaDetails.browser?.version) browserVersion = uaDetails.browser.version.split('.')[0];
      //   if (uaDetails.os?.name) osName = uaDetails.os.name;
      //   if (uaDetails.os?.version) osVersion = uaDetails.os.version.split('.')[0];
      // }
    }

    let description = `${browserName}${browserVersion ? ' ' + browserVersion : ''} on ${osName}${osVersion ? ' ' + osVersion : ''}`.trim();
    if (description === 'Unknown Browser on Unknown OS' || description === 'on' || !description || description === 'Unknown Browser' || description === 'on Unknown OS') {
      description = 'Device details unavailable';
    } else if (description.endsWith(' on')) { 
      description = description.substring(0, description.length - 3);
    }
    
    console.log('[fingerprint.ts] Device description parsing complete. Description:', description, 'Visitor ID:', result.visitorId);

    // fingerprintDataCache = { // Still don't cache during this debug phase
    //   visitorId: result.visitorId,
    //   deviceDescription: description,
    // };
    return {
      visitorId: result.visitorId,
      deviceDescription: description,
    };

  } catch (error) {
    console.error("[fingerprint.ts] Error in getFingerprint (during parsing or earlier steps):", error);
    if (error instanceof Error && (error as any).visitorId) { 
      // This might be relevant if parsing fails but we got a visitorId from a partial error object (less likely)
      fingerprintDataCache = { visitorId: (error as any).visitorId, deviceDescription: 'Device details unavailable (parsing error)' };
      return fingerprintDataCache;
    }
    throw new Error("Could not generate device fingerprint (full parsing). Original error: " + (error instanceof Error ? error.message : String(error)));
  }
}; 