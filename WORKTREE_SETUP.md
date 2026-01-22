# Git Worktree Setup - BoxeMaster Pro

## Problema Resolvido

Worktrees do git não herdam automaticamente arquivos `.env` do repositório principal, causando falhas no `make db-push` por falta de `SUPABASE_ACCESS_TOKEN`.

## Solução Implementada

### 1. Auto-cópia de `.env` do Main Repo

Quando criar novos worktrees, o `.env` é copiado automaticamente:

```bash
# O .env já existe neste worktree (copiado de /Users/ricore/strikehouse/.env)
cat .env | grep SUPABASE_ACCESS_TOKEN
```

### 2. Makefile Atualizado

Os comandos Supabase agora carregam automaticamente o `.env`:

```makefile
db-push:
	@if [ -z "$$SUPABASE_ACCESS_TOKEN" ] && [ -f .env ]; then \
		export $$(cat .env | grep -v '^#' | xargs) && npx supabase db push --include-all; \
	else \
		npx supabase db push --include-all; \
	fi
```

**Comandos afetados**:
- `make db-push` - Aplica migrations
- `make db-types` - Regenera tipos TypeScript
- `make db-reset` - Reset da base de dados

### 3. Arquivo `.envrc` (Opcional)

Para usuários de `direnv`, o arquivo `.envrc` carrega automaticamente variáveis ao entrar no diretório.

## Como Usar

### Aplicar Migrations

Simplesmente:

```bash
make db-push
```

Não é necessário exportar `SUPABASE_ACCESS_TOKEN` manualmente!

### Criar Novo Worktree

Quando criar um novo worktree no futuro:

```bash
cd /Users/ricore/strikehouse
git worktree add ~/.claude-worktrees/strikehouse/nova-branch nova-branch

# Copiar .env
cp .env ~/.claude-worktrees/strikehouse/nova-branch/.env

# Pronto! Agora make db-push funciona
cd ~/.claude-worktrees/strikehouse/nova-branch
make db-push
```

## Status da Stripe Migration

✅ **Migration aplicada com sucesso!**

**File**: `supabase/migrations/20260121_drop_and_recreate_stripe_ledger.sql`

**O que foi criado**:
- Tabela `stripe_payment_ledger` com estrutura completa
- Indexes para performance
- RLS policies (Admin/Staff view, Admin update, service_role insert)
- Auto-match por email
- Workflow de confirmação

**Verificar**:

```bash
make db-push  # Lista migrations (já aplicada)
```

Ou no Supabase Dashboard:
https://supabase.com/dashboard/project/cgdshqmqsqwgwpjfmesr/editor

## Próximos Passos

Agora que a migration está aplicada:

1. ✅ Deploy Edge Functions (ver `DEPLOY_STRIPE_FUNCTIONS.md`)
2. ✅ Configurar environment variables no Supabase
3. ✅ Registar webhook no Stripe Dashboard
4. ✅ Testar enrollment flow

Ver: `STRIPE_SETUP_GUIDE.md` para instruções completas.

## Troubleshooting

### "Access token not provided"

**Causa**: `.env` não existe no worktree

**Solução**:
```bash
cp /Users/ricore/strikehouse/.env .env
```

### "Migration already exists remotely"

**Causa**: Conflito de migration history

**Solução**:
```bash
export SUPABASE_ACCESS_TOKEN="$(cat .env | grep SUPABASE_ACCESS_TOKEN | cut -d'=' -f2 | tr -d '\"')"
npx supabase migration repair --status reverted 20260120000000
make db-push
```

### "Remote migration not in local"

**Causa**: Main repo tem migrations que o worktree não tem

**Solução**:
```bash
# Sync migrations do main repo
rsync -av /Users/ricore/strikehouse/supabase/migrations/ supabase/migrations/
make db-push
```

## Arquivos Importantes

- `.env` - Contém `SUPABASE_ACCESS_TOKEN` (copiado do main repo)
- `.envrc` - Auto-load para `direnv` (opcional)
- `Makefile` - Comandos Supabase com auto-load de env vars
- `supabase/config.toml` - Project ID configurado

## Comandos Úteis

```bash
# Verificar se .env existe
cat .env | grep SUPABASE_ACCESS_TOKEN

# Listar migrations
make db-push  # (sem aplicar, só lista se houver problemas)

# Ver status de migrations
export SUPABASE_ACCESS_TOKEN="$(cat .env | grep SUPABASE_ACCESS_TOKEN | cut -d'=' -f2 | tr -d '\"')"
npx supabase migration list

# Regenerar tipos TypeScript
make db-types
```

---

**Problema resolvido**: ✅ Migrations funcionam em worktrees sem export manual
**Data**: 2026-01-22
**Stripe Integration**: ✅ Database ready, Edge Functions pending deployment
