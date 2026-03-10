import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type ClassBooking = Database['public']['Tables']['class_bookings']['Row'];
type ClassBookingInsert = Database['public']['Tables']['class_bookings']['Insert'];

export interface ClassBookingWithDetails extends ClassBooking {
  classes: {
    id: string;
    nome: string;
    modalidade: string;
    dia_semana: number;
    hora_inicio: string;
    duracao_min: number;
    capacidade: number | null;
    external_coaches?: {
      nome: string;
    } | null;
  };
  members?: {
    id: string;
    nome: string;
    telefone: string;
    qr_code: string;
  };
}

/**
 * Get all bookings for a specific class on a specific date
 */
export function useClassBookings(classId: string | null, classDate: string | null) {
  return useQuery({
    queryKey: ['class-bookings', classId, classDate],
    queryFn: async () => {
      if (!classId || !classDate) return [];

      const { data, error } = await supabase
        .from('class_bookings')
        .select(`
          *,
          members (id, nome, telefone, qr_code)
        `)
        .eq('class_id', classId)
        .eq('class_date', classDate)
        .order('booked_at', { ascending: true });

      if (error) throw error;
      return data as (ClassBooking & { members: { id: string; nome: string; telefone: string; qr_code: string } })[];
    },
    enabled: !!classId && !!classDate,
  });
}

/**
 * Get booking count for a class instance (for capacity check)
 */
export function useBookingCount(classId: string | null, classDate: string | null) {
  return useQuery({
    queryKey: ['booking-count', classId, classDate],
    queryFn: async () => {
      if (!classId || !classDate) return 0;

      const { count, error } = await supabase
        .from('class_bookings')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', classId)
        .eq('class_date', classDate)
        .in('status', ['BOOKED', 'CHECKED_IN']);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!classId && !!classDate,
  });
}

/**
 * Create a new booking
 */
export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (booking: {
      classId: string;
      memberId: string;
      classDate: string;
      createdBy?: string;
    }) => {
      const { data, error } = await supabase
        .from('class_bookings')
        .insert({
          class_id: booking.classId,
          member_id: booking.memberId,
          class_date: booking.classDate,
          created_by: booking.createdBy || null,
          status: 'BOOKED',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['class-bookings', data.class_id, data.class_date] });
      queryClient.invalidateQueries({ queryKey: ['booking-count', data.class_id, data.class_date] });
      queryClient.invalidateQueries({ queryKey: ['member-bookings'] });
    },
  });
}

/**
 * Cancel a booking (must be 2+ hours before class)
 */
export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookingId,
      classDate,
      classStartTime,
    }: {
      bookingId: string;
      classDate: string;
      classStartTime: string;
    }) => {
      // Check if cancellation is allowed (2 hours before)
      const classDateTime = new Date(`${classDate}T${classStartTime}`);
      const now = new Date();
      const hoursUntilClass = (classDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilClass < 2) {
        throw new Error('Não é possível cancelar com menos de 2 horas de antecedência');
      }

      const { data, error } = await supabase
        .from('class_bookings')
        .update({
          status: 'CANCELLED',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', bookingId)
        .eq('status', 'BOOKED')
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['class-bookings', data.class_id, data.class_date] });
      queryClient.invalidateQueries({ queryKey: ['booking-count', data.class_id, data.class_date] });
      queryClient.invalidateQueries({ queryKey: ['member-bookings'] });
    },
  });
}

/**
 * Mark a booking as checked in
 */
export function useCheckInBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await supabase
        .from('class_bookings')
        .update({
          status: 'CHECKED_IN',
          checked_in_at: new Date().toISOString(),
        })
        .eq('id', bookingId)
        .eq('status', 'BOOKED')
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['class-bookings', data.class_id, data.class_date] });
      queryClient.invalidateQueries({ queryKey: ['member-bookings'] });
    },
  });
}

/**
 * Check if a member can book (not blocked)
 */
export function useCanMemberBook(memberId: string | null) {
  return useQuery({
    queryKey: ['can-member-book', memberId],
    queryFn: async () => {
      if (!memberId) return false;

      const { data, error } = await supabase
        .from('members')
        .select('booking_blocked_until')
        .eq('id', memberId)
        .single();

      if (error) throw error;

      if (!data.booking_blocked_until) return true;

      const blockedUntil = new Date(data.booking_blocked_until);
      return blockedUntil < new Date();
    },
    enabled: !!memberId,
  });
}
