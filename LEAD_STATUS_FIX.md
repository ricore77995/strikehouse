# Fix: LEAD Status Display - QR Code Page

**Data:** 11 de Janeiro de 2026
**Issue:** LEAD members showing "Acesso Expirado" incorrectly
**Severidade:** UX Bug (Low Risk - Display only)

---

## Problema Identificado

Quando um membro é criado como LEAD (sem acesso), a página pública do QR code (`/m/MBR-XXXXXXXX`) mostra:
- ❌ **INCORRETO:** "Acesso Expirado" (vermelho)
- ✅ **CORRETO:** "Aguardando Primeiro Pagamento" (amarelo/neutro)

### Por que é incorreto?

Um membro LEAD:
- Nunca teve acesso ao ginásio
- Não pode ter acesso "expirado" (algo que nunca existiu não pode expirar)
- Está aguardando primeiro pagamento para ativar

**Definição oficial (spec.md linha 116):**
```
| LEAD | Cadastrado, sem acesso | ❌ |
```

---

## Análise de Impacto

### Escopo: Display-Only Bug ✅

| Área | Afetada? | Impacto |
|------|----------|---------|
| Database schema | ❌ Não | Nenhum |
| RLS policies | ❌ Não | Nenhum |
| Check-in validation | ❌ Não | Continua bloqueando LEADs corretamente |
| Payment flows | ❌ Não | Nenhum |
| Member state transitions | ❌ Não | Nenhum |
| **QR code page display** | ✅ **SIM** | **Corrigido** |

### Arquivos Modificados

1. **src/pages/MemberQR.tsx** (linhas 74-107)
   - Adicionado tratamento específico para `status === 'LEAD'`
   - LEAD agora mostra badge amarelo com AlertCircle icon
   - Texto: "Aguardando Primeiro Pagamento"

2. **claude.md** (linhas 109-114)
   - Adicionada seção "IMPORTANT: LEAD Status Display Pattern"
   - Documentado padrão correto para implementações futuras

### Documentação Analisada

✅ **spec.md** - Nenhuma mudança necessária (já estava correto)
✅ **PROJECT_PLAN.md** - Nenhuma mudança necessária (bug fix em task existente 3.6)
✅ **claude.md** - Atualizado com novo padrão

---

## Implementação

### Antes:
```typescript
} else {
  return {
    icon: <XCircle className="h-5 w-5 text-red-600" />,
    text: member.status === 'BLOQUEADO' ? 'Acesso Bloqueado' :
          member.status === 'CANCELADO' ? 'Acesso Cancelado' : 'Acesso Expirado',
    color: 'text-red-600',
    bgColor: 'bg-red-50'
  };
}
```

### Depois:
```typescript
} else {
  // LEAD never had access - show neutral waiting state
  if (member.status === 'LEAD') {
    return {
      icon: <AlertCircle className="h-5 w-5 text-amber-600" />,
      text: 'Aguardando Primeiro Pagamento',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50'
    };
  }

  // Other statuses are actual errors (had access but lost it)
  return {
    icon: <XCircle className="h-5 w-5 text-red-600" />,
    text: member.status === 'BLOQUEADO' ? 'Acesso Bloqueado' :
          member.status === 'CANCELADO' ? 'Acesso Cancelado' : 'Acesso Expirado',
    color: 'text-red-600',
    bgColor: 'bg-red-50'
  };
}
```

---

## Estados Visuais

| Status | Badge Color | Icon | Texto |
|--------|-------------|------|-------|
| **ATIVO** (com acesso válido) | 🟢 Verde | CheckCircle | "Acesso Ativo" |
| **LEAD** (aguardando pagamento) | 🟡 Amarelo | AlertCircle | "Aguardando Primeiro Pagamento" |
| **BLOQUEADO** (expirado) | 🔴 Vermelho | XCircle | "Acesso Bloqueado" |
| **CANCELADO** (inativo) | 🔴 Vermelho | XCircle | "Acesso Cancelado" |
| **ATIVO** (com data expirada) | 🔴 Vermelho | XCircle | "Acesso Expirado" |

---

## Teste de Validação

### Passos:
1. Criar novo membro como LEAD (sem comprar plano)
2. Acessar `/m/MBR-XXXXXXXX` (QR code do membro)
3. Verificar badge **amarelo** com texto "Aguardando Primeiro Pagamento"
4. Comprar plano → status muda para ATIVO
5. Verificar badge **verde** com texto "Acesso Ativo"
6. Aguardar expiração → status muda para BLOQUEADO
7. Verificar badge **vermelho** com texto "Acesso Bloqueado"

### URL de Teste:
- Membro criado: http://localhost:8080/m/MBR-7366356A

---

## Lógica de Negócio (Inalterada)

O check-in validation (`src/hooks/useCheckin.ts` linhas 88-94) continua funcionando corretamente:

```typescript
// Check if LEAD (no active plan)
if (member.status === 'LEAD' || !member.access_type) {
  return {
    success: false,
    result: 'EXPIRED',  // Mapeado para 'BLOCKED' no banco
    member,
    message: 'Membro sem plano ativo. Favor regularizar situação.',
  };
}
```

**Importante:** A validação de check-in retorna `result: 'EXPIRED'`, mas isso é mapeado para `'BLOCKED'` ao salvar no banco via `mapToDatabaseResult()`.

---

## Conclusão

✅ **Fix implementado com sucesso**
✅ **Zero impacto em lógica de negócio**
✅ **Documentação atualizada**
✅ **Padrão estabelecido para futuras implementações**

A mudança é puramente visual e melhora a experiência do usuário ao diferenciar claramente:
- Estados de **espera** (LEAD - aguardando primeiro pagamento)
- Estados de **erro** (BLOQUEADO, CANCELADO, expirado)

---

**Última atualização:** 11 de Janeiro de 2026
