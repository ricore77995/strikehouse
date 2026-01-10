# BoxeMaster Pro — Plano de Projeto

**Versão:** 1.1  
**Spec:** v1.7.1  
**Data:** Janeiro 2026

---

## Visão Geral

| Fase | Descrição | Prioridade |
|------|-----------|------------|
| 1 | Setup & Infraestrutura | 🔴 Crítico |
| 2 | Autenticação & Roles | 🔴 Crítico |
| 3 | Membros & Check-in | 🔴 Crítico |
| 4 | Pagamentos | 🔴 Crítico |
| 5 | Cobranças & Notificações | 🟡 Alto |
| 6 | Sublocação (Rentals) | 🟡 Alto |
| 7 | Financeiro, Caixa & Vendas | 🟡 Alto |
| 8 | Auditoria | 🟡 Alto |
| 9 | Dashboards | 🟢 Médio |
| 10 | Relatórios | 🟢 Médio |
| 11 | Polish & Go-Live | 🟢 Médio |

---

## Fase 1: Setup & Infraestrutura

### Tarefas

| # | Tarefa | Status |
|---|--------|--------|
| 1.1 | Criar projeto Next.js 14 (App Router) | ✅ (React + Vite) |
| 1.2 | Configurar Tailwind CSS | ✅ |
| 1.3 | Configurar TypeScript | ✅ |
| 1.4 | Criar projeto Supabase | ✅ (Lovable Cloud) |
| 1.5 | Configurar variáveis de ambiente | ✅ |
| 1.6 | Executar schema SQL completo | ✅ |
| 1.7 | Configurar Supabase client (client + server) | ✅ |
| 1.8 | Deploy inicial Vercel | ⬜ (Lovable Preview) |
| 1.9 | Configurar domínio (opcional) | ⬜ |

### Checklist de Validação

- [x] `npm run dev` funciona sem erros
- [x] Tailwind renderiza estilos corretamente
- [x] Conexão com Supabase funciona (testar query simples)
- [x] Todas as tabelas existem no Supabase (17 tabelas + 5 views)
- [ ] Deploy Vercel acessível via URL
- [x] Variáveis de ambiente configuradas em produção

---

## Fase 2: Autenticação & Roles

### Tarefas

| # | Tarefa | Status |
|---|--------|--------|
| 2.1 | Criar página `/login` | ⬜ |
| 2.2 | Implementar login com Supabase Auth | ⬜ |
| 2.3 | Criar middleware de proteção de rotas | ⬜ |
| 2.4 | Implementar redirecionamento por role | ⬜ |
| 2.5 | Criar layout `/owner` | ⬜ |
| 2.6 | Criar layout `/admin` | ⬜ |
| 2.7 | Criar layout `/staff` | ⬜ |
| 2.8 | Criar layout `/partner` | ⬜ |
| 2.9 | Criar página pública `/m/[qr_code]` | ⬜ |
| 2.10 | Seed de usuários de teste (1 por role) | ⬜ |

### Checklist de Validação

- [ ] Login funciona com email/senha
- [ ] OWNER logado → redireciona para `/owner/dashboard`
- [ ] ADMIN logado → redireciona para `/admin/dashboard`
- [ ] STAFF logado → redireciona para `/staff/checkin`
- [ ] PARTNER logado → redireciona para `/partner/dashboard`
- [ ] OWNER não consegue acessar `/admin/*` (ou consegue, se permitido)
- [ ] STAFF não consegue acessar `/owner/*`
- [ ] PARTNER não consegue acessar `/admin/*`
- [ ] Usuário não logado → redireciona para `/login`
- [ ] `/m/MBR-XXXXX` acessível sem login
- [ ] Logout funciona corretamente

---

## Fase 3: Membros & Check-in

### Tarefas

| # | Tarefa | Status |
|---|--------|--------|
| 3.1 | CRUD Planos (`/admin/plans`) | ⬜ |
| 3.2 | Listar membros (`/admin/members`) | ⬜ |
| 3.3 | Criar membro com QR automático | ⬜ |
| 3.4 | Editar membro (`/admin/members/[id]`) | ⬜ |
| 3.5 | Adicionar/editar IBANs do membro | ⬜ |
| 3.6 | Página do QR do membro (`/m/[qr]`) | ⬜ |
| 3.7 | Tela de check-in (`/staff/checkin`) | ⬜ |
| 3.8 | Scanner de QR (câmera) | ⬜ |
| 3.9 | Busca manual (nome/telefone) | ⬜ |
| 3.10 | Validação de check-in (status, expiração, créditos) | ⬜ |
| 3.11 | Dedução de crédito (se CREDITS) | ⬜ |
| 3.12 | Registro de check-in no banco | ⬜ |
| 3.13 | Tela de resultado (✅ Liberado / ❌ Bloqueado) | ⬜ |
| 3.14 | Cadastro rápido (`/staff/members/new`) | ⬜ |

### Checklist de Validação

**Planos:**
- [ ] Admin consegue criar plano (nome, tipo, preço, duração)
- [ ] Admin consegue editar plano
- [ ] Admin consegue desativar plano

**Membros:**
- [ ] Admin consegue criar membro (nome, telefone, email)
- [ ] QR code gerado automaticamente (formato MBR-XXXXXXXX)
- [ ] QR code é único
- [ ] Admin consegue adicionar múltiplos IBANs ao membro
- [ ] Admin consegue editar dados do membro
- [ ] Admin consegue alterar status (ATIVO, BLOQUEADO, CANCELADO)
- [ ] Filtros funcionam (status, busca)

**Página QR Público:**
- [ ] `/m/MBR-XXXXX` mostra QR code grande
- [ ] Mostra nome do membro
- [ ] Funciona sem login
- [ ] QR inválido mostra erro

**Check-in:**
- [ ] Scanner de QR abre câmera
- [ ] Escanear QR válido → mostra resultado
- [ ] Membro ATIVO com acesso válido → ✅ Liberado
- [ ] Membro BLOQUEADO → ❌ Bloqueado
- [ ] Membro com acesso expirado → ❌ Expirado
- [ ] Membro CREDITS com 0 créditos → ❌ Sem créditos
- [ ] Check-in de CREDITS deduz 1 crédito
- [ ] Busca por nome funciona
- [ ] Busca por telefone funciona
- [ ] Check-in registrado na tabela `check_ins`
- [ ] Staff consegue cadastrar membro rapidamente

---

## Fase 4: Pagamentos

### Tarefas

| # | Tarefa | Status |
|---|--------|--------|
| 4.1 | Tela de pagamento (`/staff/payment`) | ⬜ |
| 4.2 | Selecionar membro | ⬜ |
| 4.3 | Selecionar plano | ⬜ |
| 4.4 | Selecionar método (Dinheiro, Cartão, MBway, Transferência) | ⬜ |
| 4.5 | Pagamento Dinheiro/Cartão → ativa imediatamente | ⬜ |
| 4.6 | Pagamento MBway → ativa imediatamente | ⬜ |
| 4.7 | Pagamento Transferência → cria pendência | ⬜ |
| 4.8 | Enviar dados de transferência por WhatsApp | ⬜ |
| 4.9 | Tela de verificação (`/admin/finances/verify`) | ⬜ |
| 4.10 | Listar pagamentos pendentes | ⬜ |
| 4.11 | Match automático por IBAN | ⬜ |
| 4.12 | Atribuir pagamento manualmente | ⬜ |
| 4.13 | Confirmar pagamento → ativar membro | ⬜ |
| 4.14 | Opção de salvar novo IBAN ao atribuir | ⬜ |
| 4.15 | Enviar QR por WhatsApp após confirmação | ⬜ |

### Checklist de Validação

**Pagamento Presencial:**
- [ ] Staff seleciona membro existente
- [ ] Staff seleciona plano
- [ ] Pagamento Dinheiro → membro ativado imediatamente
- [ ] Pagamento Cartão → membro ativado imediatamente
- [ ] Pagamento MBway → membro ativado imediatamente
- [ ] Transação registrada corretamente
- [ ] QR enviado por WhatsApp (ou link mostrado)

**Pagamento Transferência:**
- [ ] Staff seleciona "Transferência"
- [ ] Sistema cria pagamento pendente
- [ ] Staff pode enviar dados por WhatsApp (IBAN, valor)
- [ ] Pendência aparece em `/admin/finances/verify`

**Verificação de Pagamentos:**
- [ ] Admin vê lista de pendentes
- [ ] Admin pode simular match por IBAN
- [ ] Match encontrado → mostra membro associado
- [ ] Admin confirma → membro ativado
- [ ] Admin pode atribuir manualmente (IBAN não cadastrado)
- [ ] Opção de salvar IBAN no cadastro do membro
- [ ] QR enviado após confirmação
- [ ] Pendência marcada como CONFIRMED

---

## Fase 5: Cobranças & Notificações

### Tarefas

| # | Tarefa | Status |
|---|--------|--------|
| 5.1 | Dashboard de cobranças (`/admin/billing` e `/owner/billing`) | ⬜ |
| 5.2 | Query: membros atrasados | ⬜ |
| 5.3 | Query: membros que vencem hoje | ⬜ |
| 5.4 | Query: membros que vencem em 7 dias | ⬜ |
| 5.5 | Resumo do mês (esperado vs recebido) | ⬜ |
| 5.6 | Botão "Enviar lembrete" (WhatsApp) | ⬜ |
| 5.7 | Botão "Marcar como pago" | ⬜ |
| 5.8 | Link direto para WhatsApp do membro | ⬜ |
| 5.9 | Job: bloqueio automático (expirados) | ⬜ |
| 5.10 | Job: cancelamento automático (30 dias bloqueado) | ⬜ |
| 5.11 | Job: notificação 3 dias antes | ⬜ |
| 5.12 | Job: notificação no dia | ⬜ |
| 5.13 | Job: notificação 1 dia depois | ⬜ |
| 5.14 | Job: notificação 3 dias depois | ⬜ |
| 5.15 | Configurar cron jobs (Vercel ou Supabase) | ⬜ |

### Checklist de Validação

**Dashboard de Cobranças:**
- [ ] Mostra membros atrasados com dias de atraso
- [ ] Mostra membros que vencem hoje
- [ ] Mostra membros que vencem nos próximos 7 dias
- [ ] Mostra resumo do mês (total esperado, recebido, %)
- [ ] "Enviar lembrete" abre WhatsApp com mensagem pré-preenchida
- [ ] "Marcar como pago" abre modal de confirmação
- [ ] Clicar no membro abre ficha

**Automações:**
- [ ] Membro com acesso expirado → status muda para BLOQUEADO (diário)
- [ ] Membro bloqueado há 30+ dias → status muda para CANCELADO (diário)
- [ ] Notificação 3 dias antes enviada (verificar log ou teste manual)
- [ ] Notificação no dia enviada
- [ ] Notificação 1 dia depois enviada
- [ ] Notificação 3 dias depois enviada
- [ ] Jobs configurados e rodando (Vercel Cron ou Supabase Edge Functions)

---

## Fase 6: Sublocação (Rentals)

### Tarefas

| # | Tarefa | Status |
|---|--------|--------|
| 6.1 | CRUD Áreas (`/admin/areas`) | ⬜ |
| 6.2 | CRUD Coaches externos (`/admin/coaches`) | ⬜ |
| 6.3 | Modelo de fee (FIXED ou PERCENTAGE) | ⬜ |
| 6.4 | CRUD Rentals (`/admin/rentals`) | ⬜ |
| 6.5 | Criar rental individual | ⬜ |
| 6.6 | Criar série recorrente | ⬜ |
| 6.7 | Verificação de disponibilidade (capacidade) | ⬜ |
| 6.8 | Cancelar rental (>24h = crédito, <24h = perdeu) | ⬜ |
| 6.9 | Créditos do coach | ⬜ |
| 6.10 | Check-in de Guest (`/staff/guests`) | ⬜ |
| 6.11 | Selecionar rental ativo | ⬜ |
| 6.12 | Registrar nome do guest | ⬜ |
| 6.13 | Incrementar guest_count | ⬜ |
| 6.14 | Bloqueio de membros (área EXCLUSIVE) | ⬜ |
| 6.15 | Portal do Partner (`/partner/*`) | ⬜ |
| 6.16 | Partner vê seus rentals | ⬜ |
| 6.17 | Partner cancela rental | ⬜ |
| 6.18 | Partner vê créditos | ⬜ |
| 6.19 | Partner cria rental (se permitido) | ⬜ |

### Checklist de Validação

**Áreas:**
- [ ] Admin cria área (nome, capacidade, is_exclusive)
- [ ] Admin edita área
- [ ] Admin desativa área

**Coaches:**
- [ ] Admin cria coach (nome, telefone, email, modalidade)
- [ ] Admin define fee (FIXED €X ou PERCENTAGE X%)
- [ ] Admin cria login (PARTNER) para coach
- [ ] Coach recebe credenciais

**Rentals:**
- [ ] Admin cria rental individual (coach, área, data, horário)
- [ ] Sistema verifica capacidade da área
- [ ] Rental não criado se área lotada no horário
- [ ] Admin cria série recorrente (ex: toda terça 19h)
- [ ] Sistema gera múltiplos rentals
- [ ] Admin cancela rental >24h → crédito gerado para coach
- [ ] Admin cancela rental <24h → sem crédito
- [ ] Crédito do coach expira em 90 dias

**Check-in Guest:**
- [ ] Staff vê rentals ativos no momento
- [ ] Staff seleciona rental
- [ ] Staff digita nome do guest
- [ ] Guest registrado no check_ins
- [ ] guest_count incrementado no rental

**Área Exclusiva:**
- [ ] Rental em área EXCLUSIVE existe
- [ ] Membro tenta check-in durante rental EXCLUSIVE → ❌ Bloqueado
- [ ] Membro tenta check-in fora do horário → ✅ Liberado

**Portal Partner:**
- [ ] Partner logado vê `/partner/dashboard`
- [ ] Partner vê lista dos seus rentals
- [ ] Partner vê detalhes do rental
- [ ] Partner cancela rental (>24h)
- [ ] Partner vê seus créditos
- [ ] Partner vê histórico

---

## Fase 7: Financeiro, Caixa & Vendas

### Tarefas

| # | Tarefa | Status |
|---|--------|--------|
| 7.1 | Abertura de caixa (`/staff/caixa`) | ⬜ |
| 7.2 | Fechamento de caixa | ⬜ |
| 7.3 | Cálculo de diferença (esperado vs contado) | ⬜ |
| 7.4 | Registro de despesas (`/admin/finances`) | ⬜ |
| 7.5 | Categorias de despesa | ⬜ |
| 7.6 | Listar transações | ⬜ |
| 7.7 | Filtros (data, tipo, categoria) | ⬜ |
| 7.8 | Transação de rental (fee do coach) | ⬜ |
| 7.9 | CRUD Produtos (`/admin/products`) | ⬜ |
| 7.10 | Criar produto (nome, preço, categoria) | ⬜ |
| 7.11 | Editar produto | ⬜ |
| 7.12 | Ativar/desativar produto | ⬜ |
| 7.13 | Tela de vendas (`/staff/sales`) | ⬜ |
| 7.14 | Listar produtos ativos para seleção | ⬜ |
| 7.15 | Adicionar produto do catálogo | ⬜ |
| 7.16 | Adicionar item avulso (descrição + valor) | ⬜ |
| 7.17 | Alterar quantidade de item | ⬜ |
| 7.18 | Remover item da venda | ⬜ |
| 7.19 | Calcular total automaticamente | ⬜ |
| 7.20 | Associar venda a membro (opcional) | ⬜ |
| 7.21 | Selecionar método de pagamento | ⬜ |
| 7.22 | Confirmar venda → criar transação + sale | ⬜ |
| 7.23 | Histórico de vendas (`/admin/sales`) | ⬜ |
| 7.24 | Filtros de vendas (data, staff) | ⬜ |
| 7.25 | Detalhe da venda (itens) | ⬜ |

### Checklist de Validação

**Caixa:**
- [ ] Staff abre caixa com valor inicial
- [ ] Só 1 caixa aberto por vez
- [ ] Staff fecha caixa informando valor contado
- [ ] Sistema calcula diferença (contado - esperado)
- [ ] Diferença registrada
- [ ] Histórico de caixas disponível

**Despesas:**
- [ ] Admin registra despesa (valor, categoria, descrição)
- [ ] Categorias: ALUGUEL, LUZ, AGUA, MANUTENCAO, SALARIOS, OUTROS
- [ ] Despesa aparece no extrato

**Transações:**
- [ ] Todas as transações listadas
- [ ] Filtro por data funciona
- [ ] Filtro por tipo (RECEITA/DESPESA) funciona
- [ ] Filtro por categoria funciona
- [ ] Exportar CSV/PDF

**Produtos:**
- [ ] Admin cria produto (nome, preço, categoria)
- [ ] Categorias: EQUIPAMENTO, VESTUARIO, SUPLEMENTO, ACESSORIO, OUTRO
- [ ] Admin edita produto
- [ ] Admin desativa produto
- [ ] Produto desativado não aparece na tela de vendas
- [ ] Produto ativado volta a aparecer

**Vendas:**
- [ ] Staff vê lista de produtos ativos
- [ ] Staff busca produto por nome
- [ ] Staff adiciona produto do catálogo
- [ ] Staff adiciona item avulso (descrição livre + valor)
- [ ] Staff altera quantidade (1x, 2x, 3x...)
- [ ] Staff remove item da venda
- [ ] Total calculado corretamente
- [ ] Staff pode associar a um membro (opcional)
- [ ] Staff seleciona método: Dinheiro, Cartão, MBway
- [ ] Confirmar cria transação (RECEITA, categoria PRODUTOS)
- [ ] Confirmar cria registro em `sales` + `sale_items`
- [ ] Venda aparece no extrato financeiro
- [ ] Venda contabilizada no fechamento de caixa
- [ ] Auditoria registra venda

**Histórico de Vendas:**
- [ ] Admin vê lista de vendas
- [ ] Filtro por data funciona
- [ ] Filtro por staff funciona
- [ ] Clicar em venda mostra detalhes (itens)
- [ ] Total do período calculado

**Rentals:**
- [ ] Rental concluído → transação de receita (fee do coach)
- [ ] Valor correto (FIXED ou PERCENTAGE do plano)

---

## Fase 8: Auditoria

### Tarefas

| # | Tarefa | Status |
|---|--------|--------|
| 8.1 | Helper de auditoria (auditLog) | ⬜ |
| 8.2 | Logar ações de membros | ⬜ |
| 8.3 | Logar ações de pagamentos | ⬜ |
| 8.4 | Logar ações de caixa | ⬜ |
| 8.5 | Logar ações de rentals | ⬜ |
| 8.6 | Logar ações de config | ⬜ |
| 8.7 | Tela de auditoria (`/owner/audit` e `/admin/audit`) | ⬜ |
| 8.8 | Filtros (usuário, ação, data) | ⬜ |
| 8.9 | Detalhe da ação (antes/depois) | ⬜ |
| 8.10 | Resumo por staff | ⬜ |
| 8.11 | Alertas imediatos (estorno, diferença caixa) | ⬜ |
| 8.12 | Relatório diário para OWNER | ⬜ |

### Checklist de Validação

**Logs:**
- [ ] Criar membro → log registrado
- [ ] Editar membro → log com valor anterior e novo
- [ ] Confirmar pagamento → log registrado
- [ ] Estornar pagamento → log registrado
- [ ] Abrir/fechar caixa → log registrado
- [ ] Criar/cancelar rental → log registrado
- [ ] Alterar preço de plano → log registrado

**Tela:**
- [ ] OWNER vê todos os logs
- [ ] ADMIN vê todos os logs
- [ ] Filtro por usuário funciona
- [ ] Filtro por ação funciona
- [ ] Filtro por data funciona
- [ ] Clicar em log → mostra detalhes (antes/depois)
- [ ] Resumo por staff mostra contagens

**Alertas:**
- [ ] Estorno de pagamento → notifica OWNER imediatamente
- [ ] Diferença de caixa > €10 → notifica OWNER imediatamente
- [ ] Relatório diário enviado (ou disponível)

---

## Fase 9: Dashboards

### Tarefas

| # | Tarefa | Status |
|---|--------|--------|
| 9.1 | Dashboard OWNER (`/owner/dashboard`) | ⬜ |
| 9.2 | Receita (hoje, semana, mês, ano) | ⬜ |
| 9.3 | Gráfico receita vs despesa | ⬜ |
| 9.4 | Métricas (MRR, churn, ticket médio) | ⬜ |
| 9.5 | Widget de cobranças (atrasados, hoje) | ⬜ |
| 9.6 | Fluxo de caixa (saldo, previsão) | ⬜ |
| 9.7 | Alertas recentes | ⬜ |
| 9.8 | Dashboard ADMIN (`/admin/dashboard`) | ⬜ |
| 9.9 | Resumo operacional | ⬜ |
| 9.10 | Check-ins hoje | ⬜ |
| 9.11 | Rentals hoje | ⬜ |
| 9.12 | Dashboard PARTNER (`/partner/dashboard`) | ⬜ |
| 9.13 | Próximos rentals | ⬜ |
| 9.14 | Créditos disponíveis | ⬜ |

### Checklist de Validação

**Dashboard OWNER:**
- [ ] Mostra receita hoje/semana/mês/ano
- [ ] Mostra comparativo com período anterior (%)
- [ ] Gráfico de barras receita vs despesa
- [ ] MRR calculado corretamente
- [ ] Churn calculado corretamente
- [ ] Ticket médio calculado corretamente
- [ ] Widget de cobranças com contagens
- [ ] Saldo de caixa atual
- [ ] Alertas recentes visíveis

**Dashboard ADMIN:**
- [ ] Resumo do dia (check-ins, novos membros, receita)
- [ ] Lista de check-ins recentes
- [ ] Rentals de hoje
- [ ] Acesso rápido às principais funções

**Dashboard PARTNER:**
- [ ] Próximos rentals listados
- [ ] Créditos disponíveis
- [ ] Histórico resumido

---

## Fase 10: Relatórios

### Tarefas

| # | Tarefa | Status |
|---|--------|--------|
| 10.1 | Relatório financeiro mensal | ⬜ |
| 10.2 | Relatório de membros | ⬜ |
| 10.3 | Relatório de check-ins | ⬜ |
| 10.4 | Relatório de rentals | ⬜ |
| 10.5 | Exportar PDF | ⬜ |
| 10.6 | Exportar CSV | ⬜ |
| 10.7 | Relatório semanal automático (email/WhatsApp) | ⬜ |

### Checklist de Validação

- [ ] Relatório financeiro mostra receitas e despesas por categoria
- [ ] Relatório de membros mostra ativos, novos, cancelados
- [ ] Relatório de check-ins mostra frequência
- [ ] Relatório de rentals mostra ocupação e receita
- [ ] Exportar PDF funciona
- [ ] Exportar CSV funciona
- [ ] Relatório semanal enviado toda segunda

---

## Fase 11: Polish & Go-Live

### Tarefas

| # | Tarefa | Status |
|---|--------|--------|
| 11.1 | Responsividade (mobile, tablet, desktop) | ⬜ |
| 11.2 | Loading states | ⬜ |
| 11.3 | Error handling | ⬜ |
| 11.4 | Mensagens de feedback (toast) | ⬜ |
| 11.5 | Empty states | ⬜ |
| 11.6 | Testes manuais completos | ⬜ |
| 11.7 | Seed de dados reais | ⬜ |
| 11.8 | Criar usuários reais (OWNER, ADMIN, STAFF) | ⬜ |
| 11.9 | Configurar PWA (opcional) | ⬜ |
| 11.10 | Documentação de uso | ⬜ |
| 11.11 | Treinamento da equipe | ⬜ |
| 11.12 | Go-live | ⬜ |

### Checklist de Validação

- [ ] `/staff/*` funciona bem em tablet
- [ ] `/partner/*` funciona bem em mobile
- [ ] `/admin/*` funciona bem em desktop
- [ ] `/m/*` funciona bem em mobile
- [ ] Todas as ações mostram loading
- [ ] Erros mostram mensagem amigável
- [ ] Sucesso mostra confirmação
- [ ] Listas vazias mostram empty state
- [ ] Dados reais carregados
- [ ] Usuários reais criados e testados
- [ ] Equipe treinada
- [ ] Sistema em produção

---

## Resumo de Progresso

| Fase | Total | Feito | % |
|------|-------|-------|---|
| 1. Setup | 9 | 0 | 0% |
| 2. Auth | 10 | 0 | 0% |
| 3. Membros & Check-in | 14 | 0 | 0% |
| 4. Pagamentos | 15 | 0 | 0% |
| 5. Cobranças | 15 | 0 | 0% |
| 6. Sublocação | 19 | 0 | 0% |
| 7. Financeiro, Caixa & Vendas | 25 | 0 | 0% |
| 8. Auditoria | 12 | 0 | 0% |
| 9. Dashboards | 14 | 0 | 0% |
| 10. Relatórios | 7 | 0 | 0% |
| 11. Polish | 12 | 0 | 0% |
| **TOTAL** | **152** | **0** | **0%** |

---

## Critérios de Aceitação Final

Antes do go-live, todos os itens abaixo devem estar ✅:

### Críticos (MVP)

- [ ] Login funciona para todos os roles
- [ ] Membro cadastrado recebe QR
- [ ] Check-in por QR funciona
- [ ] Pagamento presencial ativa membro
- [ ] Pagamento transferência cria pendência
- [ ] Admin confirma pagamento pendente
- [ ] Membro expirado é bloqueado automaticamente
- [ ] Dashboard de cobranças mostra atrasados
- [ ] Auditoria registra ações principais
- [ ] OWNER vê dashboard financeiro
- [ ] Venda de produtos funciona

### Importantes

- [ ] Rentals funcionam
- [ ] Check-in de guest funciona
- [ ] Portal do partner funciona
- [ ] Caixa abre/fecha corretamente
- [ ] Despesas registradas
- [ ] Notificações WhatsApp enviadas
- [ ] Relatórios exportam
- [ ] Catálogo de produtos configurado
- [ ] Histórico de vendas disponível

### Desejáveis

- [ ] PWA instalável
- [ ] Gráficos no dashboard
- [ ] Relatório semanal automático

---

## Notas

- Atualizar status das tarefas conforme desenvolvimento
- Marcar checklist após teste bem-sucedido
- Documentar bloqueios e decisões tomadas

---

*BoxeMaster Pro — Plano de Projeto v1.1*
