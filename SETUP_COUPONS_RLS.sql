-- Enable RLS on coupons table
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON coupons;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON coupons;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON coupons;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON coupons;

-- Allow authenticated users to read their coupons
CREATE POLICY "Enable read access for authenticated users"
  ON coupons
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert coupons
CREATE POLICY "Enable insert access for authenticated users"
  ON coupons
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update coupons
CREATE POLICY "Enable update access for authenticated users"
  ON coupons
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to delete coupons
CREATE POLICY "Enable delete access for authenticated users"
  ON coupons
  FOR DELETE
  USING (auth.role() = 'authenticated');
