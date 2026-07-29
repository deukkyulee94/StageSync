"use client";

import { FormEvent, useState } from "react";
import { useApp } from "@/context/AppContext";
import * as repo from "@/lib/data/repository";
import { SESSION_KEY } from "@/lib/data/store";

export default function LoginPage() {
  const { data, login, setData } = useApp();
  const needsSetup = data.users.length === 0;

  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const result = login(phone, pin);
    if (!result.ok) setError(result.error ?? "로그인 실패");
  }

  async function onSetup(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      let next = data;
      next = repo.createUser(next, {
        name,
        phone,
        role: "sysadmin",
      });
      const created = next.users[next.users.length - 1];
      if (pin !== "0000") {
        next = repo.changePin(next, created.id, pin);
      }
      const res = await fetch("/api/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: next }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "저장 실패");
      setData(() => next);
      localStorage.setItem(SESSION_KEY, created.id);
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "계정 생성 실패");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-10 pt-14">
      <header className="mb-10 fade-in">
        <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-[var(--forest)] uppercase">
          Theater Rehearsal
        </p>
        <h1 className="font-display text-4xl leading-tight tracking-tight text-[var(--ink)]">
          Stage Sync
        </h1>
        <p className="mt-3 max-w-[18rem] text-sm leading-relaxed text-[var(--ink-muted)]">
          {needsSetup
            ? "등록된 계정이 없습니다. 첫 관리자 계정을 만들어 주세요."
            : "페어·장면 연습 일정을 한곳에서 조율하세요."}
        </p>
      </header>

      {needsSetup ? (
        <form onSubmit={onSetup} className="card-panel space-y-4 p-5 page-enter">
          <div className="field">
            <label htmlFor="name">이름</label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="phone">휴대폰</label>
            <input
              id="phone"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="tel"
              placeholder="01012345678"
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))
              }
              required
            />
          </div>
          <div className="field">
            <label htmlFor="pin">비밀번호 (4자리)</label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              required
            />
          </div>
          {error && (
            <p className="text-sm font-medium text-[var(--danger)]">{error}</p>
          )}
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={busy}
          >
            {busy ? "저장 중…" : "관리자 계정 만들기"}
          </button>
        </form>
      ) : (
        <form onSubmit={onSubmit} className="card-panel space-y-4 p-5 page-enter">
          <div className="field">
            <label htmlFor="phone">휴대폰</label>
            <input
              id="phone"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="tel"
              placeholder="01012345678"
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))
              }
              required
            />
          </div>
          <div className="field">
            <label htmlFor="pin">비밀번호 (4자리)</label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              autoComplete="current-password"
              placeholder="비밀번호 입력"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              required
            />
          </div>
          {error && (
            <p className="text-sm font-medium text-[var(--danger)]">{error}</p>
          )}
          <button type="submit" className="btn btn-primary w-full">
            로그인
          </button>
        </form>
      )}
    </div>
  );
}
