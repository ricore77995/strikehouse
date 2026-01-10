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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    const results = {
      expiredMembers: 0,
      completedRentals: 0,
      cancelledPayments: 0,
      transactionsCreated: 0,
      emailsSent: 0,
    };

    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
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
        // Check if rental date is in the past OR if it's today and end_time has passed
        const rentalDate = rental.rental_date;
        const shouldComplete = rentalDate < today || 
          (rentalDate === today && rental.end_time <= currentTime);

        if (shouldComplete) {
          // Update rental to COMPLETED
          const { error: updateError } = await supabase
            .from("rentals")
            .update({ status: "COMPLETED" })
            .eq("id", rental.id);

          if (updateError) {
            console.error(`Error completing rental ${rental.id}:`, updateError);
            continue;
          }

          results.completedRentals++;

          // Create transaction for the rental
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
                created_by: rental.coach_id, // Using coach_id as reference
              });

            if (txError) {
              console.error(`Error creating transaction for rental ${rental.id}:`, txError);
            } else {
              results.transactionsCreated++;
            }
          }

          // Send email notification to coach
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
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});