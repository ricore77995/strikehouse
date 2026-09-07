import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const GA_MEASUREMENT_ID = 'G-TTSKRR4PP2';

/**
 * Back-office areas, which must not be measured. This is a blocklist on purpose: the
 * previous allowlist of four paths silently left every other public page untracked —
 * /comunidade, /corporate, /loja, /faq and the legal pages were all invisible, while
 * /membership was tracked despite being only a redirect.
 */
const PRIVATE_PREFIXES = ['/admin', '/staff', '/owner', '/partner', '/coach', '/kiosk'];

function isPublicRoute(pathname: string): boolean {
  return !PRIVATE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export function GoogleAnalytics() {
  const location = useLocation();

  useEffect(() => {
    // Only track in production
    if (!import.meta.env.PROD) return;

    if (!isPublicRoute(location.pathname)) return;

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

    // Initialize dataLayer. `arguments` is deliberate: this is Google's canonical
    // gtag shim, and gtag.js expects the arguments object rather than an array.
    window.dataLayer = window.dataLayer || [];
    // eslint-disable-next-line prefer-rest-params
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID);

    // Load gtag.js script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);
  }, [location.pathname, location.search]);

  return null;
}
