import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const KIOSK_AUTH_KEY = 'kiosk_authenticated';
const KIOSK_AUTH_TIMESTAMP_KEY = 'kiosk_auth_timestamp';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface UseKioskAuthReturn {
  isAuthenticated: boolean;
  isValidating: boolean;
  validatePin: (pin: string) => Promise<boolean>;
  logout: () => void;
}

export const useKioskAuth = (): UseKioskAuthReturn => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Check if session is still valid on mount
  useEffect(() => {
    const checkSession = () => {
      const authenticated = localStorage.getItem(KIOSK_AUTH_KEY);
      const timestamp = localStorage.getItem(KIOSK_AUTH_TIMESTAMP_KEY);

      if (authenticated === 'true' && timestamp) {
        const authTime = parseInt(timestamp, 10);
        const now = Date.now();

        if (now - authTime < SESSION_DURATION_MS) {
          setIsAuthenticated(true);
        } else {
          // Session expired
          localStorage.removeItem(KIOSK_AUTH_KEY);
          localStorage.removeItem(KIOSK_AUTH_TIMESTAMP_KEY);
          setIsAuthenticated(false);
        }
      }
    };

    checkSession();
  }, []);

  const validatePin = useCallback(async (pin: string): Promise<boolean> => {
    if (!pin || pin.length < 4) {
      return false;
    }

    setIsValidating(true);

    try {
      // Call the database function to validate PIN
      const { data, error } = await supabase.rpc('validate_kiosk_pin', {
        input_pin: pin,
      });

      if (error) {
        console.error('Error validating PIN:', error);
        return false;
      }

      const isValid = data === true;

      if (isValid) {
        // Store auth state in localStorage
        localStorage.setItem(KIOSK_AUTH_KEY, 'true');
        localStorage.setItem(KIOSK_AUTH_TIMESTAMP_KEY, Date.now().toString());
        setIsAuthenticated(true);
      }

      return isValid;
    } catch (error) {
      console.error('Error validating PIN:', error);
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
