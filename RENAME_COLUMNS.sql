-- ============================================
-- RENAME CAMELCASE COLUMNS TO SNAKE_CASE
-- ============================================

-- Rename existing camelCase columns to snake_case to match TypeScript interfaces
ALTER TABLE public.coupons RENAME COLUMN "empid" TO emp_id;
ALTER TABLE public.coupons RENAME COLUMN "othours" TO ot_hours; 
ALTER TABLE public.coupons RENAME COLUMN "issuedate" TO issue_date;
ALTER TABLE public.coupons RENAME COLUMN "validtill" TO valid_till;
ALTER TABLE public.coupons RENAME COLUMN "serialcode" TO serial_code;

-- Convert date columns from text to proper DATE type
ALTER TABLE public.coupons 
ALTER COLUMN issue_date TYPE DATE USING issue_date::DATE;

ALTER TABLE public.coupons 
ALTER COLUMN valid_till TYPE DATE USING CASE 
    WHEN valid_till = '' OR valid_till IS NULL THEN NULL
    ELSE valid_till::DATE
END;

-- Set required columns to NOT NULL
ALTER TABLE public.coupons ALTER COLUMN name SET NOT NULL;
ALTER TABLE public.coupons ALTER COLUMN emp_id SET NOT NULL;
ALTER TABLE public.coupons ALTER COLUMN serial_code SET NOT NULL;
ALTER TABLE public.coupons ALTER COLUMN issue_date SET NOT NULL;

-- Add constraints for data integrity (using DO block to check if constraints exist)
DO $$
BEGIN
    -- Add status check constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'coupons_status_check' 
        AND table_name = 'coupons' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.coupons ADD CONSTRAINT coupons_status_check 
        CHECK (status IN ('PENDING', 'READY', 'RECEIVED', 'ISSUED'));
        RAISE NOTICE 'Added status check constraint';
    END IF;
    
    -- Add unique constraint on serial_code if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'coupons_serial_code_unique' 
        AND table_name = 'coupons' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.coupons ADD CONSTRAINT coupons_serial_code_unique 
        UNIQUE (serial_code);
        RAISE NOTICE 'Added unique constraint on serial_code';
    END IF;
END $$;

-- Verify the final table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default 
FROM information_schema.columns 
WHERE table_name = 'coupons' AND table_schema = 'public' 
ORDER BY ordinal_position;