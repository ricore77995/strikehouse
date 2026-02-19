import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MemberModality {
  member_id: string;
  modality_id: string;
  enrolled_at: string | null;
  modality?: {
    id: string;
    code: string;
    nome: string;
  };
}

/**
 * Hook to fetch modalities for a specific member
 */
export const useMemberModalities = (memberId: string | null | undefined) => {
  return useQuery({
    queryKey: ['member-modalities', memberId],
    queryFn: async () => {
      if (!memberId) return [];

      const { data, error } = await supabase
        .from('member_modalities')
        .select(`
          member_id,
          modality_id,
          enrolled_at,
          modality:modalities(id, code, nome)
        `)
        .eq('member_id', memberId);

      if (error) throw error;
      return data as MemberModality[];
    },
    enabled: !!memberId,
  });
};

/**
 * Hook to set modalities for a member (replaces all existing)
 */
export const useSetMemberModalities = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      memberId,
      modalityIds,
    }: {
      memberId: string;
      modalityIds: string[];
    }) => {
      // Delete modalities NOT in the new list
      if (modalityIds.length > 0) {
        await supabase
          .from('member_modalities')
          .delete()
          .eq('member_id', memberId)
          .not('modality_id', 'in', `(${modalityIds.join(',')})`);
      } else {
        // If empty, delete all
        await supabase
          .from('member_modalities')
          .delete()
          .eq('member_id', memberId);
      }

      // Upsert new modalities
      if (modalityIds.length > 0) {
        const rows = modalityIds.map((modalityId) => ({
          member_id: memberId,
          modality_id: modalityId,
        }));

        const { error } = await supabase
          .from('member_modalities')
          .upsert(rows, {
            onConflict: 'member_id,modality_id',
            ignoreDuplicates: true
          });

        if (error) throw error;
      }

      return { memberId, modalityIds };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['member-modalities', variables.memberId],
      });
    },
  });
};

/**
 * Hook to add a single modality to a member
 */
export const useAddMemberModality = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      memberId,
      modalityId,
    }: {
      memberId: string;
      modalityId: string;
    }) => {
      const { error } = await supabase
        .from('member_modalities')
        .insert({ member_id: memberId, modality_id: modalityId });

      if (error) {
        // Ignore duplicate key error (member already has this modality)
        if (error.code !== '23505') throw error;
      }

      return { memberId, modalityId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['member-modalities', variables.memberId],
      });
    },
  });
};

/**
 * Hook to remove a modality from a member
 */
export const useRemoveMemberModality = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      memberId,
      modalityId,
    }: {
      memberId: string;
      modalityId: string;
    }) => {
      const { error } = await supabase
        .from('member_modalities')
        .delete()
        .eq('member_id', memberId)
        .eq('modality_id', modalityId);

      if (error) throw error;

      return { memberId, modalityId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['member-modalities', variables.memberId],
      });
    },
  });
};

/**
 * Hook to fetch all members enrolled in a specific modality
 */
export const useModalityMembers = (modalityId: string | null | undefined) => {
  return useQuery({
    queryKey: ['modality-members', modalityId],
    queryFn: async () => {
      if (!modalityId) return [];

      const { data, error } = await supabase
        .from('member_modalities')
        .select(`
          member_id,
          modality_id,
          enrolled_at,
          member:members(id, nome, telefone, email, status)
        `)
        .eq('modality_id', modalityId);

      if (error) throw error;
      return data;
    },
    enabled: !!modalityId,
  });
};
