import { createClient } from '@supabase/supabase-js';

// Public anon key only — safe to ship in the browser bundle.
// Set these in the hosting environment (Lovable / Pages build vars).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const SUPABASE_READY = Boolean(url && anonKey);

export const supabase = SUPABASE_READY ? createClient(url!, anonKey!) : null;
