import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const GA_MEASUREMENT_ID = 'G-TTSKRR4PP2';

// Public routes where Google Analytics should be active
const PUBLIC_ROUTES = ['/', '/team', '/membership', '/login'];

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export function GoogleAnalytics() {
  const location = useLocation();

  const isPublicRoute = () => {
    // Check exact matches
    if (PUBLIC_ROUTES.includes(location.pathname)) return true;
    // Check /m/:qrCode pattern
    if (location.pathname.startsWith('/m/')) return true;
    return false;
  };

  useEffect(() => {
    if (!isPublicRoute()) return;

    // Check if script already loaded
    if (document.querySelector(`script[src*="googletagmanager.com/gtag/js"]`)) {
      // Script exists, just send page view
      if (window.gtag) {
        window.gtag('config', GA_MEASUREMENT_ID, {
          page_path: location.pathname + location.search,
        });
      }
      return;
    }

    // Initialize dataLayer
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID);

    // Load gtag.js script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);
  }, [location.pathname]);

  return null;
}
