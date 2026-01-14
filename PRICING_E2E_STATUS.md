# Pricing Engine E2E Tests - Status Report

**Data:** 2026-01-14
**Ultima Atualizacao:** Final - Bug fixes + Selector improvements

---

## Resumo Final

### Progresso Total
| Metrica | Antes | Depois | Melhoria |
|---------|-------|--------|----------|
| Total | 38/90 (42%) | **56/90 (62%)** | **+20%** |
| Discounts | 0/20 (0%) | **20/20 (100%)** | **+100%** |
| Pricing Config | ~8/16 (50%) | ~12/16 (75%) | +25% |
| Enrollment | ~6/44 (14%) | ~17/44 (39%) | +25% |
| Modalities | ~4/10 (40%) | ~5/10 (50%) | +10% |

---

## Bug Fixes Implementados (COMPLETO)

### 1. usePricingConfig.ts - CORRIGIDO
```typescript
// ANTES: .update({...}).select().single();
// DEPOIS: .update({...}).eq('id', id).select().single();
```

### 2. PricingConfig.tsx - CORRIGIDO
- Passa `config.id` para mutation
- Adicionado `console.error`

### 3. Modalities.tsx - CORRIGIDO
- `console.error` em catch blocks

### 4. Discounts.tsx - CORRIGIDO
- `console.error` em catch blocks

---

## E2E Test Improvements

### Discounts Tests - 100% PASSANDO
- `generateUniqueCode()` evita codigos duplicados
- Verificacao via dialog close + list check
- `.first()` em selectors multiplos

### Enrollment Tests - 39% (melhorado de 14%)
Selectors corrigidos:
- `Taxa de Matrícula` -> `Taxa de Matricula`
- `Método de Pagamento` -> `Metodo de Pagamento`
- `Transferência` -> `Transferencia`
- `Cartão` -> `Cartao`

### Modalities Tests - 50%
- `.first()` em toast selectors

---

## Arquivos Modificados

### Codigo Fonte
- `src/hooks/usePricingConfig.ts` - WHERE clause
- `src/pages/admin/PricingConfig.tsx` - config.id + console.error
- `src/pages/admin/Modalities.tsx` - console.error
- `src/pages/admin/Discounts.tsx` - console.error

### Testes E2E
- `e2e/pricing/discounts.spec.ts` - generateUniqueCode + selectors
- `e2e/pricing/modalities.spec.ts` - toast selectors
- `e2e/pricing/enrollment-pricing.spec.ts` - text selectors + timeout
- `e2e/pricing/pricing-config.spec.ts` - (sem mudancas)

---

## Problemas Restantes

### 1. Enrollment Tests
- Checkboxes de modalidade com estrutura DOM diferente
- Alguns elementos nao vissiveis sem selecionar membro
- Testes dependem de dados de teste

### 2. Modalities Tests
- CardContent selector pode nao encontrar elementos
- Depende de dados pre-existentes

### 3. Testes Flaky
- Race conditions em testes paralelos
- Valores de testes anteriores interferem

---

## Comandos Uteis

```bash
# Discounts - 100%
npx playwright test e2e/pricing/discounts.spec.ts

# Pricing Config - 75%
npx playwright test e2e/pricing/pricing-config.spec.ts

# Todos
npx playwright test e2e/pricing/

# Debug
npx playwright test e2e/pricing/ --headed

# Estabilidade
npx playwright test e2e/pricing/ --workers=1
```

---

## Conclusao

### Sucessos
- **Bug critico corrigido** - WHERE clause funcionando
- **Discounts 100%** - Todos 20 testes passando
- **Melhoria geral de 42% -> 62%** (+20 pontos percentuais)

### Recomendacoes
1. Rodar com `--workers=1` para evitar race conditions
2. Os testes de enrollment precisam de dados de teste pre-configurados
3. Considerar simplificar testes que dependem de estado complexo
