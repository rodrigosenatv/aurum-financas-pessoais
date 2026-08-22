import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Cliente JS do Supabase para operações de autenticação, storage ou real-time.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
