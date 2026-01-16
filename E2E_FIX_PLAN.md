# Plano: Corrigir 100% dos E2E Tests

**Data:** 2026-01-15
**Estado Actual:** 52 passam, 59 falham (47% sucesso)
**Objectivo:** 100% dos testes a passar

---

## Credenciais (MEMORIZAR)

```
staff@boxemaster.pt   → staff123
admin@boxemaster.pt   → admin123
partner@boxemaster.pt → partner123
owner@boxemaster.pt   → owner123
```

---

## Substituições em TODOS os 7 ficheiros

### Selectores (PODE usar sed global):
```
input[name="email"]    → input#email
input[name="password"] → input#password
```

### Passwords (NÃO PODE usar sed simples):

O `sed 's/boxemaster123/staff123/g'` está **ERRADO** porque os ficheiros misturam diferentes utilizadores!

---

## Análise por Ficheiro

### 1. access-control.spec.ts
| Linha | Email | Password |
|-------|-------|----------|
| 7 | staff@ | staff123 |
| 30 | admin@ | **admin123** |
| 75 | staff@ | staff123 |
| 108 | staff@ | staff123 |
| 126 | admin@ | **admin123** |
| 142 | staff@ | staff123 |
| 158 | staff@ | staff123 |

### 2. cash-session.spec.ts ✅ (só staff)
Todas as linhas: `staff@` → `staff123`

### 3. enrollment.spec.ts ✅ (só staff)
Todas as linhas: `staff@` → `staff123`

### 4. financial-operations.spec.ts
| Linha | Email | Password |
|-------|-------|----------|
| 8 | staff@ | staff123 |
| 91 | admin@ | **admin123** |
| 143 | admin@ | **admin123** |
| 177 | admin@ | **admin123** |
| 220 | admin@ | **admin123** |
| 276 | staff@ | staff123 |

### 5. member-lifecycle.spec.ts
| Linha | Email | Password |
|-------|-------|----------|
| 8 | staff@ | staff123 |
| 71 | staff@ | staff123 |
| 122 | staff@ | staff123 |
| 148 | staff@ | staff123 |
| 195 | admin@ | **admin123** |
| 217 | staff@ | staff123 |
| 258 | staff@ | staff123 |
| 321 | staff@ | staff123 |

### 6. payment-methods.spec.ts
| Linha | Email | Password |
|-------|-------|----------|
| 8 | staff@ | staff123 |
| 76 | staff@ | staff123 |
| 120 | staff@ | staff123 |
| 161 | staff@ | staff123 |
| 223 | admin@ | **admin123** |
| 249 | admin@ | **admin123** |
| 280 | admin@ | **admin123** |
| 328 | admin@ | **admin123** |
| 355 | staff@ | staff123 |

### 7. rentals-credits.spec.ts (MAIS COMPLEXO - 3 utilizadores)
| Linha | Email | Password |
|-------|-------|----------|
| 8 | admin@ | **admin123** |
| 76 | admin@ | **admin123** |
| 128 | admin@ | **admin123** |
| 219 | staff@ | staff123 |
| 261 | staff@ | staff123 |
| 304 | partner@ | **partner123** |
| 349 | partner@ | **partner123** |
| 396 | partner@ | **partner123** |
| 455 | partner@ | **partner123** |
| 497 | admin@ | **admin123** |

---

## Execução (2 passos)

### Passo 1: Substituir selectores (seguro - global)

```bash
for f in e2e/access-control.spec.ts e2e/cash-session.spec.ts e2e/enrollment.spec.ts e2e/financial-operations.spec.ts e2e/member-lifecycle.spec.ts e2e/payment-methods.spec.ts e2e/rentals-credits.spec.ts; do
  sed -i '' 's/input\[name="email"\]/input#email/g' "$f"
  sed -i '' 's/input\[name="password"\]/input#password/g' "$f"
done
```

### Passo 2: Substituir passwords

**Ficheiros só com staff@ (sed simples):**
```bash
sed -i '' 's/boxemaster123/staff123/g' e2e/cash-session.spec.ts
sed -i '' 's/boxemaster123/staff123/g' e2e/enrollment.spec.ts
```

**Ficheiros mistos (editar linha-a-linha):**

Ver tabelas acima para cada ficheiro.

---

## Verificação

```bash
# Não deve haver selectores antigos
grep -rn 'input\[name="email"\]' e2e/
grep -rn 'input\[name="password"\]' e2e/

# Não deve haver boxemaster123
grep -rn 'boxemaster123' e2e/

# Deve haver passwords correctas
grep -rn 'staff123\|admin123\|partner123' e2e/ | wc -l
# Esperado: ~50 ocorrências
```

---

## Teste Final

```bash
npm run test:e2e -- --project=chromium
```

**Esperado:** 0 failed, ~110 passed

---

## Resultado (2026-01-15)

### ✅ Selectores/Passwords: CORRIGIDO

```
boxemaster123:    0 restantes (era ~48)
input[name=]:     0 restantes (era ~94)
staff123:         30 ocorrências ✓
admin123:         25 ocorrências ✓
partner123:        4 ocorrências ✓
```

### Testes Restantes:
- **39 passam**
- **63 falham** (problemas de UI, não credenciais)
- **9 não executaram**

### Erros Restantes (diferentes de credenciais):
1. **Strict mode violation** - locators encontram múltiplos elementos
2. **Menu structure** - elementos de menu não encontrados
3. **UI flow** - logout/redirect behavior diferente
4. **Missing elements** - h1, h2, data-testid não existem

Próximo passo: Ajustar selectores dos testes para corresponder à UI actual.
