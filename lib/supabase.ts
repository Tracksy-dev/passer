import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storage: {
        getItem: (key) => {
          if (typeof window === 'undefined') return null;
          // Try cookies first, then localStorage
          const cookieMatch = document.cookie.match(new RegExp(`(^| )${key}=([^;]+)`));
          if (cookieMatch) return decodeURIComponent(cookieMatch[2]);
          return localStorage.getItem(key);
        },
        setItem: (key, value) => {
          if (typeof window === 'undefined') return;
          // Store in both cookie and localStorage for SSR compatibility
          const maxAge = 60 * 60 * 24 * 365; // 1 year
          document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
          localStorage.setItem(key, value);
        },
        removeItem: (key) => {
          if (typeof window === 'undefined') return;
          document.cookie = `${key}=; path=/; max-age=0`;
          localStorage.removeItem(key);
        },
      },
    },
  }
);