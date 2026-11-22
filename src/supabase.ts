import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublicKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseConfigurationError = !supabaseUrl || !supabasePublicKey
  ? "Supabase isn't configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the deployment environment."
  : "";

export const supabase = supabaseUrl && supabasePublicKey
  ? createClient(supabaseUrl, supabasePublicKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
      flowType: "pkce",
    },
  })
  : null;

let activeDemoUserId = "local";

export const setActiveDemoUser = (userId: string | null) => {
  activeDemoUserId = userId || "local";
};

export const getDemoStoreKey = () => `wellnest-pages-data-v1:${activeDemoUserId}`;
