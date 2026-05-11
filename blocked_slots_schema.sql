-- REQ-ADM-07: Slot Management Infrastructure
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS blocked_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_date DATE NOT NULL,
    start_time TIME, -- NULL means whole day
    end_time TIME,   -- NULL means whole day
    reason TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup during booking
CREATE INDEX IF NOT EXISTS idx_blocked_slots_date ON blocked_slots(block_date);

-- RLS Policies
ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read of blocked slots" 
ON blocked_slots FOR SELECT 
TO public 
USING (true);

CREATE POLICY "Allow admins to manage blocked slots" 
ON blocked_slots FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'super_admin')
  )
);
