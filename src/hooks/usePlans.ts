import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Plan } from '@/types/pricing';

/**
 * Hook to fetch visible and active plans for enrollment/payment selection
 */
export const usePlans = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['plans', 'visible'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('ativo', true)
        .eq('visible', true)
        .order('preco_cents', { ascending: true });

      if (error) throw error;
      return data as Plan[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return {
    plans: data || [],
    isLoading,
    error,
  };
};

/**
 * Hook to fetch all plans (for admin)
 */
export const useAllPlans = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['plans', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Plan[];
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    plans: data || [],
    isLoading,
    error,
  };
};
