-- Add DRAFT status for delivery requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'DRAFT'
      AND enumtypid = '"DeliveryRequestStatus"'::regtype
  ) THEN
    ALTER TYPE "DeliveryRequestStatus" ADD VALUE 'DRAFT';
  END IF;
END $$;
