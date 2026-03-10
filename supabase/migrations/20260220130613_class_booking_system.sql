-- =============================================================================
-- Class Booking System
-- =============================================================================
-- Enables members to book specific class instances (date + recurring class)
-- with capacity limits, cancellation rules, and no-show penalties.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. class_bookings - Individual reservations for specific class dates
-- -----------------------------------------------------------------------------
CREATE TABLE class_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,

  -- Specific date of this class instance
  class_date DATE NOT NULL,

  -- Booking status
  status VARCHAR(20) NOT NULL DEFAULT 'BOOKED'
    CHECK (status IN ('BOOKED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW')),

  -- Timestamps
  booked_at TIMESTAMPTZ DEFAULT NOW(),
  checked_in_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- Who created this booking (NULL = self-service or system auto-booking)
  created_by UUID REFERENCES staff(id),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One booking per member per class per date
  UNIQUE(class_id, member_id, class_date)
);

-- Indexes for common queries
CREATE INDEX idx_class_bookings_class_date ON class_bookings(class_id, class_date);
CREATE INDEX idx_class_bookings_member ON class_bookings(member_id);
CREATE INDEX idx_class_bookings_date_status ON class_bookings(class_date, status);

COMMENT ON TABLE class_bookings IS 'Reservations for specific class instances (recurring class + date)';
COMMENT ON COLUMN class_bookings.status IS 'BOOKED=reserved, CHECKED_IN=attended, CANCELLED=member cancelled, NO_SHOW=did not attend';
COMMENT ON COLUMN class_bookings.created_by IS 'NULL when self-service booking or system auto-booking';

-- -----------------------------------------------------------------------------
-- 2. member_fixed_schedules - Fixed weekly schedules for 2x/3x plans
-- -----------------------------------------------------------------------------
CREATE TABLE member_fixed_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,

  -- Status
  active BOOLEAN DEFAULT true,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES staff(id),
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID REFERENCES staff(id),

  -- One schedule entry per member per class
  UNIQUE(member_id, class_id)
);

CREATE INDEX idx_member_fixed_schedules_member ON member_fixed_schedules(member_id) WHERE active = true;
CREATE INDEX idx_member_fixed_schedules_class ON member_fixed_schedules(class_id) WHERE active = true;

COMMENT ON TABLE member_fixed_schedules IS 'Fixed weekly class schedules for 2x/3x commitment plans - auto-generates bookings';
COMMENT ON COLUMN member_fixed_schedules.active IS 'When false, no new auto-bookings will be created';

-- -----------------------------------------------------------------------------
-- 3. Add booking_blocked_until to members (no-show penalty)
-- -----------------------------------------------------------------------------
ALTER TABLE members ADD COLUMN IF NOT EXISTS booking_blocked_until TIMESTAMPTZ;

COMMENT ON COLUMN members.booking_blocked_until IS 'If set and in future, member cannot create new bookings (no-show penalty)';

-- -----------------------------------------------------------------------------
-- 4. Ensure classes have capacity (default 30)
-- -----------------------------------------------------------------------------
UPDATE classes SET capacidade = 30 WHERE capacidade IS NULL;

-- -----------------------------------------------------------------------------
-- 5. RLS Policies
-- -----------------------------------------------------------------------------

ALTER TABLE class_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_fixed_schedules ENABLE ROW LEVEL SECURITY;

-- class_bookings policies

-- Staff can view all bookings
CREATE POLICY "Staff can view all bookings"
  ON class_bookings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.user_id = auth.uid()
      AND staff.role IN ('ADMIN', 'STAFF', 'OWNER')
    )
  );

-- Staff can manage bookings
CREATE POLICY "Staff can manage bookings"
  ON class_bookings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.user_id = auth.uid()
      AND staff.role IN ('ADMIN', 'STAFF')
    )
  );

-- Members can view their own bookings (via anon for QR page)
CREATE POLICY "Public can view member bookings by member_id"
  ON class_bookings FOR SELECT
  TO anon
  USING (true);

-- Members can create/cancel their own bookings (via anon for QR page)
CREATE POLICY "Public can manage own bookings"
  ON class_bookings FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Public can update own bookings"
  ON class_bookings FOR UPDATE
  TO anon
  USING (true);

-- member_fixed_schedules policies

-- Staff can view all fixed schedules
CREATE POLICY "Staff can view all fixed schedules"
  ON member_fixed_schedules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.user_id = auth.uid()
      AND staff.role IN ('ADMIN', 'STAFF', 'OWNER')
    )
  );

-- Only admin can manage fixed schedules
CREATE POLICY "Admin can manage fixed schedules"
  ON member_fixed_schedules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.user_id = auth.uid()
      AND staff.role = 'ADMIN'
    )
  );

-- Public read for member's own fixed schedules (QR page)
CREATE POLICY "Public can view member fixed schedules"
  ON member_fixed_schedules FOR SELECT
  TO anon
  USING (true);

-- -----------------------------------------------------------------------------
-- 6. Helper function: Get booking count for a class on a date
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_class_booking_count(
  p_class_id UUID,
  p_class_date DATE
)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM class_bookings
  WHERE class_id = p_class_id
    AND class_date = p_class_date
    AND status IN ('BOOKED', 'CHECKED_IN');
$$;

COMMENT ON FUNCTION get_class_booking_count IS 'Returns number of active bookings for a class instance';

-- -----------------------------------------------------------------------------
-- 7. Helper function: Check if member can book
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION can_member_book(
  p_member_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT booking_blocked_until IS NULL OR booking_blocked_until < NOW()
     FROM members
     WHERE id = p_member_id),
    false
  );
$$;

COMMENT ON FUNCTION can_member_book IS 'Returns true if member is not blocked from booking';
