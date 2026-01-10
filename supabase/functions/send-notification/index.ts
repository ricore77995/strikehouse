import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: 'PAYMENT_REMINDER' | 'RENTAL_CONFIRMATION' | 'WELCOME' | 'EXPIRING_SOON';
  recipientEmail: string;
  recipientName: string;
  data?: Record<string, any>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Unauthorized');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { type, recipientEmail, recipientName, data }: NotificationRequest = await req.json();

    let subject = '';
    let html = '';

    const gymName = 'Strikers House';
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev';

    switch (type) {
      case 'PAYMENT_REMINDER':
        subject = `${gymName} - Lembrete de Pagamento`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #E11D48;">⚠️ Lembrete de Pagamento</h2>
            <p>Olá <strong>${recipientName}</strong>,</p>
            <p>O seu plano na ${gymName} está ${data?.daysOverdue ? `com <strong>${data.daysOverdue} dias de atraso</strong>` : 'a vencer'}.</p>
            ${data?.planName ? `<p>Plano: <strong>${data.planName}</strong></p>` : ''}
            ${data?.amount ? `<p>Valor: <strong>€${(data.amount / 100).toFixed(2)}</strong></p>` : ''}
            <p>Por favor, regularize a sua situação para continuar a treinar connosco.</p>
            <div style="margin: 30px 0;">
              <p><strong>Métodos de pagamento:</strong></p>
              <ul>
                <li>Presencialmente na receção</li>
                <li>Transferência bancária</li>
                <li>MBWay</li>
              </ul>
            </div>
            <p style="color: #666;">Qualquer dúvida, entre em contacto connosco.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">${gymName} - A sua casa de treino</p>
          </div>
        `;
        break;

      case 'EXPIRING_SOON':
        subject = `${gymName} - Seu plano expira em breve`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #F97316;">🔔 Plano a Expirar</h2>
            <p>Olá <strong>${recipientName}</strong>,</p>
            <p>O seu plano na ${gymName} expira em <strong>${data?.daysRemaining} dias</strong>.</p>
            ${data?.expiresAt ? `<p>Data de expiração: <strong>${data.expiresAt}</strong></p>` : ''}
            <p>Renove o seu plano para continuar a treinar sem interrupções!</p>
            <div style="margin: 30px 0; padding: 20px; background: #f5f5f5; border-radius: 8px;">
              <p><strong>Vantagens de renovar agora:</strong></p>
              <ul>
                <li>Acesso contínuo às instalações</li>
                <li>Manutenção do histórico de treinos</li>
                <li>Preço especial para renovações</li>
              </ul>
            </div>
            <p>Visite-nos ou contacte-nos para renovar.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">${gymName} - A sua casa de treino</p>
          </div>
        `;
        break;

      case 'RENTAL_CONFIRMATION':
        subject = `${gymName} - Confirmação de Rental`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #22C55E;">✅ Rental Confirmado</h2>
            <p>Olá <strong>${recipientName}</strong>,</p>
            <p>O seu rental foi confirmado com sucesso!</p>
            <div style="margin: 20px 0; padding: 20px; background: #f5f5f5; border-radius: 8px;">
              <p><strong>Detalhes:</strong></p>
              <ul>
                <li>Data: <strong>${data?.date}</strong></li>
                <li>Horário: <strong>${data?.startTime} - ${data?.endTime}</strong></li>
                <li>Área: <strong>${data?.areaName}</strong></li>
              </ul>
            </div>
            <p>Compareça com 10 minutos de antecedência.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">${gymName} - A sua casa de treino</p>
          </div>
        `;
        break;

      case 'WELCOME':
        subject = `Bem-vindo à ${gymName}!`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #E11D48;">🥊 Bem-vindo à ${gymName}!</h2>
            <p>Olá <strong>${recipientName}</strong>,</p>
            <p>Estamos muito felizes por te ter connosco!</p>
            <p>O seu registo foi concluído com sucesso. Agora pode:</p>
            <ul>
              <li>Fazer check-in usando o QR Code do seu cartão</li>
              <li>Participar em todas as aulas do seu plano</li>
              <li>Aceder às instalações durante o horário de funcionamento</li>
            </ul>
            <div style="margin: 30px 0; padding: 20px; background: #E11D48; color: white; border-radius: 8px; text-align: center;">
              <p style="margin: 0; font-size: 18px;"><strong>O seu primeiro treino começa agora!</strong></p>
            </div>
            <p>Qualquer dúvida, a equipa está disponível para ajudar.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">${gymName} - A sua casa de treino</p>
          </div>
        `;
        break;

      default:
        throw new Error('Invalid notification type');
    }

    const emailResponse = await resend.emails.send({
      from: `${gymName} <${fromEmail}>`,
      to: [recipientEmail],
      subject,
      html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: error.message === 'Unauthorized' ? 401 : 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
