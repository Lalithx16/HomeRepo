"use client";

import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Browser Supabase client (anon key + user session; RLS applies). */
export function getBrowserClient() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Supabase environment variables are not configured.");
    client = createBrowserClient(url, key);
  }
  return client;
}
