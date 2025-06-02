/*
  # Create Users Table and Authentication Setup

  1. New Tables
    - `users`
      - `id` (uuid, primary key) - matches auth.users
      - `email` (text, unique)
      - `role` (text) - cashier, admin, superadmin
      - `active` (boolean)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for access control
*/

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('cashier', 'admin', 'superadmin')),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read own data"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all users"
  ON users FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin', 'superadmin'));

CREATE POLICY "Admins can update users except superadmins"
  ON users FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'superadmin') AND
    (role != 'superadmin' OR auth.jwt() ->> 'role' = 'superadmin')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'superadmin') AND
    (role != 'superadmin' OR auth.jwt() ->> 'role' = 'superadmin')
  );

-- Function to handle user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (new.id, new.email, 'cashier');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user creation
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();