"use client";

import { FormEvent, useState } from "react";
import { useApp } from "@/context/AppContext";
import * as repo from "@/lib/data/repository";
import { ROLE_LABELS, isAdmin, type User, type UserRole } from "@/types";

type FormState = {
  name: string;
  phone: string;
  role: UserRole;
};

const emptyForm: FormState = {
  name: "",
  phone: "",
  role: "actor",
};

export default function ActorsPage() {
  const { data, user, setData } = useApp();
  const [mode, setMode] = useState<"closed" | "create" | "edit">("closed");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [resetPin, setResetPin] = useState(false);

  if (!user) return null;
  const canManage = isAdmin(user.role);

  function openCreate() {
    setMode("create");
    setEditingId(null);
    setForm(emptyForm);
    setResetPin(false);
    setError("");
  }

  function openEdit(target: User) {
    setMode("edit");
    setEditingId(target.id);
    setForm({
      name: target.name,
      phone: target.phone,
      role: target.role,
    });
    setResetPin(false);
    setError("");
  }

  function closeForm() {
    setMode("closed");
    setEditingId(null);
    setForm(emptyForm);
    setResetPin(false);
    setError("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (mode === "create") {
        setData((prev) =>
          repo.createUser(prev, {
            name: form.name,
            phone: form.phone,
            role: form.role,
          }),
        );
      } else if (mode === "edit" && editingId) {
        setData((prev) =>
          repo.updateUser(prev, editingId, {
            name: form.name,
            phone: form.phone,
            role: form.role,
            ...(resetPin ? { pin: "0000" } : {}),
          }),
        );
      }
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    }
  }

  function onDelete(target: User) {
    if (target.id === user!.id) {
      alert("자기 자신은 삭제할 수 없습니다.");
      return;
    }
    if (
      !confirm(
        `${target.name}님을 삭제할까요?\n작품 소속·배역 연결·가능일도 함께 정리됩니다.`,
      )
    ) {
      return;
    }
    setData((prev) => repo.deleteUser(prev, target.id));
    if (editingId === target.id) closeForm();
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">배우 · 멤버</h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {data.users.length}명 등록됨
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => (mode === "closed" ? openCreate() : closeForm())}
          >
            {mode === "closed" ? "등록" : "닫기"}
          </button>
        )}
      </header>

      {mode !== "closed" && canManage && (
        <form onSubmit={onSubmit} className="card-panel space-y-3 p-4 page-enter">
          <p className="font-semibold">
            {mode === "create" ? "멤버 등록" : "멤버 수정"}
          </p>
          <div className="field">
            <label htmlFor="name">이름</label>
            <input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="phone">휴대폰 (로그인 ID)</label>
            <input
              id="phone"
              inputMode="numeric"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="01012345678"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="role">권한</label>
            <select
              id="role"
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as UserRole })
              }
            >
              <option value="actor">배우</option>
              <option value="director">연출</option>
              <option value="producer">단장</option>
              {user.role === "sysadmin" && (
                <option value="sysadmin">시스템 관리자</option>
              )}
            </select>
          </div>
          {mode === "create" && (
            <p className="text-xs text-[var(--ink-muted)]">
              초기 비밀번호는 0000 입니다.
            </p>
          )}
          {mode === "edit" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={resetPin}
                onChange={(e) => setResetPin(e.target.checked)}
              />
              비밀번호를 0000으로 초기화
            </label>
          )}
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <button type="submit" className="btn btn-secondary w-full">
            {mode === "create" ? "등록하기" : "저장하기"}
          </button>
        </form>
      )}

      <ul className="space-y-2">
        {data.users.map((u) => (
          <li key={u.id} className="card-panel p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{u.name}</p>
                <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
                  {formatPhone(u.phone)}
                </p>
              </div>
              <span className="chip">{ROLE_LABELS[u.role]}</span>
            </div>
            {canManage && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost flex-1 !min-h-10 text-sm"
                  onClick={() => openEdit(u)}
                >
                  수정
                </button>
                <button
                  type="button"
                  className="btn btn-ghost !min-h-10 px-4 text-sm text-[var(--danger)]"
                  onClick={() => onDelete(u)}
                  disabled={u.id === user.id}
                >
                  삭제
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatPhone(p: string) {
  if (p.length === 11) return `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}`;
  return p;
}
