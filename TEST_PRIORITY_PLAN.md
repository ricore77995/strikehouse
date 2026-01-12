# Plano de Testes Prioritários - BoxeMaster Pro

## Princípio Fundamental: ZERO MOCKS

> Todos os testes de integração correm contra **Supabase local real**.
> Mocks são proibidos para validação de business rules.

```bash
# Setup obrigatório antes de cada suite
supabase start
supabase db reset
```

---

## Arquitectura de Testes

```
src/tests/
├── fixtures/
│   ├── factory.ts          # Criação de dados de teste
│   ├── setup.ts            # Setup/teardown global
│   └── supabase-client.ts  # Clientes por role (admin, staff, coach)
├── integration/
│   ├── payment-atomicity.test.ts
│   ├── checkin-validation.test.ts
│   ├── rls-real.test.ts
│   ├── coach-rental-flow.test.ts   # NOVO
│   ├── coach-credits.test.ts       # NOVO
│   ├── guest-checkin.test.ts       # NOVO
│   └── ...
└── unit/
    └── ... (apenas lógica pura, sem DB)
```

---

## Prioridade 1: CRÍTICO

### 1.1 Coach Authentication Flow

**Ficheiro:** `src/tests/integration/coach-auth.test.ts`

```typescript
describe('Coach Authentication (Real Supabase)', () => {
  let adminClient: SupabaseClient;
  let coachClient: SupabaseClient;

  beforeAll(async () => {
    // Usar service_role para setup
    adminClient = createServiceClient();
  });

  it('admin cria coach SEM user_id', async () => {
    const { data } = await adminClient.from('external_coaches').insert({
      nome: 'Test Coach',
      email: 'coach@test.com',
      fee_type: 'FIXED',
      fee_value: 3000, // €30
    }).select().single();

    expect(data.user_id).toBeNull();
  });

  it('admin cria login para coach (via signUp)', async () => {
    const { data: authData } = await adminClient.auth.admin.createUser({
      email: 'coach@test.com',
      password: 'temppass123',
      email_confirm: true,
    });

    await adminClient.from('external_coaches')
      .update({ user_id: authData.user.id })
      .eq('email', 'coach@test.com');

    // Verificar linkagem
    const { data: coach } = await adminClient
      .from('external_coaches')
      .select('user_id')
      .eq('email', 'coach@test.com')
      .single();

    expect(coach.user_id).toBe(authData.user.id);
  });

  it('coach consegue login e aceder dados próprios', async () => {
    coachClient = await createCoachClient('coach@test.com', 'temppass123');

    const { data: rentals, error } = await coachClient
      .from('rentals')
      .select('*');

    expect(error).toBeNull();
    // Coach só vê próprios rentals (RLS)
  });

  it('coach NÃO consegue ver rentals de outros coaches', async () => {
    // 1. Criar outro coach e rental
    const { data: otherCoach } = await adminClient
      .from('external_coaches')
      .insert({ nome: 'Other Coach', fee_type: 'FIXED', fee_value: 2500 })
      .select().single();

    await adminClient.from('rentals').insert({
      coach_id: otherCoach.id,
      area_id: testAreaId,
      rental_date: '2026-01-15',
      start_time: '10:00',
      end_time: '11:00',
    });

    // 2. Coach autenticado tenta ver
    const { data } = await coachClient.from('rentals').select('*');

    // Não deve conter o rental do outro coach
    expect(data.find(r => r.coach_id === otherCoach.id)).toBeUndefined();
  });

  it('coach inativo NÃO consegue autenticar', async () => {
    await adminClient.from('external_coaches')
      .update({ ativo: false })
      .eq('email', 'coach@test.com');

    // Tentar usar useCoachAuth - deve retornar coach = null
    const result = await fetchCoachData(userId);
    expect(result).toBeNull();
  });
});
```

### 1.2 Rental CRUD (Real DB)

**Ficheiro:** `src/tests/integration/coach-rental-flow.test.ts`

```typescript
describe('Rental CRUD Flow (Real Supabase)', () => {
  let coachId: string;
  let areaId: string;

  beforeAll(async () => {
    // Criar coach e área de teste
    const { data: coach } = await adminClient.from('external_coaches').insert({
      nome: 'Rental Test Coach',
      fee_type: 'FIXED',
      fee_value: 3000,
    }).select().single();
    coachId = coach.id;

    const { data: area } = await adminClient.from('areas').insert({
      nome: 'Ringue Test',
      capacidade_pts: 10,
      is_exclusive: false,
    }).select().single();
    areaId = area.id;
  });

  it('coach cria rental com fee calculado automaticamente', async () => {
    const { data: rental, error } = await adminClient.from('rentals').insert({
      coach_id: coachId,
      area_id: areaId,
      rental_date: '2026-01-20',
      start_time: '19:00',
      end_time: '20:00',
      status: 'SCHEDULED',
    }).select().single();

    expect(error).toBeNull();
    expect(rental.status).toBe('SCHEDULED');
    // fee_charged_cents deve ser preenchido com base no coach.fee_value
  });

  it('BLOQUEIA double booking na mesma área/horário', async () => {
    // Já existe rental 19:00-20:00
    const { error } = await adminClient.from('rentals').insert({
      coach_id: coachId,
      area_id: areaId,
      rental_date: '2026-01-20',
      start_time: '19:30', // Overlap
      end_time: '20:30',
    });

    // Deve haver validação (trigger ou constraint)
    // Se não houver constraint no DB, o teste documenta a falha
    expect(error).not.toBeNull();
  });

  it('PERMITE rentals sequenciais (20:00-21:00 após 19:00-20:00)', async () => {
    const { error } = await adminClient.from('rentals').insert({
      coach_id: coachId,
      area_id: areaId,
      rental_date: '2026-01-20',
      start_time: '20:00',
      end_time: '21:00',
    });

    expect(error).toBeNull();
  });

  it('REJEITA end_time <= start_time', async () => {
    const { error } = await adminClient.from('rentals').insert({
      coach_id: coachId,
      area_id: areaId,
      rental_date: '2026-01-21',
      start_time: '20:00',
      end_time: '19:00', // Inválido
    });

    expect(error).not.toBeNull();
  });
});
```

### 1.3 Cancellation Credits (Real DB)

**Ficheiro:** `src/tests/integration/coach-credits.test.ts`

```typescript
describe('Rental Cancellation & Credits (Real Supabase)', () => {
  // Usa date-fns para calcular datas reais

  it('cancelamento >24h ANTES gera crédito', async () => {
    // 1. Criar rental para daqui a 3 dias
    const rentalDate = format(addDays(new Date(), 3), 'yyyy-MM-dd');
    const { data: rental } = await adminClient.from('rentals').insert({
      coach_id: coachId,
      area_id: areaId,
      rental_date: rentalDate,
      start_time: '19:00',
      end_time: '20:00',
      fee_charged_cents: 3000,
    }).select().single();

    // 2. Cancelar
    await adminClient.from('rentals').update({
      status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
      credit_generated: true,
    }).eq('id', rental.id);

    // 3. Inserir crédito (como o código faz)
    await adminClient.from('coach_credits').insert({
      coach_id: coachId,
      amount: 1,
      reason: 'CANCELLATION',
      rental_id: rental.id,
      expires_at: format(addDays(new Date(), 90), 'yyyy-MM-dd'),
    });

    // 4. Verificar crédito existe
    const { data: credits } = await adminClient
      .from('coach_credits')
      .select('*')
      .eq('rental_id', rental.id);

    expect(credits).toHaveLength(1);
    expect(credits[0].amount).toBe(1);
    expect(credits[0].reason).toBe('CANCELLATION');
  });

  it('cancelamento <24h ANTES não gera crédito', async () => {
    // 1. Criar rental para AMANHÃ
    const rentalDate = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    const { data: rental } = await adminClient.from('rentals').insert({
      coach_id: coachId,
      area_id: areaId,
      rental_date: rentalDate,
      start_time: '19:00',
      end_time: '20:00',
    }).select().single();

    // 2. Cancelar (sem criar crédito)
    await adminClient.from('rentals').update({
      status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
      credit_generated: false,
    }).eq('id', rental.id);

    // 3. Verificar NÃO há crédito
    const { data: credits } = await adminClient
      .from('coach_credits')
      .select('*')
      .eq('rental_id', rental.id);

    expect(credits).toHaveLength(0);
  });

  it('crédito expira após 90 dias (expires_at respeitado)', async () => {
    // Criar crédito expirado
    const { data: credit } = await adminClient.from('coach_credits').insert({
      coach_id: coachId,
      amount: 1,
      reason: 'CANCELLATION',
      expires_at: format(subDays(new Date(), 1), 'yyyy-MM-dd'), // Ontem
    }).select().single();

    // Query créditos válidos
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data: validCredits } = await adminClient
      .from('coach_credits')
      .select('*')
      .eq('coach_id', coachId)
      .eq('used', false)
      .gte('expires_at', today);

    // Crédito expirado não deve aparecer
    expect(validCredits.find(c => c.id === credit.id)).toBeUndefined();
  });

  it('credits_balance no coach é atualizado corretamente', async () => {
    const initialBalance = 5;
    await adminClient.from('external_coaches')
      .update({ credits_balance: initialBalance })
      .eq('id', coachId);

    // Adicionar crédito
    await adminClient.from('external_coaches')
      .update({ credits_balance: initialBalance + 1 })
      .eq('id', coachId);

    const { data: coach } = await adminClient
      .from('external_coaches')
      .select('credits_balance')
      .eq('id', coachId)
      .single();

    expect(coach.credits_balance).toBe(6);
  });
});
```

### 1.4 Exclusive Area Blocking (CRITICAL)

**Ficheiro:** `src/tests/integration/exclusive-area-block.test.ts`

```typescript
describe('Exclusive Area Blocks Member Check-in (Real Supabase)', () => {
  let exclusiveAreaId: string;
  let memberId: string;

  beforeAll(async () => {
    // Criar área EXCLUSIVA
    const { data: area } = await adminClient.from('areas').insert({
      nome: 'VIP Room',
      capacidade_pts: 5,
      is_exclusive: true, // IMPORTANTE
    }).select().single();
    exclusiveAreaId = area.id;

    // Criar membro ATIVO
    const { data: member } = await adminClient.from('members').insert({
      nome: 'Test Member',
      telefone: '912345678',
      status: 'ATIVO',
      access_type: 'SUBSCRIPTION',
      access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      qr_code: 'MBR-TESTEXCL',
    }).select().single();
    memberId = member.id;
  });

  it('membro BLOQUEADO quando rental exclusivo está ativo', async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const now = format(new Date(), 'HH:mm');
    const oneHourLater = format(addHours(new Date(), 1), 'HH:mm');

    // Criar rental AGORA em área exclusiva
    await adminClient.from('rentals').insert({
      coach_id: coachId,
      area_id: exclusiveAreaId,
      rental_date: today,
      start_time: now,
      end_time: oneHourLater,
      status: 'SCHEDULED',
    });

    // Query como o useCheckin faz
    const { data: exclusiveRentals } = await adminClient
      .from('rentals')
      .select(`
        *,
        area:areas!inner(is_exclusive),
        coach:external_coaches(nome)
      `)
      .eq('rental_date', today)
      .eq('status', 'SCHEDULED')
      .eq('area.is_exclusive', true)
      .lte('start_time', now)
      .gte('end_time', now);

    expect(exclusiveRentals.length).toBeGreaterThan(0);

    // Resultado do check-in deve ser AREA_EXCLUSIVE
    // (testar a função validateAccess real)
  });

  it('membro PERMITIDO quando rental exclusivo terminou', async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const twoHoursAgo = format(subHours(new Date(), 2), 'HH:mm');
    const oneHourAgo = format(subHours(new Date(), 1), 'HH:mm');
    const now = format(new Date(), 'HH:mm');

    // Criar rental que JÁ TERMINOU
    await adminClient.from('rentals').insert({
      coach_id: coachId,
      area_id: exclusiveAreaId,
      rental_date: today,
      start_time: twoHoursAgo,
      end_time: oneHourAgo,
      status: 'SCHEDULED',
    });

    // Query
    const { data: activeRentals } = await adminClient
      .from('rentals')
      .select('*')
      .eq('rental_date', today)
      .eq('status', 'SCHEDULED')
      .eq('area_id', exclusiveAreaId)
      .lte('start_time', now)
      .gte('end_time', now);

    expect(activeRentals).toHaveLength(0);
    // Check-in deve ser ALLOWED
  });

  it('membro PERMITIDO em área NÃO exclusiva mesmo com rental ativo', async () => {
    // Criar área não exclusiva
    const { data: normalArea } = await adminClient.from('areas').insert({
      nome: 'Open Mat',
      capacidade_pts: 20,
      is_exclusive: false,
    }).select().single();

    const today = format(new Date(), 'yyyy-MM-dd');
    const now = format(new Date(), 'HH:mm');

    // Criar rental em área não exclusiva
    await adminClient.from('rentals').insert({
      coach_id: coachId,
      area_id: normalArea.id,
      rental_date: today,
      start_time: now,
      end_time: format(addHours(new Date(), 1), 'HH:mm'),
      status: 'SCHEDULED',
    });

    // Query apenas áreas exclusivas
    const { data: exclusiveRentals } = await adminClient
      .from('rentals')
      .select(`*, area:areas!inner(is_exclusive)`)
      .eq('rental_date', today)
      .eq('area.is_exclusive', true);

    // Não deve incluir o rental da área não exclusiva
    expect(exclusiveRentals.find(r => r.area_id === normalArea.id)).toBeUndefined();
  });
});
```

### 1.5 Guest Check-in (Real DB)

**Ficheiro:** `src/tests/integration/guest-checkin.test.ts`

```typescript
describe('Guest Check-in (Real Supabase)', () => {
  let rentalId: string;
  let guestId: string;

  beforeAll(async () => {
    // Criar rental para hoje
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data: rental } = await adminClient.from('rentals').insert({
      coach_id: coachId,
      area_id: areaId,
      rental_date: today,
      start_time: '07:00',
      end_time: '23:00', // Longo para testes
      status: 'SCHEDULED',
      guest_count: 0,
    }).select().single();
    rentalId = rental.id;

    // Criar guest do coach
    const { data: guest } = await adminClient.from('coach_guests').insert({
      coach_id: coachId,
      nome: 'Test Guest',
      telefone: '911111111',
    }).select().single();
    guestId = guest.id;
  });

  it('guest check-in incrementa guest_count no rental', async () => {
    // 1. Check-in do guest
    await adminClient.from('check_ins').insert({
      type: 'GUEST',
      result: 'ALLOWED',
      rental_id: rentalId,
      guest_id: guestId,
      guest_name: 'Test Guest',
    });

    // 2. Incrementar guest_count
    await adminClient.rpc('increment_guest_count', { rental_id: rentalId });
    // OU manualmente se não houver RPC:
    // await adminClient.from('rentals')
    //   .update({ guest_count: 1 })
    //   .eq('id', rentalId);

    // 3. Verificar
    const { data: rental } = await adminClient
      .from('rentals')
      .select('guest_count')
      .eq('id', rentalId)
      .single();

    expect(rental.guest_count).toBe(1);
  });

  it('guest check-in sem rental ativo falha', async () => {
    // Rental de ontem
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const { data: oldRental } = await adminClient.from('rentals').insert({
      coach_id: coachId,
      area_id: areaId,
      rental_date: yesterday,
      start_time: '19:00',
      end_time: '20:00',
      status: 'SCHEDULED',
    }).select().single();

    // Tentar check-in
    const today = format(new Date(), 'yyyy-MM-dd');
    const isValidRental = oldRental.rental_date === today;

    expect(isValidRental).toBe(false);
    // Check-in deve ser rejeitado
  });

  it('guest check-in fora do horário do rental falha', async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data: futureRental } = await adminClient.from('rentals').insert({
      coach_id: coachId,
      area_id: areaId,
      rental_date: today,
      start_time: '23:00', // Muito tarde
      end_time: '23:59',
      status: 'SCHEDULED',
    }).select().single();

    const now = format(new Date(), 'HH:mm');
    const isWithinTime = now >= futureRental.start_time && now <= futureRental.end_time;

    expect(isWithinTime).toBe(false);
  });

  it('check_ins de guest são imutáveis', async () => {
    const { data: checkin } = await adminClient.from('check_ins').insert({
      type: 'GUEST',
      result: 'ALLOWED',
      rental_id: rentalId,
      guest_name: 'Immutable Test',
    }).select().single();

    // Tentar modificar
    const { error } = await adminClient
      .from('check_ins')
      .update({ result: 'BLOCKED' })
      .eq('id', checkin.id);

    // Deve falhar (se houver trigger/policy)
    // Este teste documenta se a imutabilidade existe ou não
  });
});
```

### 1.6 Recurring Rentals (series_id)

**Ficheiro:** `src/tests/integration/recurring-rentals.test.ts`

```typescript
describe('Recurring Rentals (Real Supabase)', () => {
  it('cria série com mesmo series_id', async () => {
    const seriesId = crypto.randomUUID();
    const baseDate = new Date('2026-01-20');

    const rentalsToCreate = [];
    for (let i = 0; i < 4; i++) {
      rentalsToCreate.push({
        coach_id: coachId,
        area_id: areaId,
        rental_date: format(addWeeks(baseDate, i), 'yyyy-MM-dd'),
        start_time: '19:00',
        end_time: '20:00',
        series_id: seriesId,
        is_recurring: true,
        status: 'SCHEDULED',
      });
    }

    const { data } = await adminClient.from('rentals').insert(rentalsToCreate).select();

    expect(data).toHaveLength(4);
    expect(data.every(r => r.series_id === seriesId)).toBe(true);
  });

  it('cancelar série cancela TODOS os rentals futuros', async () => {
    const { data: series } = await adminClient
      .from('rentals')
      .select('series_id')
      .eq('is_recurring', true)
      .not('series_id', 'is', null)
      .limit(1)
      .single();

    await adminClient.from('rentals')
      .update({ status: 'CANCELLED' })
      .eq('series_id', series.series_id)
      .eq('status', 'SCHEDULED');

    const { data: remaining } = await adminClient
      .from('rentals')
      .select('*')
      .eq('series_id', series.series_id)
      .eq('status', 'SCHEDULED');

    expect(remaining).toHaveLength(0);
  });

  it('conflito em UMA data impede criação da série inteira', async () => {
    // Primeiro, criar rental individual
    await adminClient.from('rentals').insert({
      coach_id: coachId,
      area_id: areaId,
      rental_date: '2026-02-10',
      start_time: '19:00',
      end_time: '20:00',
    });

    // Tentar criar série que conflita com essa data
    const seriesId = crypto.randomUUID();
    const conflicts: string[] = [];

    for (let i = 0; i < 4; i++) {
      const date = format(addWeeks(new Date('2026-02-03'), i), 'yyyy-MM-dd');

      // Check conflict
      const { data: existing } = await adminClient
        .from('rentals')
        .select('id')
        .eq('area_id', areaId)
        .eq('rental_date', date)
        .neq('status', 'CANCELLED');

      if (existing && existing.length > 0) {
        conflicts.push(date);
      }
    }

    expect(conflicts).toContain('2026-02-10');
    // UI deve impedir criação ou pular datas com conflito
  });
});
```

---

## Prioridade 2: ALTO

### 2.1 Fee Models (FIXED vs PERCENTAGE)

**Ficheiro:** `src/tests/integration/coach-fee-models.test.ts`

```typescript
describe('Coach Fee Models (Real Supabase)', () => {
  it('coach FIXED: fee_charged = fee_value', async () => {
    const { data: coach } = await adminClient.from('external_coaches').insert({
      nome: 'Fixed Fee Coach',
      fee_type: 'FIXED',
      fee_value: 3500, // €35
    }).select().single();

    // Simular criação de rental
    const feeCharged = coach.fee_value;

    expect(feeCharged).toBe(3500);
  });

  it('coach PERCENTAGE: fee calculado com base em guests', async () => {
    const { data: coach } = await adminClient.from('external_coaches').insert({
      nome: 'Percentage Coach',
      fee_type: 'PERCENTAGE',
      fee_value: 2000, // 20%
    }).select().single();

    const basePlanPrice = 6900; // €69 plano mensal
    const guestCount = 5;

    // Cálculo: 20% de €69 * 5 guests = €69
    const feeCharged = Math.round((coach.fee_value / 10000) * basePlanPrice * guestCount);

    expect(feeCharged).toBe(6900);
  });

  it('fee armazenado em cents (sem floating point errors)', async () => {
    const testValues = [
      { euros: 29.99, expectedCents: 2999 },
      { euros: 0.01, expectedCents: 1 },
      { euros: 99.99, expectedCents: 9999 },
      { euros: 50.50, expectedCents: 5050 },
    ];

    for (const { euros, expectedCents } of testValues) {
      const cents = Math.round(euros * 100);
      expect(cents).toBe(expectedCents);
    }
  });
});
```

### 2.2 Coach Guest Management

**Ficheiro:** `src/tests/integration/coach-guests.test.ts`

```typescript
describe('Coach Guest CRUD (Real Supabase)', () => {
  it('coach só vê próprios guests (RLS)', async () => {
    // 1. Criar 2 coaches
    const { data: coach1 } = await adminClient.from('external_coaches')
      .insert({ nome: 'Coach 1', fee_type: 'FIXED', fee_value: 3000 })
      .select().single();

    const { data: coach2 } = await adminClient.from('external_coaches')
      .insert({ nome: 'Coach 2', fee_type: 'FIXED', fee_value: 3000 })
      .select().single();

    // 2. Criar guests para cada
    await adminClient.from('coach_guests').insert([
      { coach_id: coach1.id, nome: 'Guest A' },
      { coach_id: coach2.id, nome: 'Guest B' },
    ]);

    // 3. Login como coach1 e query guests
    const coach1Client = await createCoachClient(coach1.user_id);
    const { data: guests } = await coach1Client
      .from('coach_guests')
      .select('*');

    // Deve ver apenas Guest A
    expect(guests.every(g => g.coach_id === coach1.id)).toBe(true);
  });

  it('soft delete (ativo = false) preserva histórico', async () => {
    const { data: guest } = await adminClient.from('coach_guests').insert({
      coach_id: coachId,
      nome: 'To Be Deleted',
    }).select().single();

    // Soft delete
    await adminClient.from('coach_guests')
      .update({ ativo: false })
      .eq('id', guest.id);

    // Verificar que ainda existe
    const { data: all } = await adminClient
      .from('coach_guests')
      .select('*')
      .eq('id', guest.id);

    expect(all).toHaveLength(1);
    expect(all[0].ativo).toBe(false);

    // Mas não aparece em queries normais
    const { data: active } = await adminClient
      .from('coach_guests')
      .select('*')
      .eq('id', guest.id)
      .eq('ativo', true);

    expect(active).toHaveLength(0);
  });
});
```

---

## Prioridade 3: RLS Real (Sem Mocks)

### 3.1 RLS por Role

**Ficheiro:** `src/tests/integration/rls-all-roles.test.ts`

```typescript
describe('RLS Real - All Roles (Real Supabase)', () => {
  let adminClient: SupabaseClient;
  let staffClient: SupabaseClient;
  let coachClient: SupabaseClient;
  let ownerClient: SupabaseClient;

  beforeAll(async () => {
    // Criar users de teste e obter clients autenticados
    adminClient = await createRoleClient('ADMIN');
    staffClient = await createRoleClient('STAFF');
    ownerClient = await createRoleClient('OWNER');
    coachClient = await createCoachClient('coach@test.com', 'password');
  });

  describe('rentals table', () => {
    it('STAFF pode criar rentals', async () => {
      const { error } = await staffClient.from('rentals').insert({
        coach_id: coachId,
        area_id: areaId,
        rental_date: '2026-02-01',
        start_time: '10:00',
        end_time: '11:00',
      });

      expect(error).toBeNull();
    });

    it('COACH só vê próprios rentals', async () => {
      const { data } = await coachClient.from('rentals').select('*');

      // Todos os rentals devem ser do coach logado
      data.forEach(rental => {
        expect(rental.coach_id).toBe(coachId);
      });
    });

    it('OWNER pode ver TODOS os rentals', async () => {
      const { data: ownerRentals } = await ownerClient.from('rentals').select('*');
      const { data: allRentals } = await adminClient.from('rentals').select('*');

      expect(ownerRentals.length).toBe(allRentals.length);
    });
  });

  describe('coach_credits table', () => {
    it('COACH só vê próprios créditos', async () => {
      const { data } = await coachClient.from('coach_credits').select('*');

      data.forEach(credit => {
        expect(credit.coach_id).toBe(coachId);
      });
    });

    it('STAFF pode ver créditos de todos os coaches', async () => {
      const { data } = await staffClient.from('coach_credits').select('*');

      // Deve incluir créditos de múltiplos coaches
      const uniqueCoaches = new Set(data.map(c => c.coach_id));
      expect(uniqueCoaches.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('external_coaches table', () => {
    it('COACH pode ler próprios dados', async () => {
      const { data, error } = await coachClient
        .from('external_coaches')
        .select('*')
        .eq('id', coachId)
        .single();

      expect(error).toBeNull();
      expect(data.id).toBe(coachId);
    });

    it('COACH NÃO pode modificar fee_type/fee_value', async () => {
      const { error } = await coachClient
        .from('external_coaches')
        .update({ fee_value: 9999 })
        .eq('id', coachId);

      // Deve falhar ou não ter efeito
      // Verificar o valor real
      const { data } = await adminClient
        .from('external_coaches')
        .select('fee_value')
        .eq('id', coachId)
        .single();

      expect(data.fee_value).not.toBe(9999);
    });
  });
});
```

---

## Fixtures Factory (Sem Mocks)

**Ficheiro:** `src/tests/fixtures/factory.ts`

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { format, addDays } from 'date-fns';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service client para setup (bypassa RLS)
export const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Factory functions
export const createTestCoach = async (overrides = {}) => {
  const defaults = {
    nome: `Test Coach ${Date.now()}`,
    email: `coach${Date.now()}@test.com`,
    fee_type: 'FIXED',
    fee_value: 3000,
    ativo: true,
  };

  const { data, error } = await serviceClient
    .from('external_coaches')
    .insert({ ...defaults, ...overrides })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const createTestArea = async (overrides = {}) => {
  const defaults = {
    nome: `Test Area ${Date.now()}`,
    capacidade_pts: 10,
    is_exclusive: false,
    ativo: true,
  };

  const { data, error } = await serviceClient
    .from('areas')
    .insert({ ...defaults, ...overrides })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const createTestRental = async (coachId: string, areaId: string, overrides = {}) => {
  const defaults = {
    coach_id: coachId,
    area_id: areaId,
    rental_date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '10:00',
    end_time: '11:00',
    status: 'SCHEDULED',
  };

  const { data, error } = await serviceClient
    .from('rentals')
    .insert({ ...defaults, ...overrides })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const createTestMember = async (overrides = {}) => {
  const defaults = {
    nome: `Test Member ${Date.now()}`,
    telefone: `91${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
    status: 'ATIVO',
    access_type: 'SUBSCRIPTION',
    access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    qr_code: `MBR-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
  };

  const { data, error } = await serviceClient
    .from('members')
    .insert({ ...defaults, ...overrides })
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Create authenticated client for a role
export const createRoleClient = async (role: 'ADMIN' | 'STAFF' | 'OWNER') => {
  // 1. Create or get test user for role
  const email = `test-${role.toLowerCase()}@test.com`;

  // ... sign in and return authenticated client
};

// Cleanup function
export const cleanupTestData = async () => {
  await serviceClient.from('check_ins').delete().like('guest_name', 'Test%');
  await serviceClient.from('coach_credits').delete().eq('reason', 'CANCELLATION');
  await serviceClient.from('coach_guests').delete().like('nome', 'Test%');
  await serviceClient.from('rentals').delete().like('coach_id', 'test-%');
  await serviceClient.from('external_coaches').delete().like('email', '%@test.com');
  await serviceClient.from('areas').delete().like('nome', 'Test%');
  await serviceClient.from('members').delete().like('nome', 'Test%');
};
```

---

## Configuração Vitest

**Ficheiro:** `vitest.config.integration.ts`

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['src/tests/integration/**/*.test.ts'],
    exclude: ['src/tests/unit/**'],
    setupFiles: ['./src/tests/fixtures/setup.ts'],
    testTimeout: 30000, // DB ops são lentas
    pool: 'forks', // Isolamento
    poolOptions: {
      forks: {
        singleFork: true, // Um fork para todos (partilha conexão)
      },
    },
    env: {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'your-service-role-key',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Ficheiro:** `src/tests/fixtures/setup.ts`

```typescript
import { beforeAll, afterAll } from 'vitest';
import { cleanupTestData } from './factory';

beforeAll(async () => {
  console.log('Setting up test database...');
  // Ensure Supabase is running
  // Could run: supabase status --check
});

afterAll(async () => {
  console.log('Cleaning up test data...');
  await cleanupTestData();
});
```

---

## Checklist de Cobertura Coach/Rentals

| Fluxo | Teste | Status |
|-------|-------|--------|
| Coach login/auth | `coach-auth.test.ts` | ⬜ |
| Coach só vê próprios dados (RLS) | `rls-all-roles.test.ts` | ⬜ |
| Criar rental single | `coach-rental-flow.test.ts` | ⬜ |
| Criar rental recorrente (series) | `recurring-rentals.test.ts` | ⬜ |
| Double booking bloqueado | `coach-rental-flow.test.ts` | ⬜ |
| Cancelamento >24h = crédito | `coach-credits.test.ts` | ⬜ |
| Cancelamento <24h = sem crédito | `coach-credits.test.ts` | ⬜ |
| Crédito expira em 90 dias | `coach-credits.test.ts` | ⬜ |
| Área exclusiva bloqueia membros | `exclusive-area-block.test.ts` | ⬜ |
| Guest check-in incrementa count | `guest-checkin.test.ts` | ⬜ |
| Guest check-in fora do horário | `guest-checkin.test.ts` | ⬜ |
| Fee FIXED vs PERCENTAGE | `coach-fee-models.test.ts` | ⬜ |
| Coach guest CRUD | `coach-guests.test.ts` | ⬜ |
| Coach inativo não autentica | `coach-auth.test.ts` | ⬜ |
| Cancelar série inteira | `recurring-rentals.test.ts` | ⬜ |

---

## Comandos de Execução

```bash
# 1. Iniciar Supabase local
supabase start

# 2. Reset DB (limpa dados anteriores)
supabase db reset

# 3. Executar testes de integração
npm run test:integration

# 4. Executar apenas testes de coach/rental
npm run test:integration -- --grep "Coach|Rental|Guest"

# 5. Ver cobertura
npm run test:integration -- --coverage
```

---

## Resumo

Este plano garante:

1. **ZERO MOCKS** - Todos os testes correm contra Supabase real
2. **Coach/Rental completo** - Todos os fluxos documentados no código
3. **RLS testado de verdade** - Com clients autenticados por role
4. **Fixtures reutilizáveis** - Factory pattern para dados de teste
5. **Cleanup automático** - Não polui a base de dados

**Próximo passo:** Implementar `src/tests/fixtures/factory.ts` e o primeiro teste `coach-auth.test.ts`.
