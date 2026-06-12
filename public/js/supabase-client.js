// Browser-Client für Supabase. Nutzt den PUBLISHABLE Key — der ist für den
// Browser gedacht und durch Row-Level-Security geschützt (kein Geheimnis).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const SUPABASE_URL = 'https://uyqjaasrnqkvuhgtnjbj.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_vmm6yHGzsKCteylEfJr6qw_WvkKM_RD';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
