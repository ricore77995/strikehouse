-- Migration: Add classes table for schedule management
-- Feature: Weekly schedule grid

-- Create classes table for recurring weekly classes
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  modalidade VARCHAR(50) NOT NULL,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=Sunday, 1=Monday, etc.
  hora_inicio TIME NOT NULL,
  duracao_min INTEGER NOT NULL DEFAULT 60 CHECK (duracao_min > 0),
  coach_id UUID REFERENCES external_coaches(id) ON DELETE SET NULL,
  area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  capacidade INTEGER CHECK (capacidade IS NULL OR capacidade > 0),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_classes_dia_semana ON classes(dia_semana);
CREATE INDEX idx_classes_coach ON classes(coach_id);
CREATE INDEX idx_classes_area ON classes(area_id);
CREATE INDEX idx_classes_ativo ON classes(ativo) WHERE ativo = true;

-- Optional: Add class_id to check_ins for tracking which class member attended
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_checkins_class ON check_ins(class_id) WHERE class_id IS NOT NULL;

-- Enable RLS
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view active classes
CREATE POLICY "Authenticated users can view active classes" ON classes
  FOR SELECT TO authenticated
  USING (ativo = true);

-- Admin/Owner can view all classes (including inactive)
CREATE POLICY "Admin can view all classes" ON classes
  FOR SELECT TO authenticated
  USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN']));

-- Admin/Owner can insert classes
CREATE POLICY "Admin can insert classes" ON classes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN']));

-- Admin/Owner can update classes
CREATE POLICY "Admin can update classes" ON classes
  FOR UPDATE TO authenticated
  USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN']));

-- Admin/Owner can delete classes
CREATE POLICY "Admin can delete classes" ON classes
  FOR DELETE TO authenticated
  USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN']));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_classes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_classes_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW
  EXECUTE FUNCTION update_classes_updated_at();

-- Add comment for documentation
COMMENT ON TABLE classes IS 'Recurring weekly class schedule. dia_semana: 0=Sunday, 1=Monday, ..., 6=Saturday';
COMMENT ON COLUMN classes.duracao_min IS 'Duration in minutes';
COMMENT ON COLUMN classes.capacidade IS 'Maximum number of participants (NULL = unlimited)';
