-- Migration: Add rental overlap constraint
-- Prevents double-booking of areas at overlapping times

-- Function to check for overlapping rentals
CREATE OR REPLACE FUNCTION check_rental_overlap()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip if rental is being cancelled
  IF NEW.status = 'CANCELLED' THEN
    RETURN NEW;
  END IF;

  -- Check for overlapping rentals in the same area on the same date
  IF EXISTS (
    SELECT 1 FROM rentals
    WHERE area_id = NEW.area_id
      AND rental_date = NEW.rental_date
      AND status != 'CANCELLED'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND NEW.start_time < end_time
      AND NEW.end_time > start_time
  ) THEN
    RAISE EXCEPTION 'Rental overlap detected: area % already has a booking for % between the requested time slot',
      NEW.area_id, NEW.rental_date
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS rental_overlap_check ON rentals;
CREATE TRIGGER rental_overlap_check
  BEFORE INSERT OR UPDATE ON rentals
  FOR EACH ROW
  EXECUTE FUNCTION check_rental_overlap();

-- Also add check constraint for valid time range
ALTER TABLE rentals DROP CONSTRAINT IF EXISTS rentals_valid_time_range;
ALTER TABLE rentals ADD CONSTRAINT rentals_valid_time_range
  CHECK (end_time > start_time);

COMMENT ON FUNCTION check_rental_overlap() IS 'Prevents double-booking of areas at overlapping times';
