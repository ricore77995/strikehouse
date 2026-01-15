import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MemberCheckinInfo {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  status: string;
  access_type: string | null;
  access_expires_at: string | null;
  credits_remaining: number | null;
  qr_code: string;
}

export interface CheckinResult {
  success: boolean;
  result: 'ALLOWED' | 'BLOCKED' | 'EXPIRED' | 'NO_CREDITS' | 'NOT_FOUND' | 'AREA_EXCLUSIVE';
  member?: MemberCheckinInfo;
  message: string;
  rentalInfo?: {
    coachName: string;
    areaName: string;
    endTime: string;
  };
}

// Mapeia resultados estendidos para valores válidos no banco de dados
// NOT_FOUND e AREA_EXCLUSIVE são mapeados para BLOCKED no banco
// A mensagem correta já é mostrada na UI via CheckinResult.message
const mapToDatabaseResult = (
  result: CheckinResult['result']
): 'ALLOWED' | 'BLOCKED' | 'EXPIRED' | 'NO_CREDITS' => {
  if (result === 'NOT_FOUND' || result === 'AREA_EXCLUSIVE') {
    return 'BLOCKED';
  }
  return result as 'ALLOWED' | 'BLOCKED' | 'EXPIRED' | 'NO_CREDITS';
};

export const useCheckin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const findMemberByQR = async (qrCode: string): Promise<MemberCheckinInfo | null> => {
    // Usa função RPC para bypass RLS (permite acesso do quiosque sem auth)
    const { data, error } = await supabase
      .rpc('get_member_by_qr', { qr_code_input: qrCode });

    if (error || !data || data.length === 0) {
      console.log('[QR] RPC error or no data:', error);
      return null;
    }
    return data[0] as MemberCheckinInfo;
  };

  const findMemberBySearch = async (query: string): Promise<MemberCheckinInfo[]> => {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .or(`nome.ilike.%${query}%,telefone.ilike.%${query}%`)
      .limit(10);

    if (error || !data) return [];
    return data as MemberCheckinInfo[];
  };

  const validateAccess = (member: MemberCheckinInfo): CheckinResult => {
    // Check if member is blocked or cancelled
    if (member.status === 'BLOQUEADO') {
      return {
        success: false,
        result: 'BLOCKED',
        member,
        message: 'Membro bloqueado. Entre em contato com a recepção.',
      };
    }

    if (member.status === 'CANCELADO') {
      return {
        success: false,
        result: 'BLOCKED',
        member,
        message: 'Membro cancelado. Entre em contato com a recepção.',
      };
    }

    // Check if subscription is frozen/paused (Gap 3)
    if (member.status === 'PAUSADO') {
      return {
        success: false,
        result: 'BLOCKED',
        member,
        message: 'Subscricao pausada. Entre em contato com a recepcao para reativar.',
      };
    }

    // Check if LEAD (no active plan)
    if (member.status === 'LEAD' || !member.access_type) {
      return {
        success: false,
        result: 'EXPIRED',
        member,
        message: 'Membro sem plano ativo. Favor regularizar situação.',
      };
    }

    // Check expiration for subscription/daily pass
    if (member.access_type === 'SUBSCRIPTION' || member.access_type === 'DAILY_PASS') {
      if (member.access_expires_at) {
        const expiresAt = new Date(member.access_expires_at);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (expiresAt < today) {
          return {
            success: false,
            result: 'EXPIRED',
            member,
            message: `Acesso expirado em ${expiresAt.toLocaleDateString('pt-BR')}. Favor renovar.`,
          };
        }
      }
    }

    // Check credits
    if (member.access_type === 'CREDITS') {
      if (!member.credits_remaining || member.credits_remaining <= 0) {
        return {
          success: false,
          result: 'NO_CREDITS',
          member,
          message: 'Sem créditos disponíveis. Favor adquirir mais créditos.',
        };
      }
    }

    return {
      success: true,
      result: 'ALLOWED',
      member,
      message: 'Acesso liberado!',
    };
  };

  const checkExclusiveAreaRental = async (): Promise<{
    isBlocked: boolean;
    rental?: { coach_nome: string; area_nome: string; end_time: string };
  }> => {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 8); // HH:MM:SS format
    const today = now.toISOString().split('T')[0];

    // Query for active rentals on exclusive areas at current time
    const { data, error } = await supabase
      .from('rentals')
      .select(`
        id,
        start_time,
        end_time,
        external_coaches!inner(nome),
        areas!inner(nome, is_exclusive)
      `)
      .eq('rental_date', today)
      .eq('status', 'SCHEDULED')
      .eq('areas.is_exclusive', true)
      .lte('start_time', currentTime)
      .gte('end_time', currentTime);

    if (error) {
      console.error('Error checking exclusive areas:', error);
      return { isBlocked: false };
    }

    if (data && data.length > 0) {
      const rental = data[0] as any;
      return {
        isBlocked: true,
        rental: {
          coach_nome: rental.external_coaches?.nome || 'Coach',
          area_nome: rental.areas?.nome || 'Área',
          end_time: rental.end_time,
        },
      };
    }

    return { isBlocked: false };
  };

  const performCheckin = async (
    member: MemberCheckinInfo,
    staffId: string | null
  ): Promise<CheckinResult> => {
    setIsLoading(true);

    try {
      // First check for exclusive area rentals
      const exclusiveCheck = await checkExclusiveAreaRental();
      
      if (exclusiveCheck.isBlocked && exclusiveCheck.rental) {
        // Register blocked check-in for auditing
        await supabase.from('check_ins').insert({
          member_id: member.id,
          type: 'MEMBER',
          result: 'BLOCKED',
          checked_in_by: staffId,
        });

        return {
          success: false,
          result: 'AREA_EXCLUSIVE',
          member,
          message: `Área exclusiva ocupada até ${exclusiveCheck.rental.end_time.slice(0, 5)}. Aula privada em andamento.`,
          rentalInfo: {
            coachName: exclusiveCheck.rental.coach_nome,
            areaName: exclusiveCheck.rental.area_nome,
            endTime: exclusiveCheck.rental.end_time,
          },
        };
      }

      const validation = validateAccess(member);

      // Register check-in regardless of result (for auditing)
      const { error: checkinError } = await supabase.from('check_ins').insert({
        member_id: member.id,
        type: 'MEMBER',
        result: mapToDatabaseResult(validation.result),
        checked_in_by: staffId,
      });

      if (checkinError) {
        console.error('Error registering check-in:', checkinError);
        toast({
          title: 'Erro',
          description: 'Erro ao registrar check-in.',
          variant: 'destructive',
        });
        return {
          success: false,
          result: 'BLOCKED',
          member,
          message: 'Erro ao registrar check-in.',
        };
      }

      // If access allowed and member has credits, decrement
      if (validation.success && member.access_type === 'CREDITS') {
        const { error: updateError } = await supabase
          .from('members')
          .update({ credits_remaining: (member.credits_remaining || 1) - 1 })
          .eq('id', member.id);

        if (updateError) {
          console.error('Error updating credits:', updateError);
        }
      }

      return validation;
    } catch (error) {
      console.error('Check-in error:', error);
      return {
        success: false,
        result: 'BLOCKED',
        member,
        message: 'Erro inesperado ao processar check-in.',
      };
    } finally {
      setIsLoading(false);
    }
  };

  const processQRCode = async (
    qrCode: string,
    staffId: string | null
  ): Promise<CheckinResult> => {
    setIsLoading(true);

    try {
      // Extract QR code from URL if needed (e.g., https://site.com/m/MBR-XXXXXXXX)
      let extractedCode = qrCode;

      console.log('[QR] Raw input:', qrCode);

      // Check if it's a URL containing /m/
      if (qrCode.includes('/m/')) {
        const match = qrCode.match(/\/m\/(MBR-[A-Z0-9]+)/i);
        if (match) {
          extractedCode = match[1].toUpperCase();
        }
      }
      // Also check for just the code pattern
      else if (qrCode.match(/^MBR-[A-Z0-9]+$/i)) {
        extractedCode = qrCode.toUpperCase();
      }

      console.log('[QR] Extracted code:', extractedCode);

      const member = await findMemberByQR(extractedCode);

      console.log('[QR] Member found:', member ? member.nome : 'NOT FOUND');

      if (!member) {
        return {
          success: false,
          result: 'NOT_FOUND',
          message: `QR code não encontrado: ${extractedCode}`,
        };
      }

      return performCheckin(member, staffId);
    } catch (error) {
      console.error('QR processing error:', error);
      return {
        success: false,
        result: 'BLOCKED',
        message: 'Erro ao processar QR code.',
      };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    findMemberBySearch,
    validateAccess,
    performCheckin,
    processQRCode,
  };
};
