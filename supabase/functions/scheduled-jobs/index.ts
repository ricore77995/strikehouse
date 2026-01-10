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
      completedRentals: 0,
      cancelledPayments: 0,
      transactionsCreated: 0,
      emailsSent: 0,
      expiringReminders: 0,
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

    // 5. SEND EXPIRING MEMBERSHIP REMINDERS - 7 days before
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const expiringDate = sevenDaysFromNow.toISOString().split("T")[0];

    const { data: expiringMembers, error: expiringError } = await supabase
      .from("members")
      .select("id, nome, email, access_expires_at, access_type")
      .eq("status", "ACTIVE")
      .eq("access_expires_at", expiringDate);

    if (expiringError) {
      console.error("Error fetching expiring members:", expiringError);
    } else if (expiringMembers && expiringMembers.length > 0 && resend) {
      for (const member of expiringMembers) {
        if (member.email) {
          try {
            await resend.emails.send({
              from: "BoxeMaster <onboarding@resend.dev>",
              to: [member.email],
              subject: "Seu plano expira em 7 dias",
              html: `
                <h1>Olá ${member.nome}!</h1>
                <p>Seu plano <strong>${member.access_type || "mensal"}</strong> expira em <strong>7 dias</strong> (${member.access_expires_at}).</p>
                <p>Para continuar treinando sem interrupções, renove seu plano antes do vencimento.</p>
                <h3>Como renovar:</h3>
                <ol>
                  <li>Visite nossa recepção</li>
                  <li>Ou entre em contato pelo WhatsApp</li>
                </ol>
                <p>Não perca seu progresso! 💪</p>
                <p>- Equipe BoxeMaster</p>
              `,
            });
            results.expiringReminders++;
            results.emailsSent++;
            console.log(`Sent expiring reminder to ${member.email}`);
          } catch (emailError) {
            console.error(`Error sending expiring reminder to ${member.email}:`, emailError);
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
