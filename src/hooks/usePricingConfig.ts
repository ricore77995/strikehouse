import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PricingConfig } from '@/types/pricing';

const DEFAULT_CONFIG: PricingConfig = {
  id: '',
  base_price_cents: 6000,
  extra_modality_price_cents: 3000,
  single_class_price_cents: 1500,
  day_pass_price_cents: 2500,
  enrollment_fee_cents: 1500,
  currency: 'EUR',
  updated_at: new Date().toISOString(),
  updated_by: null,
};

export const usePricingConfig = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['pricing-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_config')
        .select('*')
        .single();

      if (error) throw error;
      return data as PricingConfig;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return {
    config: data || DEFAULT_CONFIG,
    isLoading,
    error,
  };
};

export const useUpdatePricingConfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<Omit<PricingConfig, 'id' | 'updated_at'>> & { id: string }) => {
      const { id, ...updateData } = updates;

      const { data, error, count } = await supabase
        .from('pricing_config')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Verify the update actually happened by checking returned values
      const returnedData = data as PricingConfig;
      const keysToCheck = Object.keys(updateData) as (keyof typeof updateData)[];
      for (const key of keysToCheck) {
        if (updateData[key] !== undefined && returnedData[key] !== updateData[key]) {
          console.error(`Update verification failed: ${key} expected ${updateData[key]} but got ${returnedData[key]}`);
          throw new Error(`Atualizacao falhou: ${key} nao foi salvo. Verifique permissoes.`);
        }
      }

      return returnedData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-config'] });
    },
  });
};
