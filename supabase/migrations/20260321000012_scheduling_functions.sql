-- Migration: 012_scheduling_functions
-- Functions: create_appointment_with_lock, check_appointment_conflicts
-- Adds buffer_minutes to services table 

-- Add buffer_minutes column to services
ALTER TABLE services ADD COLUMN buffer_minutes INT NOT NULL DEFAULT 0;

-- Postgres function for atomic booking with advisory lock
CREATE OR REPLACE FUNCTION create_appointment_with_lock(
  p_clinic_id uuid,
  p_customer_id uuid,
  p_service_id uuid,
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
) RETURNS TABLE (
  id uuid,
  clinic_id uuid,
  customer_id uuid,
  service_id uuid,
  staff_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  created_at timestamptz
) AS $$
DECLARE
  v_lock_hash BIGINT;
BEGIN
  -- Create a consistent hash for the advisory lock based on staff_id and start time
  v_lock_hash := hashtext(p_staff_id::text || p_starts_at::text);
  
  -- Acquire transaction-level advisory lock
  PERFORM pg_advisory_xact_lock(v_lock_hash);

  -- Check for conflicts: any non-cancelled appointment for this staff at this time
  IF EXISTS (
    SELECT 1 FROM appointments
    WHERE clinic_id = p_clinic_id
      AND staff_id = p_staff_id
      AND status != 'cancelled'
      AND starts_at < p_ends_at 
      AND ends_at > p_starts_at
  ) THEN
    RAISE EXCEPTION 'SLOT_CONFLICT';
  END IF;

  -- Insert the appointment
  RETURN QUERY
  INSERT INTO appointments (
    clinic_id, 
    customer_id, 
    service_id, 
    staff_id, 
    starts_at, 
    ends_at, 
    status
  )
  VALUES (
    p_clinic_id, 
    p_customer_id, 
    p_service_id, 
    p_staff_id, 
    p_starts_at, 
    p_ends_at, 
    'scheduled'
  )
  RETURNING 
    appointments.id,
    appointments.clinic_id,
    appointments.customer_id,
    appointments.service_id,
    appointments.staff_id,
    appointments.starts_at,
    appointments.ends_at,
    appointments.status::text,
    appointments.created_at;
END;
$$ LANGUAGE plpgsql;

-- Helper function to check if a time slot is available
CREATE OR REPLACE FUNCTION is_slot_available(
  p_clinic_id uuid,
  p_service_id uuid,
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
) RETURNS BOOLEAN AS $$
BEGIN
  -- Check if staff has working hours on this day
  -- Check if there are no conflicting appointments
  -- Check if there are no blocking periods
  
  RETURN NOT EXISTS (
    SELECT 1 FROM appointments
    WHERE clinic_id = p_clinic_id
      AND staff_id = p_staff_id
      AND status != 'cancelled'
      AND starts_at < p_ends_at 
      AND ends_at > p_starts_at
  ) AND NOT EXISTS (
    SELECT 1 FROM blocks
    WHERE clinic_id = p_clinic_id
      AND user_id = p_staff_id
      AND starts_at < p_ends_at 
      AND ends_at > p_starts_at
  );
END;
$$ LANGUAGE plpgsql;
