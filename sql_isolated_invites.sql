-- 1. Cleanup previous attempts
DROP TRIGGER IF EXISTS tr_assign_admin_role_from_invite ON profiles;
DROP FUNCTION IF EXISTS assign_admin_role_from_invite();
DROP TABLE IF EXISTS admin_invites;

-- 2. Create the new isolated INVITES table
CREATE TABLE IF NOT EXISTS invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    role TEXT CHECK (role IN ('ADMIN', 'STAFF')),
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);

-- RLS: Only admins can see the invites table (for auditing/UI)
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view invites"
ON invites FOR SELECT
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);

-- Backend (service role) handles all other operations
CREATE POLICY "Service role full access"
ON invites FOR ALL
USING (true)
WITH CHECK (true);
