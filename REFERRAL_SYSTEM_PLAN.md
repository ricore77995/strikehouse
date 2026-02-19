# Feature: Sistema de Referral (Indicacao de Amigos)

## Resumo Executivo

Membros ATIVOS podem indicar amigos usando seu **codigo unico de referral** (ex: `REF-JOAO123`). Quando o amigo se matricula usando o codigo:
- **INDICADO** ganha desconto % na primeira mensalidade
- **INDICADOR** ganha desconto % na proxima renovacao (gerado automaticamente)

Beneficios expiram em **6 meses**. Usa a tabela `discounts` existente - sem nova tabela de creditos!

---

## Decisoes Confirmadas

| Decisao | Escolha |
|---------|---------|
| Identificacao | Codigo unico por membro (`REF-{NOME}{4DIGITOS}`) |
| Recompensa indicador | Desconto % na proxima renovacao |
| Beneficio indicado | Desconto % na primeira mensalidade |
| Expiracao | 6 meses |

---

## Modelo de Dados (Simplificado)

### 1. Adicionar campos em `members`
```sql
ALTER TABLE members
ADD COLUMN referral_code VARCHAR(20) UNIQUE,
ADD COLUMN referred_by UUID REFERENCES members(id);

-- Trigger para gerar codigo automaticamente para membros ATIVO
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'ATIVO' AND NEW.referral_code IS NULL THEN
    NEW.referral_code := 'REF-' ||
      UPPER(SUBSTRING(REGEXP_REPLACE(NEW.nome, '[^a-zA-Z]', '', 'g'), 1, 4)) ||
      LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2. Usar `discounts` para recompensas
Quando indicacao eh confirmada, sistema cria desconto automatico:
```sql
-- Desconto pessoal para o indicador
INSERT INTO discounts (
  code,              -- 'REWARD-{member_id}-{timestamp}'
  nome,              -- 'Recompensa Indicacao - Maria Silva'
  category,          -- 'promo'
  discount_type,     -- 'percentage'
  discount_value,    -- 10 (configuravel)
  valid_until,       -- NOW() + 6 months
  max_uses,          -- 1
  referrer_member_id -- FK para quem ganhou (novo campo)
) VALUES (...);
```

### 3. Novo campo em `discounts`
```sql
ALTER TABLE discounts
ADD COLUMN referrer_member_id UUID REFERENCES members(id);
-- Identifica descontos que sao recompensas de indicacao
```

---

## Fluxo de Uso

```
1. Joao eh membro ATIVO
   -> Sistema gera referral_code = 'REF-JOAO1234'
   -> Joao ve codigo na pagina /m/{qr_code}

2. Joao compartilha codigo com Maria

3. Staff cadastra Maria (LEAD)
   -> No enrollment, digita codigo 'REF-JOAO1234'
   -> Sistema encontra Joao como indicador
   -> members.referred_by = Joao.id

4. Maria paga (qualquer metodo)
   -> Maria ganha 10% desconto (codigo funciona como promo)
   -> Sistema cria desconto pessoal para Joao:
     code='REWARD-joao-uuid-1234', valid_until=+6meses, max_uses=1

5. Joao renova
   -> Staff ve "Desconto disponivel: 10% (Indicacao de Maria)"
   -> Aplica desconto -> discount.current_uses = 1
```

### Impacto por Role

| Role | O que muda |
|------|------------|
| **OWNER** | Ve relatorio de indicacoes e ROI do programa |
| **ADMIN** | Configura % de desconto do programa, ve metricas |
| **STAFF** | Digita codigo de referral no enrollment, ve descontos disponiveis |
| **PARTNER** | Nenhum impacto |
| **MEMBRO** | Ve seu codigo na pagina do QR, compartilha com amigos |

---

## Arquivos a Modificar

### Migrations (1 arquivo)
```
supabase/migrations/20260218_referral_system.sql
```
- ADD `referral_code` e `referred_by` em `members`
- ADD `referrer_member_id` em `discounts`
- CREATE trigger para gerar codigo ao ativar membro
- CREATE function para processar indicacao apos pagamento

### Backend
- `supabase/functions/stripe-webhook/index.ts` - Criar desconto para indicador apos pagamento
- `src/lib/referral.ts` (novo) - Logica de validacao e criacao de recompensa

### Frontend
- `src/pages/MemberQR.tsx` - Mostrar codigo de referral do membro
- `src/pages/staff/Enrollment.tsx` - Campo para digitar codigo de referral
- `src/pages/staff/Payment.tsx` - Mostrar descontos de indicacao disponiveis
- `src/pages/admin/Settings.tsx` - Configurar % do programa

### Hooks
- `src/hooks/useReferral.ts` (novo) - Validar codigo, buscar indicador, criar recompensa

### Types
- `make db-types` - Regenerar apos migration

---

## Use Cases

### UC-024: Membro Ve Seu Codigo de Referral
**Ator:** MEMBRO
**Pre-condicoes:** Membro eh ATIVO
**Fluxo:**
1. Membro acessa /m/{qr_code}
2. Pagina mostra QR code + codigo de referral (ex: REF-JOAO1234)
3. Membro compartilha codigo com amigo

### UC-025: Staff Matricula Membro Indicado
**Ator:** STAFF
**Pre-condicoes:** Indicador existe e eh ATIVO
**Fluxo:**
1. Staff acessa /staff/enrollment
2. Cria ou seleciona membro LEAD
3. No campo "Codigo de indicacao", digita REF-JOAO1234
4. Sistema valida: codigo existe, indicador eh ATIVO, indicador != indicado
5. Sistema mostra "Indicado por: Joao Silva - 10% desconto"
6. Staff continua com enrollment normal
7. Apos pagamento confirmado:
   - `members.referred_by` = Joao.id
   - Cria desconto pessoal para Joao (10%, valido 6 meses, 1 uso)

### UC-026: Indicador Usa Desconto de Recompensa
**Ator:** STAFF
**Pre-condicoes:** Indicador tem desconto de indicacao nao usado
**Fluxo:**
1. Staff acessa /staff/payment
2. Seleciona membro Joao
3. Sistema mostra: "Desconto disponivel: 10% (Indicou Maria em 15/02)"
4. Staff seleciona o desconto
5. Pricing engine aplica 10%
6. Apos pagamento: `discounts.current_uses++`

### UC-027: Admin Configura Programa de Indicacao
**Ator:** ADMIN
**Fluxo:**
1. Admin acessa /admin/settings
2. Secao "Programa de Indicacao":
   - Desconto para indicado: 10% (editavel)
   - Desconto para indicador: 10% (editavel)
   - Validade da recompensa: 6 meses
3. Salva -> `gym_settings.referral_discount_*`

---

## Regras de Negocio

- **RN-01**: Codigo de referral so eh gerado quando membro se torna ATIVO
- **RN-02**: Indicador deve ser ATIVO no momento da matricula do indicado
- **RN-03**: Indicador nao pode indicar a si mesmo (validar por email/telefone tambem)
- **RN-04**: Desconto do indicado eh aplicado via pricing engine (como promo code)
- **RN-05**: Recompensa do indicador eh criada APOS pagamento confirmado (nao antes)
- **RN-06**: Recompensa expira em 6 meses e tem uso unico
- **RN-07**: Membro pode ter multiplas recompensas (uma por indicacao)

---

## Riscos e Mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|---------------|---------|-----------|
| Auto-indicacao | Media | Medio | Validar indicador != indicado por ID, email e telefone |
| Codigo duplicado | Baixa | Baixo | UNIQUE constraint + retry com novo random |
| Stripe nao aplica desconto | Alta | Medio | Desconto local; Stripe cobra preco cheio, diferenca fica como credito |

---

## Configuracao (gym_settings)

```sql
-- Adicionar em gym_settings ou criar tabela referral_config
referral_referred_discount_pct INTEGER DEFAULT 10,  -- % para indicado
referral_referrer_discount_pct INTEGER DEFAULT 10,  -- % para indicador
referral_reward_validity_days INTEGER DEFAULT 180,  -- 6 meses
referral_enabled BOOLEAN DEFAULT true
```

---

## Verificacao

### Testes Manuais
1. Ativar membro -> verificar `referral_code` gerado
2. Abrir /m/{qr} -> verificar codigo visivel
3. Enrollment com codigo -> verificar desconto aplicado
4. Verificar `referred_by` preenchido
5. Verificar desconto criado para indicador
6. Renovar indicador -> usar desconto -> verificar aplicacao

### Testes Automatizados
```
src/tests/integration/referral-flow.test.ts
```
- TC-024: Codigo gerado ao ativar
- TC-025: Validacao de codigo (existe, ativo, nao self-referral)
- TC-026: Desconto aplicado ao indicado
- TC-027: Recompensa criada para indicador
- TC-028: Recompensa expira apos 6 meses
- TC-029: Recompensa so pode ser usada 1x
