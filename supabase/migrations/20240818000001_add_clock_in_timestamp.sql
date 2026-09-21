-- Migration: Add clock_in_timestamp column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS clock_in_timestamp TIMESTAMPTZ;
