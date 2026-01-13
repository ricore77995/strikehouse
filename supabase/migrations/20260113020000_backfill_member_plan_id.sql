-- Migration: Backfill current_plan_id for existing active members
-- Based on their access_type matching a plan tipo

-- Update members with SUBSCRIPTION access type to their most likely plan
UPDATE members m
SET current_plan_id = (
  SELECT p.id
  FROM plans p
  WHERE p.tipo = m.access_type
    AND p.ativo = true
  ORDER BY p.preco_cents DESC
  LIMIT 1
)
WHERE m.status = 'ATIVO'
  AND m.current_plan_id IS NULL
  AND m.access_type IS NOT NULL;

-- Also try to match based on most recent transaction if the above didn't work
UPDATE members m
SET current_plan_id = (
  SELECT p.id
  FROM transactions t
  JOIN plans p ON p.tipo = t.category AND p.ativo = true
  WHERE t.member_id = m.id
    AND t.type = 'RECEITA'
    AND t.category IN ('SUBSCRIPTION', 'CREDITS', 'DAILY_PASS')
  ORDER BY t.transaction_date DESC, t.created_at DESC
  LIMIT 1
)
WHERE m.status = 'ATIVO'
  AND m.current_plan_id IS NULL
  AND m.access_type IS NOT NULL;
