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
  result: 'ALLOWED' | 'BLOCKED' | 'EXPIRED' | 'NO_CREDITS' | 'NOT_FOUND';
  member?: MemberCheckinInfo;
  message: string;
}

export const useCheckin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const findMemberByQR = async (qrCode: string): Promise<MemberCheckinInfo | null> => {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('qr_code', qrCode)
      .single();

    if (error || !data) return null;
    return data as MemberCheckinInfo;
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

  const performCheckin = async (
    member: MemberCheckinInfo,
    staffId: string
  ): Promise<CheckinResult> => {
    setIsLoading(true);

    try {
      const validation = validateAccess(member);

      // Register check-in regardless of result (for auditing)
      const { error: checkinError } = await supabase.from('check_ins').insert({
        member_id: member.id,
        type: 'MEMBER',
        result: validation.result,
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
    staffId: string
  ): Promise<CheckinResult> => {
    setIsLoading(true);

    try {
      const member = await findMemberByQR(qrCode);

      if (!member) {
        return {
          success: false,
          result: 'NOT_FOUND',
          message: 'QR code não encontrado. Verifique ou faça busca manual.',
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
