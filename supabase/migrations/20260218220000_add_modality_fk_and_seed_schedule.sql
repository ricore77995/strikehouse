-- Migration: Add modality_id FK to classes and seed schedule
-- dia_semana: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday

-- Step 1: Add modality_id FK column
ALTER TABLE classes ADD COLUMN IF NOT EXISTS modality_id UUID REFERENCES modalities(id) ON DELETE RESTRICT;

-- Step 2: Migrate existing data (match by name)
UPDATE classes c
SET modality_id = m.id
FROM modalities m
WHERE LOWER(c.modalidade) = LOWER(m.nome)
   OR LOWER(c.modalidade) = m.code;

-- Step 3: Make modality_id NOT NULL after migration (only if no existing classes with NULL)
-- This is safe because we're seeding fresh data
-- ALTER TABLE classes ALTER COLUMN modality_id SET NOT NULL;

-- Step 4: Create index
CREATE INDEX IF NOT EXISTS idx_classes_modality ON classes(modality_id);

-- Step 5: Seed class schedule
-- Segunda (Monday = 1), Quarta (Wednesday = 3), Sexta (Friday = 5)
INSERT INTO classes (nome, modalidade, modality_id, dia_semana, hora_inicio, duracao_min, ativo)
SELECT
  v.nome,
  v.modalidade_nome,
  m.id,
  v.dia_semana,
  v.hora_inicio::TIME,
  60,
  true
FROM (VALUES
  -- Monday
  ('Muay Thai Feminino', 'Muay Thai', 'muay_thai', 1, '08:30'),
  ('MMA', 'MMA', 'mma', 1, '12:30'),
  ('Muay Thai', 'Muay Thai', 'muay_thai', 1, '19:00'),
  ('Muay Thai', 'Muay Thai', 'muay_thai', 1, '20:00'),
  -- Wednesday
  ('Muay Thai Feminino', 'Muay Thai', 'muay_thai', 3, '08:30'),
  ('MMA', 'MMA', 'mma', 3, '12:30'),
  ('Muay Thai', 'Muay Thai', 'muay_thai', 3, '19:00'),
  ('Muay Thai', 'Muay Thai', 'muay_thai', 3, '20:00'),
  -- Friday
  ('Muay Thai Feminino', 'Muay Thai', 'muay_thai', 5, '08:30'),
  ('MMA', 'MMA', 'mma', 5, '12:30'),
  ('Muay Thai', 'Muay Thai', 'muay_thai', 5, '19:00'),
  ('Muay Thai', 'Muay Thai', 'muay_thai', 5, '20:00'),
  -- Tuesday
  ('Muay Thai', 'Muay Thai', 'muay_thai', 2, '08:00'),
  ('MMA', 'MMA', 'mma', 2, '12:30'),
  ('Muay Thai', 'Muay Thai', 'muay_thai', 2, '19:30'),
  ('Boxe', 'Boxe', 'boxe', 2, '20:30'),
  -- Thursday
  ('Muay Thai', 'Muay Thai', 'muay_thai', 4, '08:00'),
  ('MMA', 'MMA', 'mma', 4, '12:30'),
  ('Muay Thai', 'Muay Thai', 'muay_thai', 4, '19:30'),
  ('Boxe', 'Boxe', 'boxe', 4, '20:30'),
  -- Saturday
  ('Muay Thai', 'Muay Thai', 'muay_thai', 6, '12:00')
) AS v(nome, modalidade_nome, modality_code, dia_semana, hora_inicio)
JOIN modalities m ON m.code = v.modality_code;

-- Comment
COMMENT ON COLUMN classes.modality_id IS 'FK to modalities table - preferred over modalidade varchar';
