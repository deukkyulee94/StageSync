"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { BottomNav } from "@/components/BottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, user, dbError, saving } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  useEffect(() => {
    if (!ready) return;
    if (!user && !isLogin) router.replace("/login");
    if (user && isLogin) router.replace("/");
  }, [ready, user, isLogin, router]);

  if (!ready) {
    return (
      <div className="app-shell flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-display text-2xl text-[var(--ink)]">Stage Sync</p>
        <p className="text-sm text-[var(--ink-muted)]">Supabase에서 불러오는 중…</p>
      </div>
    );
  }

  if (isLogin) {
    return (
      <div className="app-shell">
        {dbError && (
          <div className="mx-4 mt-4 rounded-xl border border-[var(--danger)] bg-[var(--accent-soft)] p-3 text-xs text-[var(--danger)]">
            DB 연결: {dbError}
          </div>
        )}
        {children}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-shell flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-display text-2xl">Stage Sync</p>
        <p className="text-sm text-[var(--ink-muted)]">로그인이 필요합니다</p>
        <Link href="/login" className="btn btn-primary">
          로그인으로 이동
        </Link>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {(dbError || saving) && (
        <div
          className={`mx-4 mt-2 rounded-xl px-3 py-2 text-xs ${
            dbError
              ? "border border-[var(--danger)] text-[var(--danger)]"
              : "text-[var(--ink-muted)]"
          }`}
        >
          {dbError ? `저장 오류: ${dbError}` : "Supabase 저장 중…"}
        </div>
      )}
      <main
        className="px-4 pt-4 page-enter"
        style={{ paddingBottom: "calc(var(--nav-h) + var(--safe-bottom) + 20px)" }}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
