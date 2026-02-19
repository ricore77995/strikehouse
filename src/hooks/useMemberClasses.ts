import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MemberClassEnrollment {
  id: string;
  member_id: string;
  class_id: string;
  enrolled_at: string | null;
  dropped_at: string | null;
  status: string | null;
  created_by: string | null;
  class?: {
    id: string;
    nome: string;
    modalidade: string;
    dia_semana: number;
    hora_inicio: string;
    duracao_min: number;
  };
}

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * Format class schedule for display
 * Example: "Muay Thai - Ter/Qui 19:30"
 */
export const formatClassSchedule = (classData: MemberClassEnrollment['class']) => {
  if (!classData) return '';
  const day = DAYS_PT[classData.dia_semana];
  const time = classData.hora_inicio?.slice(0, 5) || '';
  return `${classData.modalidade} - ${day} ${time}`;
};

/**
 * Hook to fetch class enrollments for a specific member
 */
export const useMemberClasses = (memberId: string | null | undefined) => {
  return useQuery({
    queryKey: ['member-classes', memberId],
    queryFn: async () => {
      if (!memberId) return [];

      const { data, error } = await supabase
        .from('member_class_enrollments')
        .select(`
          id,
          member_id,
          class_id,
          enrolled_at,
          dropped_at,
          status,
          created_by,
          class:classes(id, nome, modalidade, dia_semana, hora_inicio, duracao_min)
        `)
        .eq('member_id', memberId)
        .eq('status', 'active');

      if (error) throw error;
      return data as MemberClassEnrollment[];
    },
    enabled: !!memberId,
  });
};

/**
 * Hook to set class enrollments for a member (replaces all existing)
 */
export const useSetMemberClasses = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      memberId,
      classIds,
      staffId,
    }: {
      memberId: string;
      classIds: string[];
      staffId?: string;
    }) => {
      // Mark enrollments NOT in the new list as dropped
      await supabase
        .from('member_class_enrollments')
        .update({
          status: 'dropped',
          dropped_at: new Date().toISOString()
        })
        .eq('member_id', memberId)
        .eq('status', 'active')
        .not('class_id', 'in', `(${classIds.join(',')})`);

      // Upsert new enrollments (reactivate if dropped, insert if new)
      if (classIds.length > 0) {
        const rows = classIds.map((classId) => ({
          member_id: memberId,
          class_id: classId,
          created_by: staffId || null,
          status: 'active' as const,
          enrolled_at: new Date().toISOString(),
          dropped_at: null,
        }));

        const { error } = await supabase
          .from('member_class_enrollments')
          .upsert(rows, {
            onConflict: 'member_id,class_id',
            ignoreDuplicates: false
          });

        if (error) throw error;
      }

      return { memberId, classIds };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['member-classes', variables.memberId],
      });
    },
  });
};

/**
 * Hook to enroll a member in a class
 */
export const useEnrollInClass = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      memberId,
      classId,
      staffId,
    }: {
      memberId: string;
      classId: string;
      staffId?: string;
    }) => {
      // Check if already enrolled
      const { data: existing } = await supabase
        .from('member_class_enrollments')
        .select('id, status')
        .eq('member_id', memberId)
        .eq('class_id', classId)
        .single();

      if (existing) {
        // Reactivate if dropped
        if (existing.status === 'dropped') {
          const { error } = await supabase
            .from('member_class_enrollments')
            .update({
              status: 'active',
              dropped_at: null,
              enrolled_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (error) throw error;
        }
        // Already active, do nothing
      } else {
        // Insert new enrollment
        const { error } = await supabase
          .from('member_class_enrollments')
          .insert({
            member_id: memberId,
            class_id: classId,
            created_by: staffId || null,
            status: 'active',
          });

        if (error) throw error;
      }

      return { memberId, classId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['member-classes', variables.memberId],
      });
    },
  });
};

/**
 * Hook to drop a member from a class
 */
export const useDropFromClass = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      memberId,
      classId,
    }: {
      memberId: string;
      classId: string;
    }) => {
      const { error } = await supabase
        .from('member_class_enrollments')
        .update({
          status: 'dropped',
          dropped_at: new Date().toISOString()
        })
        .eq('member_id', memberId)
        .eq('class_id', classId)
        .eq('status', 'active');

      if (error) throw error;

      return { memberId, classId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['member-classes', variables.memberId],
      });
    },
  });
};

/**
 * Hook to fetch all members enrolled in a specific class
 */
export const useClassMembers = (classId: string | null | undefined) => {
  return useQuery({
    queryKey: ['class-members', classId],
    queryFn: async () => {
      if (!classId) return [];

      const { data, error } = await supabase
        .from('member_class_enrollments')
        .select(`
          id,
          member_id,
          enrolled_at,
          member:members(id, nome, telefone, email, status)
        `)
        .eq('class_id', classId)
        .eq('status', 'active');

      if (error) throw error;
      return data;
    },
    enabled: !!classId,
  });
};

/**
 * Hook to fetch all active classes
 */
export const useClasses = () => {
  return useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('ativo', true)
        .order('dia_semana')
        .order('hora_inicio');

      if (error) throw error;
      return data;
    },
  });
};

/**
 * Hook to fetch classes filtered by modality
 */
export const useClassesByModality = (modality: string | null | undefined) => {
  return useQuery({
    queryKey: ['classes-by-modality', modality],
    queryFn: async () => {
      if (!modality) return [];

      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('ativo', true)
        .ilike('modalidade', `%${modality}%`)
        .order('dia_semana')
        .order('hora_inicio');

      if (error) throw error;
      return data;
    },
    enabled: !!modality,
  });
};
