import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://mmfliflzcprkaltxenmq.supabase.co";
const publishableKey = "sb_publishable_FoCJTUYVHpEGnox8L4fFRQ_HXEWkMEN";

export const supabase = createClient(supabaseUrl, publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

export async function ensureAnonymousSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user;
  const { data: signedIn, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!signedIn.user) throw new Error("Anonymous sign-in failed");
  return signedIn.user;
}
