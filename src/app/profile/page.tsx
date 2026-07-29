"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useApp } from "@/context/AppContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import * as repo from "@/lib/data/repository";
import { ROLE_LABELS } from "@/types";

export default function ProfilePage() {
  const { user, setData, logout } = useApp();
  const [pin, setPin] = useState("");
  const [pinMsg, setPinMsg] = useState("");

  if (!user) return null;

  function changePin(e: FormEvent) {
    e.preventDefault();
    setPinMsg("");
    try {
      setData((prev) => repo.changePin(prev, user!.id, pin));
      setPinMsg("비밀번호가 변경되었습니다.");
      setPin("");
    } catch (err) {
      setPinMsg(err instanceof Error ? err.message : "변경 실패");
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-3xl">{user.name}</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          {ROLE_LABELS[user.role]} · {user.phone}
        </p>
      </header>

      <ThemeToggle />

      <Link href="/guide" className="btn btn-soft w-full">
        이용 가이드 보기
      </Link>

      <form onSubmit={changePin} className="card-panel space-y-3 p-4">
        <h2 className="font-semibold">비밀번호 변경</h2>
        <div className="field">
          <label htmlFor="newPin">새 4자리 비밀번호</label>
          <input
            id="newPin"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) =>
              setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            required
          />
        </div>
        {pinMsg && (
          <p className="text-sm text-[var(--forest)]">{pinMsg}</p>
        )}
        <button type="submit" className="btn btn-ghost w-full">
          변경
        </button>
      </form>

      <button type="button" className="btn btn-primary w-full" onClick={logout}>
        로그아웃
      </button>
    </div>
  );
}
