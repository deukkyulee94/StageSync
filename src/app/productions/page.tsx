"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useApp } from "@/context/AppContext";
import * as repo from "@/lib/data/repository";
import { isAdmin } from "@/types";

export default function ProductionsPage() {
  const { data, user, setData } = useApp();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  if (!user) return null;

  const productions = repo.getVisibleProductions(data, user);
  const canManage = isAdmin(user.role);

  function onCreate(e: FormEvent) {
    e.preventDefault();
    setData((prev) => repo.createProduction(prev, { title }));
    setTitle("");
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
                <h2 className="font-semibold text-lg">{p.title}</h2>
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
