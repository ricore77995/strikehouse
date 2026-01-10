import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const resend = resendApiKey ? new Resend(resendApiKey) : null;

  const now = new Date();
  let logId: string | null = null;

  // Create job log entry
  const { data: logEntry, error: logError } = await supabase
    .from("job_logs")
    .insert({
      job_name: "scheduled-jobs",
      started_at: now.toISOString(),
      status: "RUNNING",
    })
    .select("id")
    .single();

  if (!logError && logEntry) {
    logId = logEntry.id;
  }

  try {
    const results = {
      expiredMembers: 0,
      cancelledMembers: 0,
      completedRentals: 0,
      cancelledPayments: 0,
      transactionsCreated: 0,
      emailsSent: 0,
      reminders3DaysBefore: 0,
      remindersDayOf: 0,
      reminders1DayAfter: 0,
      reminders3DaysAfter: 0,
      rentalReminders: 0,
    };

    const today = now.toISOString().split("T")[0];
    const currentTime = now.toTimeString().slice(0, 5);

    // 1. EXPIRE MEMBERS - Update status to EXPIRED when access_expires_at has passed
    const { data: expiredMembers, error: expireError } = await supabase
      .from("members")
      .update({ status: "EXPIRED" })
      .lt("access_expires_at", today)
      .in("status", ["ACTIVE", "LEAD"])
      .select("id, nome, email");

    if (expireError) {
      console.error("Error expiring members:", expireError);
    } else {
      results.expiredMembers = expiredMembers?.length || 0;
      console.log(`Expired ${results.expiredMembers} members`);
    }

    // 2. COMPLETE RENTALS - Mark rentals as COMPLETED when end_time has passed
    const { data: rentalsToComplete, error: rentalsSelectError } = await supabase
      .from("rentals")
      .select(`
        id,
        coach_id,
        area_id,
        rental_date,
        start_time,
        end_time,
        fee_charged_cents,
        guest_count,
        external_coaches(nome, email, fee_type, fee_value)
      `)
      .eq("status", "SCHEDULED")
      .lte("rental_date", today);

    if (rentalsSelectError) {
      console.error("Error fetching rentals:", rentalsSelectError);
    } else if (rentalsToComplete && rentalsToComplete.length > 0) {
      for (const rental of rentalsToComplete) {
        const rentalDate = rental.rental_date;
        const shouldComplete = rentalDate < today || 
          (rentalDate === today && rental.end_time <= currentTime);

        if (shouldComplete) {
          const { error: updateError } = await supabase
            .from("rentals")
            .update({ status: "COMPLETED" })
            .eq("id", rental.id);

          if (updateError) {
            console.error(`Error completing rental ${rental.id}:`, updateError);
            continue;
          }

          results.completedRentals++;

          if (rental.fee_charged_cents && rental.fee_charged_cents > 0) {
            const coach = rental.external_coaches as any;
            const { error: txError } = await supabase
              .from("transactions")
              .insert({
                type: "RECEITA",
                category: "RENTAL",
                amount_cents: rental.fee_charged_cents,
                payment_method: "TRANSFERENCIA",
                description: `Rental - ${coach?.nome || "Coach"} - ${rental.rental_date}`,
                transaction_date: rental.rental_date,
                reference_type: "RENTAL",
                reference_id: rental.id,
                created_by: rental.coach_id,
              });

            if (txError) {
              console.error(`Error creating transaction for rental ${rental.id}:`, txError);
            } else {
              results.transactionsCreated++;
            }
          }

          if (resend && rental.external_coaches) {
            const coach = rental.external_coaches as any;
            if (coach.email) {
              try {
                await resend.emails.send({
                  from: "BoxeMaster <onboarding@resend.dev>",
                  to: [coach.email],
                  subject: "Rental Concluído",
                  html: `
                    <h1>Olá ${coach.nome}!</h1>
                    <p>Seu rental de ${rental.rental_date} às ${rental.start_time.slice(0, 5)} foi marcado como concluído.</p>
                    ${rental.guest_count ? `<p>Alunos registrados: ${rental.guest_count}</p>` : ""}
                    ${rental.fee_charged_cents ? `<p>Valor: €${(rental.fee_charged_cents / 100).toFixed(2)}</p>` : ""}
                    <p>Obrigado por treinar conosco!</p>
                    <p>- Equipe BoxeMaster</p>
                  `,
                });
                results.emailsSent++;
              } catch (emailError) {
                console.error(`Error sending email to ${coach.email}:`, emailError);
              }
            }
          }
        }
      }
      console.log(`Completed ${results.completedRentals} rentals, created ${results.transactionsCreated} transactions`);
    }

    // 3. CANCEL EXPIRED PENDING PAYMENTS
    const { data: expiredPayments, error: paymentsError } = await supabase
      .from("pending_payments")
      .update({ status: "EXPIRED" })
      .lt("expires_at", now.toISOString())
      .eq("status", "PENDING")
      .select("id");

    if (paymentsError) {
      console.error("Error cancelling payments:", paymentsError);
    } else {
      results.cancelledPayments = expiredPayments?.length || 0;
      console.log(`Cancelled ${results.cancelledPayments} expired payments`);
    }

    // 4. SEND RENTAL REMINDERS - 24h before
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split("T")[0];

    const { data: upcomingRentals, error: upcomingError } = await supabase
      .from("rentals")
      .select(`
        id,
        rental_date,
        start_time,
        end_time,
        external_coaches(nome, email),
        areas(nome)
      `)
      .eq("status", "SCHEDULED")
      .eq("rental_date", tomorrowDate);

    if (upcomingError) {
      console.error("Error fetching upcoming rentals:", upcomingError);
    } else if (upcomingRentals && upcomingRentals.length > 0 && resend) {
      for (const rental of upcomingRentals) {
        const coach = rental.external_coaches as any;
        const area = rental.areas as any;
        
        if (coach?.email) {
          try {
            await resend.emails.send({
              from: "BoxeMaster <onboarding@resend.dev>",
              to: [coach.email],
              subject: "Lembrete: Rental Amanhã",
              html: `
                <h1>Olá ${coach.nome}!</h1>
                <p>Este é um lembrete do seu rental agendado para <strong>amanhã</strong>:</p>
                <ul>
                  <li><strong>Data:</strong> ${rental.rental_date}</li>
                  <li><strong>Horário:</strong> ${rental.start_time.slice(0, 5)} - ${rental.end_time.slice(0, 5)}</li>
                  <li><strong>Área:</strong> ${area?.nome || "N/A"}</li>
                </ul>
                <p>Não se esqueça de fazer o check-in quando chegar!</p>
                <p>- Equipe BoxeMaster</p>
              `,
            });
            results.rentalReminders++;
            results.emailsSent++;
            console.log(`Sent reminder to ${coach.email} for rental ${rental.id}`);
          } catch (emailError) {
            console.error(`Error sending reminder to ${coach.email}:`, emailError);
          }
        }
      }
    }

    // 5. MEMBERSHIP REMINDERS - Multiple timing notifications
    
    // Helper function to send membership reminder
    const sendMemberReminder = async (
      members: any[],
      subject: string,
      getMessage: (member: any) => string,
      resultKey: 'reminders3DaysBefore' | 'remindersDayOf' | 'reminders1DayAfter' | 'reminders3DaysAfter'
    ) => {
      if (!members || members.length === 0 || !resend) return;
      
      for (const member of members) {
        if (member.email) {
          try {
            await resend.emails.send({
              from: "BoxeMaster <onboarding@resend.dev>",
              to: [member.email],
              subject,
              html: getMessage(member),
            });
            results[resultKey]++;
            results.emailsSent++;
          } catch (emailError) {
            console.error(`Error sending reminder to ${member.email}:`, emailError);
          }
        }
      }
    };

    // 5a. 3 DAYS BEFORE expiration
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const threeDaysDate = threeDaysFromNow.toISOString().split("T")[0];

    const { data: members3Days } = await supabase
      .from("members")
      .select("id, nome, email, access_expires_at, telefone")
      .eq("status", "ACTIVE")
      .eq("access_expires_at", threeDaysDate);

    await sendMemberReminder(
      members3Days || [],
      "⚠️ Seu plano expira em 3 dias!",
      (m) => `
        <h1>Olá ${m.nome}!</h1>
        <p>Seu plano expira em <strong>3 dias</strong> (${m.access_expires_at}).</p>
        <p>Renove agora para continuar treinando sem interrupções!</p>
        <h3>Como renovar:</h3>
        <ul>
          <li>Visite nossa recepção</li>
          <li>Pague online e envie o comprovante</li>
        </ul>
        <p>Dúvidas? Entre em contato!</p>
        <p>- Equipe BoxeMaster 💪</p>
      `,
      'reminders3DaysBefore'
    );

    // 5b. DAY OF expiration
    const { data: membersToday } = await supabase
      .from("members")
      .select("id, nome, email, access_expires_at, telefone")
      .eq("status", "ACTIVE")
      .eq("access_expires_at", today);

    await sendMemberReminder(
      membersToday || [],
      "🚨 Seu plano expira HOJE!",
      (m) => `
        <h1>Olá ${m.nome}!</h1>
        <p><strong>Seu plano expira HOJE!</strong></p>
        <p>A partir de amanhã, você não poderá fazer check-in até renovar.</p>
        <h3>Renove agora:</h3>
        <ul>
          <li>Visite nossa recepção ainda hoje</li>
          <li>Ou faça transferência e envie o comprovante</li>
        </ul>
        <p>Não perca seu ritmo de treino! 🥊</p>
        <p>- Equipe BoxeMaster</p>
      `,
      'remindersDayOf'
    );

    // 5c. 1 DAY AFTER expiration
    const oneDayAgo = new Date(now);
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const oneDayAgoDate = oneDayAgo.toISOString().split("T")[0];

    const { data: members1DayAfter } = await supabase
      .from("members")
      .select("id, nome, email, access_expires_at, telefone")
      .in("status", ["ACTIVE", "EXPIRED", "BLOQUEADO"])
      .eq("access_expires_at", oneDayAgoDate);

    await sendMemberReminder(
      members1DayAfter || [],
      "❌ Seu plano expirou ontem",
      (m) => `
        <h1>Olá ${m.nome}!</h1>
        <p>Seu plano expirou <strong>ontem</strong> e seu acesso está bloqueado.</p>
        <p>Renove agora para voltar a treinar!</p>
        <h3>Como renovar:</h3>
        <ul>
          <li>Visite nossa recepção</li>
          <li>Faça transferência e envie o comprovante</li>
        </ul>
        <p>Estamos esperando você de volta! 💪</p>
        <p>- Equipe BoxeMaster</p>
      `,
      'reminders1DayAfter'
    );

    // 5d. 3 DAYS AFTER expiration
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoDate = threeDaysAgo.toISOString().split("T")[0];

    const { data: members3DaysAfter } = await supabase
      .from("members")
      .select("id, nome, email, access_expires_at, telefone")
      .in("status", ["EXPIRED", "BLOQUEADO"])
      .eq("access_expires_at", threeDaysAgoDate);

    await sendMemberReminder(
      members3DaysAfter || [],
      "😢 Sentimos sua falta!",
      (m) => `
        <h1>Olá ${m.nome}!</h1>
        <p>Seu plano expirou há 3 dias e você ainda não renovou.</p>
        <p><strong>Sentimos sua falta!</strong> Volte a treinar conosco.</p>
        <h3>Renove agora:</h3>
        <ul>
          <li>Visite nossa recepção</li>
          <li>Ou entre em contato para verificar opções de planos</li>
        </ul>
        <p>Cada dia conta para sua evolução! 🥊</p>
        <p>- Equipe BoxeMaster</p>
      `,
      'reminders3DaysAfter'
    );

    console.log(`Reminders sent: 3d before=${results.reminders3DaysBefore}, day of=${results.remindersDayOf}, 1d after=${results.reminders1DayAfter}, 3d after=${results.reminders3DaysAfter}`);

    // 6. CANCEL MEMBERS BLOCKED FOR 30+ DAYS
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoDate = thirtyDaysAgo.toISOString();

    const { data: blockedMembers, error: blockedError } = await supabase
      .from("members")
      .update({ status: "CANCELADO" })
      .eq("status", "BLOQUEADO")
      .lt("updated_at", thirtyDaysAgoDate)
      .select("id, nome, email");

    if (blockedError) {
      console.error("Error cancelling blocked members:", blockedError);
    } else {
      results.cancelledMembers = blockedMembers?.length || 0;
      console.log(`Cancelled ${results.cancelledMembers} members blocked for 30+ days`);

      // Send notification emails to cancelled members
      if (blockedMembers && blockedMembers.length > 0 && resend) {
        for (const member of blockedMembers) {
          if (member.email) {
            try {
              await resend.emails.send({
                from: "BoxeMaster <onboarding@resend.dev>",
                to: [member.email],
                subject: "Sua conta foi cancelada",
                html: `
                  <h1>Olá ${member.nome},</h1>
                  <p>Sua conta foi cancelada automaticamente após 30 dias de bloqueio.</p>
                  <p>Se deseja reativar sua conta, entre em contato conosco:</p>
                  <ul>
                    <li>Visite nossa recepção</li>
                    <li>Ou entre em contato pelo WhatsApp</li>
                  </ul>
                  <p>Esperamos vê-lo novamente em breve!</p>
                  <p>- Equipe BoxeMaster</p>
                `,
              });
              results.emailsSent++;
            } catch (emailError) {
              console.error(`Error sending cancellation email to ${member.email}:`, emailError);
            }
          }
        }
      }
    }

    // Update job log with success
    if (logId) {
      await supabase
        .from("job_logs")
        .update({
          completed_at: new Date().toISOString(),
          status: "SUCCESS",
          results: results,
        })
        .eq("id", logId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Scheduled jobs completed",
        results,
        timestamp: now.toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in scheduled-jobs:", error);

    // Update job log with error
    if (logId) {
      await supabase
        .from("job_logs")
        .update({
          completed_at: new Date().toISOString(),
          status: "ERROR",
          error_message: error.message,
        })
        .eq("id", logId);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
