import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hzqypxzhcvodplseadad.supabase.co';
const supabaseKey = 'sb_publishable_V5OqheAHykg2MyNaW1m8Ow_3_Lnst6F';

export const supabase = createClient(supabaseUrl, supabaseKey);