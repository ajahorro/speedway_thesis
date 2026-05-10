-- 1. Create Invitations Table
CREATE TABLE IF NOT EXISTS admin_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role_requested TEXT DEFAULT 'admin',
    status TEXT DEFAULT 'pending', -- pending, accepted, cancelled
    invited_by UUID, -- ID of the admin who sent it
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Trigger Function: Assign role on profile creation
-- This runs whenever a new profile is created (which happens after email confirmation)
CREATE OR REPLACE FUNCTION assign_admin_role_from_invite()
RETURNS TRIGGER AS $$
DECLARE
    found_invite RECORD;
BEGIN
    -- Check if there is a pending invite for this email
    SELECT * INTO found_invite 
    FROM admin_invites 
    WHERE email = NEW.email AND status = 'pending'
    LIMIT 1;

    -- If invite found, elevate role and update invite status
    IF found_invite IS NOT NULL THEN
        NEW.role := found_invite.role_requested;
        
        -- Update the invite record to 'accepted'
        UPDATE admin_invites 
        SET status = 'accepted' 
        WHERE id = found_invite.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger on profiles
-- We use BEFORE INSERT so we can modify the NEW.role before it's committed
DROP TRIGGER IF EXISTS tr_assign_admin_role_from_invite ON profiles;
CREATE TRIGGER tr_assign_admin_role_from_invite
    BEFORE INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION assign_admin_role_from_invite();

-- 4. RLS for admin_invites
ALTER TABLE admin_invites ENABLE ROW LEVEL SECURITY;

-- Admins can see all invites
CREATE POLICY "Admins can view all invites"
ON admin_invites FOR SELECT
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);

-- Only service role (backend) should insert/update
-- but we can add a policy for safety
CREATE POLICY "Service role manages invites"
ON admin_invites FOR ALL
USING (true)
WITH CHECK (true);
