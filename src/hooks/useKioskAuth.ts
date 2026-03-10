import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const KIOSK_AUTH_KEY = 'kiosk_authenticated';
const KIOSK_AUTH_TIMESTAMP_KEY = 'kiosk_auth_timestamp';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Check session immediately (not in useEffect) to avoid race conditions
const checkInitialSession = (): boolean => {
  try {
    const authenticated = localStorage.getItem(KIOSK_AUTH_KEY);
    const timestamp = localStorage.getItem(KIOSK_AUTH_TIMESTAMP_KEY);

    if (authenticated === 'true' && timestamp) {
      const authTime = parseInt(timestamp, 10);
      const now = Date.now();

      if (now - authTime < SESSION_DURATION_MS) {
        return true;
      } else {
        // Session expired - clean up
        localStorage.removeItem(KIOSK_AUTH_KEY);
        localStorage.removeItem(KIOSK_AUTH_TIMESTAMP_KEY);
      }
    }
  } catch (e) {
    console.error('Error checking kiosk session:', e);
  }
  return false;
};

interface UseKioskAuthReturn {
  isAuthenticated: boolean;
  isValidating: boolean;
  validatePin: (pin: string) => Promise<boolean>;
  logout: () => void;
}

export const useKioskAuth = (): UseKioskAuthReturn => {
  // Initialize from localStorage immediately to avoid flash/race conditions
  const [isAuthenticated, setIsAuthenticated] = useState(() => checkInitialSession());
  const [isValidating, setIsValidating] = useState(false);

  const validatePin = useCallback(async (pin: string): Promise<boolean> => {
    if (!pin || pin.length < 4) {
      console.warn('PIN validation: PIN too short', { length: pin?.length });
      return false;
    }

    setIsValidating(true);
    console.log('Validating kiosk PIN...', { pinLength: pin.length });

    try {
      // Call the database function to validate PIN
      const { data, error } = await supabase.rpc('validate_kiosk_pin', {
        input_pin: pin,
      });

      console.log('PIN validation response:', { data, error: error?.message });

      if (error) {
        console.error('Error validating PIN:', error);
        return false;
      }

      const isValid = data === true;
      console.log('PIN validation result:', { isValid });

      if (isValid) {
        // Store auth state in localStorage
        localStorage.setItem(KIOSK_AUTH_KEY, 'true');
        localStorage.setItem(KIOSK_AUTH_TIMESTAMP_KEY, Date.now().toString());
        setIsAuthenticated(true);
        console.log('Kiosk authenticated successfully');
      }

      return isValid;
    } catch (error) {
      console.error('Exception validating PIN:', error);
      return false;
    } finally {
      setIsValidating(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(KIOSK_AUTH_KEY);
    localStorage.removeItem(KIOSK_AUTH_TIMESTAMP_KEY);
    setIsAuthenticated(false);
  }, []);

  return {
    isAuthenticated,
    isValidating,
    validatePin,
    logout,
  };
};
