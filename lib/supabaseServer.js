const { createBrowserClient, createServerClient } = require('@supabase/ssr');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://eoysygjxazvltwfzvcsv.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_p-oNgBmJus9lsR3aEy_cyg_hh5KL35j';

function getBrowserClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function getServerClient(cookieStore = {}) {
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.cookies || [];
      },
      setAll(cookiesToSet) {
        if (cookieStore.setCookies) {
          cookieStore.setCookies(cookiesToSet);
        }
      },
    },
  });
}

module.exports = {
  getBrowserClient,
  getServerClient,
};
