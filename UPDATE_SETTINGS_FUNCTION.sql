-- Function to update multiple system settings at once
CREATE OR REPLACE FUNCTION public.update_multiple_settings(settings_data JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    setting_record JSONB;
    v_setting_key TEXT;
    v_setting_value TEXT;
    v_setting_type TEXT;
    v_updated BOOLEAN := TRUE;
BEGIN
    -- Process each setting in the JSONB array
    FOR setting_record IN SELECT value FROM jsonb_array_elements(settings_data)
    LOOP
        v_setting_key := setting_record->>'setting_key';
        v_setting_value := setting_record->>'setting_value';
        v_setting_type := setting_record->>'setting_type';
        
        -- Update or insert each setting
        INSERT INTO public.system_settings (setting_key, setting_value, setting_type, updated_at)
        VALUES (v_setting_key, v_setting_value, v_setting_type, NOW())
        ON CONFLICT (setting_key) 
        DO UPDATE SET 
            setting_value = EXCLUDED.setting_value,
            setting_type = EXCLUDED.setting_type,
            updated_at = NOW();
            
        IF NOT FOUND THEN
            v_updated := FALSE;
        END IF;
    END LOOP;
    
    RETURN v_updated;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.update_multiple_settings(JSONB) TO postgres, authenticated, anon;