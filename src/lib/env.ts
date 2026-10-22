/**
 * Public configuration. These two values are safe to ship to the browser —
 * all data access is protected by Row Level Security. The service-role key is
 * never used by this app.
 * (Referenced statically so Next.js can inline them in client bundles.)
 */
export function getPublicEnv(): { supabaseUrl: string; supabaseAnonKey: string; siteUrl: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill in your Supabase project values.",
    );
  }
  return { supabaseUrl, supabaseAnonKey, siteUrl: siteUrl.replace(/\/$/, "") };
}
