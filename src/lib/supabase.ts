import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file.');
}

if (supabaseUrl.includes('@supabase.co')) {
  throw new Error(
    'Invalid VITE_SUPABASE_URL. Use https://<project-ref>.supabase.co, not https://<project-ref>@supabase.co.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
