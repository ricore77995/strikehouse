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
      autoRenewalReminders: 0,
      autoRenewalsCreated: 0,
      noShowsProcessed: 0,
      bookingBlocksApplied: 0,
      creditsDeducted: 0,
      weeklyBookingsCreated: 0,
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

    // 6. AUTO-RENEWAL - Send reminders 7 days before expiry
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sevenDaysDate = sevenDaysFromNow.toISOString().split("T")[0];

    const { data: autoRenewReminders, error: renewRemindersError } = await supabase
      .from("subscriptions")
      .select(`
        id,
        member_id,
        expires_at,
        final_price_cents,
        members(nome, email, telefone, preferred_payment_method)
      `)
      .eq("status", "active")
      .eq("auto_renew", true)
      .is("renewal_reminder_sent_at", null)
      .eq("expires_at", sevenDaysDate);

    if (renewRemindersError) {
      console.error("Error fetching auto-renewal reminders:", renewRemindersError);
    } else if (autoRenewReminders && autoRenewReminders.length > 0) {
      for (const sub of autoRenewReminders) {
        const member = sub.members as any;

        // Mark reminder as sent
        await supabase
          .from("subscriptions")
          .update({ renewal_reminder_sent_at: now.toISOString() })
          .eq("id", sub.id);

        // Send email if available
        if (member?.email && resend) {
          try {
            await resend.emails.send({
              from: "BoxeMaster <onboarding@resend.dev>",
              to: [member.email],
              subject: "🔄 Renovação automática em 7 dias",
              html: `
                <h1>Olá ${member.nome}!</h1>
                <p>Sua subscrição será renovada automaticamente em <strong>7 dias</strong> (${sub.expires_at}).</p>
                <p><strong>Valor:</strong> €${(sub.final_price_cents / 100).toFixed(2)}</p>
                <p>Se preferir não renovar, entre em contato conosco antes da data de renovação.</p>
                <p>Obrigado por continuar treinando conosco! 💪</p>
                <p>- Equipe BoxeMaster</p>
              `,
            });
            results.emailsSent++;
          } catch (emailError) {
            console.error(`Error sending renewal reminder to ${member.email}:`, emailError);
          }
        }
        results.autoRenewalReminders++;
      }
      console.log(`Sent ${results.autoRenewalReminders} auto-renewal reminders`);
    }

    // 7. AUTO-RENEWAL - Create renewals for expired subscriptions
    const { data: expiredAutoRenew, error: expiredRenewError } = await supabase
      .from("subscriptions")
      .select(`
        id,
        member_id,
        plan_id,
        modalities,
        commitment_months,
        commitment_discount_id,
        promo_discount_id,
        calculated_price_cents,
        commitment_discount_pct,
        promo_discount_pct,
        final_price_cents,
        enrollment_fee_cents,
        members(nome, email, telefone, preferred_payment_method)
      `)
      .eq("status", "active")
      .eq("auto_renew", true)
      .eq("expires_at", today);

    if (expiredRenewError) {
      console.error("Error fetching expired auto-renewal subscriptions:", expiredRenewError);
    } else if (expiredAutoRenew && expiredAutoRenew.length > 0) {
      for (const oldSub of expiredAutoRenew) {
        const member = oldSub.members as any;

        // Calculate new expiry date based on commitment months
        const newExpiry = new Date(now);
        newExpiry.setMonth(newExpiry.getMonth() + oldSub.commitment_months);
        const newExpiryDate = newExpiry.toISOString().split("T")[0];

        // Create new subscription (copy from old one)
        const { data: newSub, error: newSubError } = await supabase
          .from("subscriptions")
          .insert({
            member_id: oldSub.member_id,
            plan_id: oldSub.plan_id,
            modalities: oldSub.modalities,
            commitment_months: oldSub.commitment_months,
            commitment_discount_id: oldSub.commitment_discount_id,
            // Don't carry over promo discount - it's one-time
            promo_discount_id: null,
            calculated_price_cents: oldSub.calculated_price_cents,
            commitment_discount_pct: oldSub.commitment_discount_pct,
            promo_discount_pct: 0, // No promo on renewal
            final_price_cents: Math.round(oldSub.calculated_price_cents * (1 - oldSub.commitment_discount_pct / 100)),
            enrollment_fee_cents: 0, // No enrollment fee on renewal
            starts_at: today,
            expires_at: newExpiryDate,
            status: "active",
            auto_renew: true, // Keep auto-renewal enabled
          })
          .select("id")
          .single();

        if (newSubError) {
          console.error(`Error creating renewal subscription for member ${oldSub.member_id}:`, newSubError);
          continue;
        }

        // Mark old subscription as expired
        await supabase
          .from("subscriptions")
          .update({ status: "expired" })
          .eq("id", oldSub.id);

        // Update member's current subscription
        await supabase
          .from("members")
          .update({
            current_subscription_id: newSub?.id,
            access_expires_at: newExpiryDate,
          })
          .eq("id", oldSub.member_id);

        // Create pending payment for the renewal
        const renewalPrice = Math.round(oldSub.calculated_price_cents * (1 - oldSub.commitment_discount_pct / 100));
        const paymentMethod = member?.preferred_payment_method || "TRANSFERENCIA";

        await supabase
          .from("pending_payments")
          .insert({
            member_id: oldSub.member_id,
            plan_id: oldSub.plan_id,
            amount_cents: renewalPrice,
            payment_method: paymentMethod,
            reference: `REN-${Date.now()}`,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
            subscription_id: newSub?.id,
          });

        // Send confirmation email
        if (member?.email && resend) {
          try {
            await resend.emails.send({
              from: "BoxeMaster <onboarding@resend.dev>",
              to: [member.email],
              subject: "✅ Subscrição renovada automaticamente",
              html: `
                <h1>Olá ${member.nome}!</h1>
                <p>Sua subscrição foi renovada automaticamente com sucesso!</p>
                <p><strong>Nova data de expiração:</strong> ${newExpiryDate}</p>
                <p><strong>Valor:</strong> €${(renewalPrice / 100).toFixed(2)}</p>
                <p>Um pagamento pendente foi criado. Por favor, efetue o pagamento o mais breve possível.</p>
                <p>Continue treinando forte! 💪</p>
                <p>- Equipe BoxeMaster</p>
              `,
            });
            results.emailsSent++;
          } catch (emailError) {
            console.error(`Error sending renewal confirmation to ${member.email}:`, emailError);
          }
        }

        results.autoRenewalsCreated++;
      }
      console.log(`Created ${results.autoRenewalsCreated} auto-renewals`);
    }

    // 8. AUTO-UNFREEZE - Unfreeze subscriptions where frozen_until has passed
    const { data: frozenToUnfreeze, error: unfreezeError } = await supabase
      .from("subscriptions")
      .select(`
        id,
        member_id,
        frozen_at,
        frozen_until,
        members(nome, email)
      `)
      .eq("status", "active")
      .not("frozen_at", "is", null)
      .lte("frozen_until", today);

    if (unfreezeError) {
      console.error("Error fetching frozen subscriptions to unfreeze:", unfreezeError);
    } else if (frozenToUnfreeze && frozenToUnfreeze.length > 0) {
      for (const sub of frozenToUnfreeze) {
        const member = sub.members as any;

        // Clear freeze columns
        await supabase
          .from("subscriptions")
          .update({
            frozen_at: null,
            frozen_until: null,
            freeze_reason: null,
            // Keep original_expires_at for audit purposes
          })
          .eq("id", sub.id);

        // Update member status back to ATIVO
        await supabase
          .from("members")
          .update({ status: "ATIVO" })
          .eq("id", sub.member_id);

        // Send notification email
        if (member?.email && resend) {
          try {
            await resend.emails.send({
              from: "BoxeMaster <onboarding@resend.dev>",
              to: [member.email],
              subject: "✅ Sua subscricao foi reativada",
              html: `
                <h1>Ola ${member.nome}!</h1>
                <p>O periodo de pausa da sua subscricao terminou e seu acesso foi <strong>reativado automaticamente</strong>.</p>
                <p>Voce ja pode voltar a treinar conosco!</p>
                <p>Bons treinos! 💪</p>
                <p>- Equipe BoxeMaster</p>
              `,
            });
            results.emailsSent++;
          } catch (emailError) {
            console.error(`Error sending unfreeze notification to ${member.email}:`, emailError);
          }
        }
      }
      console.log(`Unfroze ${frozenToUnfreeze.length} subscriptions`);
    }

    // 9. CANCEL MEMBERS BLOCKED FOR 30+ DAYS
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

    // 10. PROCESS NO-SHOWS - Mark bookings without check-in as NO_SHOW after class ends
    // Get all BOOKED status bookings for today where the class has ended
    const { data: bookedClassesToday, error: bookedError } = await supabase
      .from("class_bookings")
      .select(`
        id,
        member_id,
        class_id,
        class_date,
        classes!inner(hora_inicio, duracao_min)
      `)
      .eq("class_date", today)
      .eq("status", "BOOKED");

    if (bookedError) {
      console.error("Error fetching booked classes:", bookedError);
    } else if (bookedClassesToday && bookedClassesToday.length > 0) {
      for (const booking of bookedClassesToday) {
        const classInfo = booking.classes as any;
        if (!classInfo) continue;

        // Calculate class end time
        const [hours, minutes] = classInfo.hora_inicio.split(":").map(Number);
        const classEndMinutes = hours * 60 + minutes + (classInfo.duracao_min || 60);
        const classEndTime = `${Math.floor(classEndMinutes / 60).toString().padStart(2, "0")}:${(classEndMinutes % 60).toString().padStart(2, "0")}`;

        // Check if class has ended
        if (currentTime >= classEndTime) {
          // Mark as NO_SHOW
          const { error: updateError } = await supabase
            .from("class_bookings")
            .update({ status: "NO_SHOW" })
            .eq("id", booking.id);

          if (updateError) {
            console.error(`Error marking booking ${booking.id} as NO_SHOW:`, updateError);
            continue;
          }

          results.noShowsProcessed++;

          // Get member info to determine penalty
          const { data: member } = await supabase
            .from("members")
            .select("id, weekly_limit, access_type, credits_remaining, nome, email")
            .eq("id", booking.member_id)
            .single();

          if (member) {
            // Apply penalty based on plan type
            if (member.weekly_limit === null && member.access_type !== "CREDITS") {
              // Unlimited plan: block booking for 24h
              const blockUntil = new Date(now);
              blockUntil.setHours(blockUntil.getHours() + 24);

              await supabase
                .from("members")
                .update({ booking_blocked_until: blockUntil.toISOString() })
                .eq("id", member.id);

              results.bookingBlocksApplied++;
              console.log(`Applied 24h booking block to member ${member.nome}`);
            } else if (member.access_type === "CREDITS" && member.credits_remaining && member.credits_remaining > 0) {
              // Credits plan: deduct 1 credit
              await supabase
                .from("members")
                .update({ credits_remaining: member.credits_remaining - 1 })
                .eq("id", member.id);

              results.creditsDeducted++;
              console.log(`Deducted 1 credit from member ${member.nome} for no-show`);
            }
            // Note: 2x/3x plans (weekly_limit > 0) have NO penalty per business rules

            // Send notification email
            if (member.email && resend) {
              try {
                await resend.emails.send({
                  from: "BoxeMaster <onboarding@resend.dev>",
                  to: [member.email],
                  subject: "⚠️ Ausência registrada",
                  html: `
                    <h1>Olá ${member.nome}!</h1>
                    <p>Você tinha uma reserva hoje mas não compareceu à aula.</p>
                    ${member.weekly_limit === null && member.access_type !== "CREDITS"
                      ? `<p><strong>Penalidade:</strong> Suas reservas estão bloqueadas por 24 horas.</p>`
                      : member.access_type === "CREDITS"
                        ? `<p><strong>Penalidade:</strong> 1 crédito foi deduzido da sua conta.</p>`
                        : `<p>Como você tem um plano com horário fixo, não há penalidade.</p>`
                    }
                    <p>Lembre-se: você pode cancelar reservas até 2 horas antes da aula.</p>
                    <p>- Equipe BoxeMaster</p>
                  `,
                });
                results.emailsSent++;
              } catch (emailError) {
                console.error(`Error sending no-show notification to ${member.email}:`, emailError);
              }
            }
          }
        }
      }
      console.log(`Processed ${results.noShowsProcessed} no-shows, applied ${results.bookingBlocksApplied} blocks, deducted ${results.creditsDeducted} credits`);
    }

    // 11. CREATE WEEKLY AUTO-BOOKINGS - Run on Sundays to create next week's bookings
    // Check if today is Sunday (0 = Sunday)
    const dayOfWeek = now.getDay();
    if (dayOfWeek === 0) {
      // Get all active fixed schedules
      const { data: fixedSchedules, error: fixedError } = await supabase
        .from("member_fixed_schedules")
        .select(`
          id,
          member_id,
          class_id,
          classes!inner(id, nome, dia_semana, hora_inicio, capacidade)
        `)
        .eq("active", true);

      if (fixedError) {
        console.error("Error fetching fixed schedules:", fixedError);
      } else if (fixedSchedules && fixedSchedules.length > 0) {
        // Get bookings for next 7 days to avoid duplicates
        const nextWeekDates: string[] = [];
        for (let i = 1; i <= 7; i++) {
          const date = new Date(now);
          date.setDate(date.getDate() + i);
          nextWeekDates.push(date.toISOString().split("T")[0]);
        }

        for (const schedule of fixedSchedules) {
          const classInfo = schedule.classes as any;
          if (!classInfo) continue;

          // Find the date for this class in the next week
          // dia_semana: 0=Domingo, 1=Segunda, 2=Terça, etc.
          const classDayOfWeek = classInfo.dia_semana;

          // Calculate the date for this day of week in the next week
          const daysUntilClass = (classDayOfWeek - dayOfWeek + 7) % 7;
          const classDate = new Date(now);
          classDate.setDate(classDate.getDate() + (daysUntilClass === 0 ? 7 : daysUntilClass));
          const classDateStr = classDate.toISOString().split("T")[0];

          // Check if booking already exists
          const { data: existingBooking } = await supabase
            .from("class_bookings")
            .select("id")
            .eq("member_id", schedule.member_id)
            .eq("class_id", schedule.class_id)
            .eq("class_date", classDateStr)
            .single();

          if (existingBooking) {
            // Booking already exists, skip
            continue;
          }

          // Check class capacity
          const { count: currentBookings } = await supabase
            .from("class_bookings")
            .select("*", { count: "exact", head: true })
            .eq("class_id", schedule.class_id)
            .eq("class_date", classDateStr)
            .in("status", ["BOOKED", "CHECKED_IN"]);

          const capacity = classInfo.capacidade || 30;
          if ((currentBookings || 0) >= capacity) {
            console.log(`Class ${classInfo.nome} on ${classDateStr} is full, skipping auto-booking for member ${schedule.member_id}`);
            continue;
          }

          // Create the booking
          const { error: bookingError } = await supabase
            .from("class_bookings")
            .insert({
              member_id: schedule.member_id,
              class_id: schedule.class_id,
              class_date: classDateStr,
              status: "BOOKED",
              created_by: null, // System auto-booking
            });

          if (bookingError) {
            console.error(`Error creating auto-booking for member ${schedule.member_id}:`, bookingError);
          } else {
            results.weeklyBookingsCreated++;
          }
        }
        console.log(`Created ${results.weeklyBookingsCreated} weekly auto-bookings`);
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
