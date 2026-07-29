import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} 환경 변수가 없습니다. .env.local을 확인하세요.`);
  }
  return value;
}

/** 브라우저/서버 공용 anon 클라이언트 */
export function createBrowserClient(): SupabaseClient {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/rest\/v1\/?$/, ""),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}

/** 서버 전용 service role (API route에서만 사용) */
export function createServiceClient(): SupabaseClient {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/rest\/v1\/?$/, "");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
