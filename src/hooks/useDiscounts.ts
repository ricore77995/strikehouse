import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Discount, PromoCodeValidation } from '@/types/pricing';
import { validatePromoCode as validatePromoCodeFn } from '@/lib/pricing-engine';

export const useDiscounts = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['discounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discounts')
        .select('*')
        .eq('ativo', true)
        .order('category', { ascending: true })
        .order('min_commitment_months', { ascending: true });

      if (error) throw error;
      return data as Discount[];
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    discounts: data || [],
    isLoading,
    error,
  };
};

export const useCommitmentDiscounts = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['discounts', 'commitment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discounts')
        .select('*')
        .eq('category', 'commitment')
        .eq('ativo', true)
        .order('min_commitment_months', { ascending: true });

      if (error) throw error;
      return data as Discount[];
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    discounts: data || [],
    isLoading,
    error,
  };
};

export const usePromoDiscounts = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['discounts', 'promo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discounts')
        .select('*')
        .eq('category', 'promo')
        .eq('ativo', true)
        .order('code', { ascending: true });

      if (error) throw error;
      return data as Discount[];
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    discounts: data || [],
    isLoading,
    error,
  };
};

export const useAllDiscounts = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['discounts', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discounts')
        .select('*')
        .order('category', { ascending: true })
        .order('min_commitment_months', { ascending: true });

      if (error) throw error;
      return data as Discount[];
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    discounts: data || [],
    isLoading,
    error,
  };
};

export const useValidatePromoCode = () => {
  const { discounts } = useDiscounts();

  return (code: string, memberStatus: string): PromoCodeValidation => {
    return validatePromoCodeFn(code, discounts, memberStatus);
  };
};

export const useCreateDiscount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (discount: Omit<Discount, 'id' | 'created_at' | 'current_uses'>) => {
      const { data, error } = await supabase
        .from('discounts')
        .insert({ ...discount, current_uses: 0 })
        .select()
        .single();

      if (error) throw error;
      return data as Discount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
    },
  });
};

export const useUpdateDiscount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<Discount, 'id' | 'created_at'>>;
    }) => {
      const { data, error } = await supabase
        .from('discounts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Discount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
    },
  });
};

export const useIncrementDiscountUses = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // First get current uses
      const { data: current, error: fetchError } = await supabase
        .from('discounts')
        .select('current_uses')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Increment
      const { data, error } = await supabase
        .from('discounts')
        .update({ current_uses: (current?.current_uses || 0) + 1 })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Discount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
    },
  });
};

export const useDeleteDiscount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete - just set ativo to false
      const { error } = await supabase
        .from('discounts')
        .update({ ativo: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
    },
  });
};
