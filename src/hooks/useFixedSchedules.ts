import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type MemberFixedSchedule = Database['public']['Tables']['member_fixed_schedules']['Row'];

export interface FixedScheduleWithClass extends MemberFixedSchedule {
  classes: {
    id: string;
    nome: string;
    modalidade: string;
    dia_semana: number;
    hora_inicio: string;
    duracao_min: number;
    external_coaches?: {
      nome: string;
    } | null;
  };
}

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/**
 * Get all fixed schedules for a member
 */
export function useMemberFixedSchedules(memberId: string | null) {
  return useQuery({
    queryKey: ['member-fixed-schedules', memberId],
    queryFn: async () => {
      if (!memberId) return [];

      const { data, error } = await supabase
        .from('member_fixed_schedules')
        .select(`
          *,
          classes (
            id,
            nome,
            modalidade,
            dia_semana,
            hora_inicio,
            duracao_min,
            external_coaches (nome)
          )
        `)
        .eq('member_id', memberId)
        .eq('active', true)
        .order('classes(dia_semana)', { ascending: true })
        .order('classes(hora_inicio)', { ascending: true });

      if (error) throw error;
      return data as FixedScheduleWithClass[];
    },
    enabled: !!memberId,
  });
}

/**
 * Get all members with fixed schedules for a specific class
 */
export function useClassFixedMembers(classId: string | null) {
  return useQuery({
    queryKey: ['class-fixed-members', classId],
    queryFn: async () => {
      if (!classId) return [];

      const { data, error } = await supabase
        .from('member_fixed_schedules')
        .select(`
          *,
          members (id, nome, telefone, qr_code)
        `)
        .eq('class_id', classId)
        .eq('active', true);

      if (error) throw error;
      return data;
    },
    enabled: !!classId,
  });
}

/**
 * Set fixed schedules for a member (replaces all existing)
 */
export function useSetMemberFixedSchedules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      memberId,
      classIds,
      createdBy,
    }: {
      memberId: string;
      classIds: string[];
      createdBy: string | null;
    }) => {
      // Get current active schedules
      const { data: existing, error: fetchError } = await supabase
        .from('member_fixed_schedules')
        .select('id, class_id')
        .eq('member_id', memberId)
        .eq('active', true);

      if (fetchError) throw fetchError;

      const existingClassIds = existing?.map((s) => s.class_id) || [];
      const toAdd = classIds.filter((id) => !existingClassIds.includes(id));
      const toDeactivate = existing?.filter((s) => !classIds.includes(s.class_id)).map((s) => s.id) || [];

      // Deactivate removed schedules
      if (toDeactivate.length > 0) {
        const { error: deactivateError } = await supabase
          .from('member_fixed_schedules')
          .update({
            active: false,
            deactivated_at: new Date().toISOString(),
            deactivated_by: createdBy,
          })
          .in('id', toDeactivate);

        if (deactivateError) throw deactivateError;
      }

      // Add new schedules (upsert to handle reactivation)
      if (toAdd.length > 0) {
        const { error: insertError } = await supabase
          .from('member_fixed_schedules')
          .upsert(
            toAdd.map((classId) => ({
              member_id: memberId,
              class_id: classId,
              active: true,
              created_by: createdBy,
              deactivated_at: null,
              deactivated_by: null,
            })),
            { onConflict: 'member_id,class_id' }
          );

        if (insertError) throw insertError;
      }

      return { added: toAdd.length, removed: toDeactivate.length };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['member-fixed-schedules', variables.memberId] });
      queryClient.invalidateQueries({ queryKey: ['class-fixed-members'] });
    },
  });
}

/**
 * Add a single fixed schedule for a member
 */
export function useAddFixedSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      memberId,
      classId,
      createdBy,
    }: {
      memberId: string;
      classId: string;
      createdBy: string;
    }) => {
      const { data, error } = await supabase
        .from('member_fixed_schedules')
        .upsert(
          {
            member_id: memberId,
            class_id: classId,
            active: true,
            created_by: createdBy,
            deactivated_at: null,
            deactivated_by: null,
          },
          { onConflict: 'member_id,class_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['member-fixed-schedules', variables.memberId] });
      queryClient.invalidateQueries({ queryKey: ['class-fixed-members', variables.classId] });
    },
  });
}

/**
 * Remove a fixed schedule for a member
 */
export function useRemoveFixedSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      memberId,
      classId,
      deactivatedBy,
    }: {
      memberId: string;
      classId: string;
      deactivatedBy: string;
    }) => {
      const { data, error } = await supabase
        .from('member_fixed_schedules')
        .update({
          active: false,
          deactivated_at: new Date().toISOString(),
          deactivated_by: deactivatedBy,
        })
        .eq('member_id', memberId)
        .eq('class_id', classId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['member-fixed-schedules', variables.memberId] });
      queryClient.invalidateQueries({ queryKey: ['class-fixed-members', variables.classId] });
    },
  });
}

/**
 * Helper to format fixed schedule for display
 */
export function formatFixedSchedule(schedule: FixedScheduleWithClass): string {
  const dia = DIAS_SEMANA[schedule.classes.dia_semana];
  const hora = schedule.classes.hora_inicio.slice(0, 5);
  return `${dia} ${hora} - ${schedule.classes.nome}`;
}
