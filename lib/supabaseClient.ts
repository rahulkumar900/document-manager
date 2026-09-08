import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tkjdvwrexjemyrtvolbt.supabase.co';
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_EE1kqpjjVES2GAKeSFx_jw_dvLby3Yu';

export const supabase = createClient(supabaseUrl, supabaseKey);
