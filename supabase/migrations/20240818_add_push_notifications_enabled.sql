-- Migration: Add push_notifications_enabled column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN DEFAULT true;
