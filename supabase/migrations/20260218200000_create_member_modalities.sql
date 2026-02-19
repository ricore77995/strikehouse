-- Migration: Create member_modalities table
-- Purpose: Track which modalities each member is enrolled in (operational, not billing)
-- Example: João trains Muay Thai, Maria trains Muay Thai + Boxe

CREATE TABLE IF NOT EXISTS member_modalities (
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  modality_id UUID NOT NULL REFERENCES modalities(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (member_id, modality_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_member_modalities_member ON member_modalities(member_id);
CREATE INDEX IF NOT EXISTS idx_member_modalities_modality ON member_modalities(modality_id);

-- Comments
COMMENT ON TABLE member_modalities IS 'Modalidades que cada membro está inscrito (operacional, não cobrança)';
COMMENT ON COLUMN member_modalities.member_id IS 'FK to members.id';
COMMENT ON COLUMN member_modalities.modality_id IS 'FK to modalities.id';
COMMENT ON COLUMN member_modalities.enrolled_at IS 'When the member was enrolled in this modality';

-- RLS policies
ALTER TABLE member_modalities ENABLE ROW LEVEL SECURITY;

-- Staff can view all member modalities
CREATE POLICY "Staff can view member_modalities"
  ON member_modalities FOR SELECT
  TO authenticated
  USING (true);

-- Staff can insert member modalities
CREATE POLICY "Staff can insert member_modalities"
  ON member_modalities FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Staff can update member modalities
CREATE POLICY "Staff can update member_modalities"
  ON member_modalities FOR UPDATE
  TO authenticated
  USING (true);

-- Staff can delete member modalities
CREATE POLICY "Staff can delete member_modalities"
  ON member_modalities FOR DELETE
  TO authenticated
  USING (true);
