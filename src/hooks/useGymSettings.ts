import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface GymSettings {
  cancellationHoursThreshold: number;
  creditExpiryDays: number;
  minRentalDuration: number;
  maxAdvanceBookingDays: number;
}

const DEFAULT_SETTINGS: GymSettings = {
  cancellationHoursThreshold: 24,
  creditExpiryDays: 90,
  minRentalDuration: 60,
  maxAdvanceBookingDays: 30,
};

export const useGymSettings = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['gym-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gym_settings')
        .select('key, value');

      if (error) throw error;

      const settingsMap = data.reduce((acc, s) => {
        acc[s.key] = s.value;
        return acc;
      }, {} as Record<string, string>);

      return {
        cancellationHoursThreshold: parseInt(settingsMap.cancellation_hours_threshold || '24'),
        creditExpiryDays: parseInt(settingsMap.credit_expiry_days || '90'),
        minRentalDuration: parseInt(settingsMap.min_rental_duration || '60'),
        maxAdvanceBookingDays: parseInt(settingsMap.max_advance_booking_days || '30'),
      } as GymSettings;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return {
    settings: data || DEFAULT_SETTINGS,
    isLoading,
    error,
  };
};

// Helper to get a single setting (useful for mutations)
export const getGymSetting = async (key: string, defaultValue: string): Promise<string> => {
  const { data, error } = await supabase
    .from('gym_settings')
    .select('value')
    .eq('key', key)
    .single();

  if (error || !data) return defaultValue;
  return data.value;
};
