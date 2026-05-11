-- SPEEDWAY PIPELINE HARDENING: OCR DATA PERSISTENCE
-- Run this in the Supabase SQL Editor

-- 1. Add ocr_metadata column to store extracted receipt details
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS ocr_metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Ensure booking_vehicles has a default status if missing
ALTER TABLE booking_vehicles 
ALTER COLUMN status SET DEFAULT 'pending';

-- 3. Comment for documentation
COMMENT ON COLUMN bookings.ocr_metadata IS 'Stores structured data extracted from payment receipts via Tesseract OCR.';
