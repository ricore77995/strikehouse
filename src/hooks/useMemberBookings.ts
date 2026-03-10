import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type ClassBooking = Database['public']['Tables']['class_bookings']['Row'];

export interface MemberBookingWithClass extends ClassBooking {
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

/**
 * Get all bookings for a member (upcoming and recent)
 */
export function useMemberBookings(memberId: string | null, options?: { includePast?: boolean }) {
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['member-bookings', memberId, options?.includePast],
    queryFn: async () => {
      if (!memberId) return [];

      let query = supabase
        .from('class_bookings')
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
        .order('class_date', { ascending: true });

      if (!options?.includePast) {
        query = query.gte('class_date', today);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as MemberBookingWithClass[];
    },
    enabled: !!memberId,
  });
}

/**
 * Get upcoming bookings for a member (today and future, BOOKED status only)
 */
export function useUpcomingBookings(memberId: string | null) {
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['member-upcoming-bookings', memberId],
    queryFn: async () => {
      if (!memberId) return [];

      const { data, error } = await supabase
        .from('class_bookings')
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
        .gte('class_date', today)
        .in('status', ['BOOKED', 'CHECKED_IN'])
        .order('class_date', { ascending: true })
        .order('classes(hora_inicio)', { ascending: true });

      if (error) throw error;
      return data as MemberBookingWithClass[];
    },
    enabled: !!memberId,
  });
}

/**
 * Get today's bookings for a member
 */
export function useTodaysBookings(memberId: string | null) {
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['member-todays-bookings', memberId],
    queryFn: async () => {
      if (!memberId) return [];

      const { data, error } = await supabase
        .from('class_bookings')
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
        .eq('class_date', today)
        .in('status', ['BOOKED', 'CHECKED_IN'])
        .order('classes(hora_inicio)', { ascending: true });

      if (error) throw error;
      return data as MemberBookingWithClass[];
    },
    enabled: !!memberId,
  });
}

/**
 * Check if member already has a booking for a specific class/date
 */
export function useMemberHasBooking(memberId: string | null, classId: string | null, classDate: string | null) {
  return useQuery({
    queryKey: ['member-has-booking', memberId, classId, classDate],
    queryFn: async () => {
      if (!memberId || !classId || !classDate) return false;

      const { count, error } = await supabase
        .from('class_bookings')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', memberId)
        .eq('class_id', classId)
        .eq('class_date', classDate)
        .in('status', ['BOOKED', 'CHECKED_IN']);

      if (error) throw error;
      return (count || 0) > 0;
    },
    enabled: !!memberId && !!classId && !!classDate,
  });
}

/**
 * Get available classes for booking (for a specific date)
 * Returns classes with their booking counts
 */
export function useAvailableClasses(date: string | null) {
  // Get day of week from date (0 = Sunday, 1 = Monday, etc.)
  const dayOfWeek = date ? new Date(date).getDay() : null;

  return useQuery({
    queryKey: ['available-classes', date],
    queryFn: async () => {
      if (!date || dayOfWeek === null) return [];

      // Get all active classes for this day of week
      const { data: classes, error: classesError } = await supabase
        .from('classes')
        .select(`
          id,
          nome,
          modalidade,
          dia_semana,
          hora_inicio,
          duracao_min,
          capacidade,
          external_coaches (nome)
        `)
        .eq('dia_semana', dayOfWeek)
        .eq('ativo', true)
        .order('hora_inicio', { ascending: true });

      if (classesError) throw classesError;
      if (!classes) return [];

      // Get booking counts for each class
      const { data: bookings, error: bookingsError } = await supabase
        .from('class_bookings')
        .select('class_id')
        .eq('class_date', date)
        .in('status', ['BOOKED', 'CHECKED_IN']);

      if (bookingsError) throw bookingsError;

      // Count bookings per class
      const bookingCounts: Record<string, number> = {};
      bookings?.forEach((b) => {
        bookingCounts[b.class_id] = (bookingCounts[b.class_id] || 0) + 1;
      });

      return classes.map((c) => ({
        ...c,
        bookingCount: bookingCounts[c.id] || 0,
        spotsAvailable: c.capacidade ? c.capacidade - (bookingCounts[c.id] || 0) : null,
        isFull: c.capacidade ? (bookingCounts[c.id] || 0) >= c.capacidade : false,
      }));
    },
    enabled: !!date && dayOfWeek !== null,
  });
}
