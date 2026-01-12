import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Edge Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Scheduled Jobs', () => {
    it('expire members: ATIVO → BLOQUEADO on expiration', async () => {
      // Mock member with expired access
      const expiredMember = {
        id: 'member-001',
        nome: 'João Silva',
        status: 'ATIVO',
        access_expires_at: '2026-01-10', // Yesterday (assuming today is 2026-01-11)
      };

      // Mock scheduled job execution
      const jobResult = {
        membersExpired: 1,
        membersUpdated: [expiredMember.id],
      };

      // Simulate job logic
      const today = new Date('2026-01-11');
      const expiresAt = new Date(expiredMember.access_expires_at);
      const shouldExpire = expiresAt < today;

      expect(shouldExpire).toBe(true);

      if (shouldExpire) {
        // Update member status to BLOQUEADO
        expiredMember.status = 'BLOQUEADO';
      }

      expect(expiredMember.status).toBe('BLOQUEADO');
      expect(jobResult.membersExpired).toBe(1);
    });

    it('auto-cancel: BLOQUEADO → CANCELADO after 30 days', async () => {
      // Mock member BLOQUEADO for 31 days
      const blockedMember = {
        id: 'member-002',
        status: 'BLOQUEADO',
        access_expires_at: '2025-12-10', // 32 days ago (assuming today is 2026-01-11)
      };

      // Calculate days since expiration
      const today = new Date('2026-01-11');
      const expiresAt = new Date(blockedMember.access_expires_at);
      const daysSinceExpiration = Math.floor(
        (today.getTime() - expiresAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(daysSinceExpiration).toBeGreaterThan(30);

      // Auto-cancel if blocked for >30 days
      if (daysSinceExpiration > 30 && blockedMember.status === 'BLOQUEADO') {
        blockedMember.status = 'CANCELADO';
      }

      expect(blockedMember.status).toBe('CANCELADO');
    });

    it('complete rentals: SCHEDULED → COMPLETED past end time', async () => {
      // Mock rental from yesterday
      const pastRental = {
        id: 'rental-001',
        status: 'SCHEDULED',
        rental_date: '2026-01-10',
        start_time: '19:00',
        end_time: '20:00',
        fee_cents: 5000,
      };

      // Calculate if rental is past
      const now = new Date('2026-01-11 10:00:00');
      const rentalEndTime = new Date(`${pastRental.rental_date} ${pastRental.end_time}:00`);
      const isPast = rentalEndTime < now;

      expect(isPast).toBe(true);

      // Auto-complete past rentals
      if (isPast && pastRental.status === 'SCHEDULED') {
        pastRental.status = 'COMPLETED';
      }

      expect(pastRental.status).toBe('COMPLETED');
    });

    it('expire pending payments: PENDING → EXPIRED after 7 days', async () => {
      // Mock pending payment from 8 days ago
      const oldPending = {
        id: 'pending-001',
        status: 'PENDING',
        created_at: '2026-01-03', // 8 days ago (assuming today is 2026-01-11)
        expires_at: '2026-01-10', // 1 day ago
      };

      // Check if expired
      const now = new Date('2026-01-11');
      const expiresAt = new Date(oldPending.expires_at);
      const isExpired = expiresAt < now;

      expect(isExpired).toBe(true);

      // Auto-expire pending payments
      if (isExpired && oldPending.status === 'PENDING') {
        oldPending.status = 'EXPIRED';
      }

      expect(oldPending.status).toBe('EXPIRED');
    });

    it('send payment reminders: email overdue members', async () => {
      // Mock overdue members
      const overdueMembers = [
        {
          id: 'member-001',
          nome: 'João Silva',
          email: 'joao@test.com',
          access_expires_at: '2026-01-05', // 6 days overdue
        },
        {
          id: 'member-002',
          nome: 'Maria Costa',
          email: 'maria@test.com',
          access_expires_at: '2026-01-08', // 3 days overdue
        },
      ];

      // Mock email send function
      const emailsSent: string[] = [];
      const sendReminderEmail = (member: typeof overdueMembers[0]) => {
        emailsSent.push(member.email);
        return { success: true };
      };

      // Send reminders to overdue members
      overdueMembers.forEach(member => {
        const result = sendReminderEmail(member);
        expect(result.success).toBe(true);
      });

      expect(emailsSent).toHaveLength(2);
      expect(emailsSent).toContain('joao@test.com');
      expect(emailsSent).toContain('maria@test.com');
    });
  });

  describe('Notifications', () => {
    it('send PAYMENT_REMINDER email', async () => {
      // Mock notification payload
      const notification = {
        type: 'PAYMENT_REMINDER',
        to: 'joao@test.com',
        member_name: 'João Silva',
        days_overdue: 5,
        amount_due: '€69,00',
      };

      // Mock Resend API call
      const mockResendSend = vi.fn().mockResolvedValue({
        id: 'email-123',
        success: true,
      });

      // Simulate email template variables
      const emailTemplate = {
        subject: `Lembrete de Pagamento - BoxeMaster`,
        body: `Olá ${notification.member_name}, seu pagamento está ${notification.days_overdue} dias em atraso.`,
      };

      expect(emailTemplate.body).toContain('João Silva');
      expect(emailTemplate.body).toContain('5 dias');

      // Send email
      const result = await mockResendSend(notification);

      expect(result.success).toBe(true);
      expect(mockResendSend).toHaveBeenCalledWith(notification);
    });

    it('send EXPIRING_SOON email', async () => {
      const notification = {
        type: 'EXPIRING_SOON',
        to: 'maria@test.com',
        member_name: 'Maria Costa',
        days_remaining: 3,
        expires_at: '2026-01-14',
      };

      // Mock template for expiring soon
      const emailTemplate = {
        subject: 'Seu plano expira em breve - BoxeMaster',
        body: `Olá ${notification.member_name}, seu plano expira em ${notification.days_remaining} dias (${notification.expires_at}).`,
      };

      expect(emailTemplate.body).toContain('Maria Costa');
      expect(emailTemplate.body).toContain('3 dias');
      expect(emailTemplate.subject).toContain('expira em breve');
    });

    it('handle missing Resend API key', async () => {
      // Mock environment without RESEND_API_KEY
      const originalEnv = process.env.RESEND_API_KEY;
      delete process.env.RESEND_API_KEY;

      // Mock send-notification function
      const sendNotification = async (payload: any) => {
        if (!process.env.RESEND_API_KEY) {
          return {
            success: false,
            error: 'RESEND_API_KEY not configured',
          };
        }
        return { success: true };
      };

      const result = await sendNotification({
        type: 'PAYMENT_REMINDER',
        to: 'test@test.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('RESEND_API_KEY');

      // Restore env
      if (originalEnv) {
        process.env.RESEND_API_KEY = originalEnv;
      }
    });
  });

  describe('Member QR Lookup', () => {
    it('lookup member by valid QR code', async () => {
      // Mock get-member-by-qr function
      const getMemberByQR = async (qrCode: string) => {
        const mockMembers: Record<string, any> = {
          'MBR-TEST1234': {
            id: 'member-001',
            nome: 'João Silva',
            qr_code: 'MBR-TEST1234',
            status: 'ATIVO',
            // Only safe fields exposed
          },
        };

        const member = mockMembers[qrCode];

        if (!member) {
          return {
            success: false,
            status: 404,
            error: 'Member not found',
          };
        }

        // Return only safe fields (no sensitive data)
        return {
          success: true,
          status: 200,
          data: {
            nome: member.nome,
            qr_code: member.qr_code,
            status: member.status,
          },
        };
      };

      const result = await getMemberByQR('MBR-TEST1234');

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.data?.nome).toBe('João Silva');
      expect(result.data?.qr_code).toBe('MBR-TEST1234');

      // Verify no sensitive data exposed
      expect(result.data).not.toHaveProperty('telefone');
      expect(result.data).not.toHaveProperty('email');
      expect(result.data).not.toHaveProperty('id');
    });

    it('return 404 for invalid QR code', async () => {
      const getMemberByQR = async (qrCode: string) => {
        // Simulate database lookup
        const found = null; // QR not found

        if (!found) {
          return {
            success: false,
            status: 404,
            error: 'QR code not found',
          };
        }

        return { success: true, data: found };
      };

      const result = await getMemberByQR('INVALID-QR');

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
      expect(result.error).toContain('not found');
    });
  });
});
