-- REFINED ACCOUNTS MANAGEMENT SECURITY
-- 1. Enable Admin-to-Admin and Admin-to-Staff management
-- 2. Strictly protect the system root account

-- Drop existing experimental policies if any
DROP POLICY IF EXISTS "Admins can update profile roles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

-- Policy: Allow Admins to elevate/update any profile EXCEPT the default admin
-- This avoids recursion by using auth.jwt() or a simplified check
CREATE POLICY "Admin role management"
ON profiles
FOR UPDATE
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
  AND email != 'speedway.automox@gmail.com'
)
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
  AND email != 'speedway.automox@gmail.com'
);

-- Policy: Allow Admins to remove any profile EXCEPT the default admin
CREATE POLICY "Admin profile removal"
ON profiles
FOR DELETE
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
  AND email != 'speedway.automox@gmail.com'
);

-- Note: Ensure a general SELECT policy allows Admins to see all users
-- CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN' );
