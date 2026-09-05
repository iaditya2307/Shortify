const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://eoysygjxazvltwfzvcsv.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_KEY || 'sb_publishable_p-oNgBmJus9lsR3aEy_cyg_hh5KL35j';

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL or Key missing. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = {
  supabase,
  createClient: (url = supabaseUrl, key = supabaseKey) => createClient(url, key)
};
