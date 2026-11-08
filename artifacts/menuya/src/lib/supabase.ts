import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn(
    'MENUYA: faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY. ' +
      'Configúralas en el entorno antes de habilitar autenticación.',
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabasePublishableKey || 'placeholder-publishable-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  },
);

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
);
