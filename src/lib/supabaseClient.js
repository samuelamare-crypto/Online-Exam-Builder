// Browser Supabase client. The anon key is meant to be public — every table
// it can touch is locked down by Row Level Security (see
// supabase/migrations/0001_init.sql), so exposing this key client-side is
// safe by design, not an oversight.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const key = publishableKey || anonKey;

function createMissingSupabaseClient(message) {
  const missingError = { message };

  const queryBuilder = {
    select() { return this; },
    order() { return this; },
    eq() { return this; },
    insert() { return this; },
    update() { return this; },
    delete() { return this; },
    single() { return Promise.resolve({ data: null, error: missingError }); },
    maybeSingle() { return Promise.resolve({ data: null, error: missingError }); },
    head() { return this; },
    not() { return this; },
    then(resolve) {
      return resolve({ data: null, error: missingError });
    },
  };

  return {
    auth: {
      async getSession() {
        return { data: { session: null }, error: null };
      },
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async signUp() {
        return { data: null, error: missingError };
      },
      async signInWithPassword() {
        return { data: null, error: missingError };
      },
      async signOut() {
        return { data: null, error: missingError };
      },
      async updateUser() {
        return { data: null, error: missingError };
      },
    },
    from() {
      return queryBuilder;
    },
    rpc() {
      return Promise.resolve({ data: null, error: missingError });
    },
  };
}

if (!url || !key) {
  // Surfaced as a visible error rather than a silent crash deep in a
  // network call, so a missing .env is obvious immediately on load.
  console.error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env, " +
    "fill in your Supabase project's URL plus either VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY, and restart the dev server."
  );
}

export const supabase = url && key
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : createMissingSupabaseClient(
      "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env, fill in your Supabase project's URL plus either VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY, and restart the dev server."
    );
