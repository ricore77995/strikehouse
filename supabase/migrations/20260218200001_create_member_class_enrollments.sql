-- Migration: Create member_class_enrollments table
-- Purpose: Track which class schedules each member attends (informational, not restrictive)
-- Example: João attends "Muay Thai Tue/Thu 19:30", Maria attends "Muay Thai Mon/Wed 20:00"

CREATE TABLE IF NOT EXISTS member_class_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  dropped_at TIMESTAMPTZ,
  status VARCHAR(15) DEFAULT 'active' CHECK (status IN ('active', 'dropped')),
  created_by UUID REFERENCES staff(id),
  UNIQUE(member_id, class_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_member_class_enrollments_member ON member_class_enrollments(member_id);
CREATE INDEX IF NOT EXISTS idx_member_class_enrollments_class ON member_class_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_member_class_enrollments_active ON member_class_enrollments(member_id) WHERE status = 'active';

-- Comments
COMMENT ON TABLE member_class_enrollments IS 'Turmas/horários que cada membro frequenta (informativo, não restritivo)';
COMMENT ON COLUMN member_class_enrollments.member_id IS 'FK to members.id';
COMMENT ON COLUMN member_class_enrollments.class_id IS 'FK to classes.id (recurring weekly class)';
COMMENT ON COLUMN member_class_enrollments.enrolled_at IS 'When the member enrolled in this class';
COMMENT ON COLUMN member_class_enrollments.dropped_at IS 'When the member dropped from this class (if status=dropped)';
COMMENT ON COLUMN member_class_enrollments.status IS 'active = currently attending, dropped = no longer attending';
COMMENT ON COLUMN member_class_enrollments.created_by IS 'Staff member who enrolled the member';

-- RLS policies
ALTER TABLE member_class_enrollments ENABLE ROW LEVEL SECURITY;

-- Staff can view all enrollments
CREATE POLICY "Staff can view member_class_enrollments"
  ON member_class_enrollments FOR SELECT
  TO authenticated
  USING (true);

-- Staff can insert enrollments
CREATE POLICY "Staff can insert member_class_enrollments"
  ON member_class_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Staff can update enrollments
CREATE POLICY "Staff can update member_class_enrollments"
  ON member_class_enrollments FOR UPDATE
  TO authenticated
  USING (true);

-- Staff can delete enrollments
CREATE POLICY "Staff can delete member_class_enrollments"
  ON member_class_enrollments FOR DELETE
  TO authenticated
  USING (true);
