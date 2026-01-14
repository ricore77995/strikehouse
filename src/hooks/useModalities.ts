import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Modality } from '@/types/pricing';

export const useModalities = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['modalities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('modalities')
        .select('*')
        .eq('ativo', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as Modality[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return {
    modalities: data || [],
    isLoading,
    error,
  };
};

export const useAllModalities = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['modalities', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('modalities')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as Modality[];
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    modalities: data || [],
    isLoading,
    error,
  };
};

export const useCreateModality = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (modality: Omit<Modality, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('modalities')
        .insert(modality)
        .select()
        .single();

      if (error) throw error;
      return data as Modality;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modalities'] });
    },
  });
};

export const useUpdateModality = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<Modality, 'id' | 'created_at'>>;
    }) => {
      const { data, error } = await supabase
        .from('modalities')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Modality;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modalities'] });
    },
  });
};

export const useDeleteModality = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete - just set ativo to false
      const { error } = await supabase
        .from('modalities')
        .update({ ativo: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modalities'] });
    },
  });
};
