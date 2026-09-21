-- Chat read receipts and efficient unread lookups.
ALTER TABLE public.booking_messages
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_booking_messages_unread
  ON public.booking_messages (booking_id, is_read, sender_id);

-- Enforce the same limit in Supabase Storage, including non-browser clients.
UPDATE storage.buckets
SET file_size_limit = 5242880
WHERE id = 'chat-attachments';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'booking_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_messages;
  END IF;
END $$;
