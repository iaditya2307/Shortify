// Client-side Supabase Client Initialization
const SUPABASE_URL = 'https://eoysygjxazvltwfzvcsv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_p-oNgBmJus9lsR3aEy_cyg_hh5KL35j';

/**
 * Get or initialize Supabase JS client in browser.
 * Make sure to load @supabase/supabase-js library via CDN or bundle.
 */
function getSupabaseClient() {
  if (window.supabase) {
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  }
  console.warn('Supabase client SDK library not loaded on window.');
  return null;
}

window.getSupabaseClient = getSupabaseClient;
