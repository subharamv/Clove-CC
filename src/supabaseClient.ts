import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string || '';

// Log configuration status
console.log('🔧 Supabase Configuration:', {
  url_set: !!SUPABASE_URL,
  key_set: !!SUPABASE_ANON_KEY,
  env_vars: Object.keys(import.meta.env).filter(k => k.startsWith('VITE_'))
});

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️  Missing Supabase configuration. Please check:');
  console.warn('  1. .env.local file exists in project root');
  console.warn('  2. VITE_SUPABASE_URL is set');
  console.warn('  3. VITE_SUPABASE_ANON_KEY is set');
  console.warn('  4. Restart dev server after changes');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    debug: false
  },
  global: {
    headers: {
      'X-Client-Info': 'clovians-cafeteria',
    },
    fetch: (url, options = {}) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const fetchOptions = {
        ...options,
        signal: controller.signal
      };

      return fetch(url, fetchOptions)
        .catch(error => {
          if (error.name === 'AbortError') {
            throw new Error('Request timeout after 30 seconds');
          }
          throw error;
        })
        .finally(() => {
          clearTimeout(timeoutId);
        });
    }
  }
});

// Backwards compatibility
export const supabaseClient = supabase;

export default supabase;
