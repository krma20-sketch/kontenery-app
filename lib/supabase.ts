import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hzqypxzhcvodplseadad.supabase.co';
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_V5OqheAHykg2MyNaW1m8Ow_3_Lnst6F';

export const supabase = createClient(supabaseUrl, supabaseKey);