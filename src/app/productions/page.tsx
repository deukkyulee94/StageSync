"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useApp } from "@/context/AppContext";
import * as repo from "@/lib/data/repository";
import {
  CASTING_MODE_LABELS,
  isAdmin,
  type CastingMode,
} from "@/types";

export default function ProductionsPage() {
  const { data, user, setData } = useApp();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [castingMode, setCastingMode] = useState<CastingMode>("scene");

  if (!user) return null;

  const productions = repo.getVisibleProductions(data, user);
  const canManage = isAdmin(user.role);

  function onCreate(e: FormEvent) {
    e.preventDefault();
    setData((prev) =>
      repo.createProduction(prev, { title, castingMode }),
    );
    setTitle("");
    setCastingMode("scene");
    setOpen(false);
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">작품</h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {canManage
              ? "관리자는 모든 워크스페이스를 볼 수 있습니다"
              : "내가 소속된 작품"}
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "닫기" : "등록"}
          </button>
        )}
      </header>

      {open && canManage && (
        <form onSubmit={onCreate} className="card-panel space-y-3 p-4 page-enter">
          <div className="field">
            <label htmlFor="title">작품명</label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-[var(--ink-muted)]">
              캐스팅 방식
            </legend>
            <p className="text-xs text-[var(--ink-muted)]">
              작품마다 팀 단위 또는 장면 단위 중 하나로 운영합니다. 나중에 바꿀
              수 있지만, 처음부터 맞게 고르는 편이 편합니다.
            </p>
            {(
              [
                ["scene", "장면마다 배우 라인업을 따로 잡습니다 (죽음 혹은 아님 / 올모스트 메인)"],
                ["team", "A/B팀처럼 더블캐스트 팀으로 나눕니다 (완벽한 타인 / 도덕적 도둑)"],
              ] as const
            ).map(([value, hint]) => (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 ${
                  castingMode === value
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]/50"
                    : "border-[var(--line)] bg-white/70"
                }`}
              >
                <input
                  type="radio"
                  name="castingMode"
                  className="mt-1"
                  checked={castingMode === value}
                  onChange={() => setCastingMode(value)}
                />
                <span className="text-sm">
                  <span className="font-semibold">
                    {CASTING_MODE_LABELS[value]}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--ink-muted)]">
                    {hint}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <button type="submit" className="btn btn-secondary w-full">
            작품 만들기
          </button>
        </form>
      )}

      <ul className="space-y-2">
        {productions.map((p) => {
          const memberCount = data.productionMembers.filter(
            (m) => m.productionId === p.id,
          ).length;
          const roleCount = data.roles.filter(
            (r) => r.productionId === p.id,
          ).length;
          return (
            <li key={p.id}>
              <Link
                href={`/productions/${p.id}`}
                className="card-panel block p-4 active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-lg">{p.title}</h2>
                  <span className="chip shrink-0">
                    {p.castingMode === "team" ? "팀" : "장면"}
                  </span>
                </div>
                <p className="mt-3 text-xs text-[var(--ink-muted)]">
                  멤버 {memberCount} · 배역 {roleCount}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
