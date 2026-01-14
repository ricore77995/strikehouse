# StrikeHouse - Makefile
# Comandos comuns para desenvolvimento

.PHONY: dev build test lint push-ci clean help

# Desenvolvimento
dev:
	npm run dev

build:
	npm run build

# Testes
test:
	npm run test:unit -- --run --exclude="**/integration/**"

test-watch:
	npm run test:unit --exclude="**/integration/**"

test-coverage:
	npx vitest --coverage --run --exclude="**/integration/**"

test-integration:
	npm run test:integration:run

# Linting
lint:
	npm run lint

lint-fix:
	npm run lint -- --fix

# Deploy
deploy:
	npm run build && git add -A && git commit -m "Deploy" && git push

# Push com token CI (para ficheiros de workflow)
push-ci:
	@source .env && \
	git remote set-url origin "https://$${GITHUB_CI_TOKEN}@github.com/ricore77995/strikehouse.git" && \
	git push && \
	git remote set-url origin "https://github.com/ricore77995/strikehouse.git"
	@echo "Push completo. Remote URL limpo."

# Supabase
db-push:
	npx supabase db push --include-all

db-types:
	npx supabase gen types typescript --linked > src/integrations/supabase/types.ts

db-reset:
	npx supabase db reset

# Limpeza
clean:
	rm -rf dist node_modules/.cache coverage

# Ajuda
help:
	@echo "Comandos disponíveis:"
	@echo ""
	@echo "  make dev            - Iniciar servidor de desenvolvimento"
	@echo "  make build          - Build de produção"
	@echo "  make test           - Rodar testes unitários"
	@echo "  make test-watch     - Testes em modo watch"
	@echo "  make test-coverage  - Relatório de cobertura"
	@echo "  make lint           - Verificar linting"
	@echo "  make lint-fix       - Corrigir linting automaticamente"
	@echo "  make deploy         - Build + commit + push"
	@echo "  make push-ci        - Push com token CI (para workflows)"
	@echo "  make db-push        - Aplicar migrações Supabase"
	@echo "  make db-types       - Regenerar tipos TypeScript"
	@echo "  make clean          - Limpar cache e builds"
