"use client";

import { FormEvent, useEffect, useState } from "react";
import type { AppData, Rehearsal, User } from "@/types";
import * as repo from "@/lib/data/repository";

export function RehearsalParticipantBlock({
  data,
  rehearsal,
}: {
  data: AppData;
  rehearsal: Rehearsal;
}) {
  const labels = repo.getRehearsalParticipantLabels(data, rehearsal);
  if (labels.length === 0) return null;

  return (
    <div className="text-sm text-[var(--ink-muted)]">
      <p className="font-semibold text-[var(--ink)]">[참가자]</p>
      <p className="mt-0.5 leading-relaxed">{labels.join(" / ")}</p>
    </div>
  );
}

export function RehearsalInfoBlock({
  data,
  rehearsal,
}: {
  data: AppData;
  rehearsal: Rehearsal;
}) {
  const place = rehearsal.place?.trim() ?? "";
  const notes = (rehearsal.participantIds ?? [])
    .map((userId) => {
      const note = rehearsal.participantNotes?.[userId]?.trim();
      if (!note) return null;
      const name = data.users.find((u) => u.id === userId)?.name ?? "?";
      return { userId, name, note };
    })
    .filter(Boolean) as { userId: string; name: string; note: string }[];

  if (!place && notes.length === 0) return null;

  return (
    <div className="space-y-2 text-sm text-[var(--ink-muted)]">
      {place && (
        <div>
          <p className="font-semibold text-[var(--ink)]">[장소]</p>
          <p className="mt-0.5">{place}</p>
        </div>
      )}
      {notes.length > 0 && (
        <div>
          <p className="font-semibold text-[var(--ink)]">[메모]</p>
          <ul className="mt-1 space-y-1">
            {notes.map((item) => (
              <li key={item.userId}>
                <span className="font-semibold text-[var(--ink)]">
                  {item.name}
                </span>
                : {item.note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function RehearsalInfoEditor({
  rehearsal,
  user,
  onSave,
}: {
  rehearsal: Rehearsal;
  user: User;
  onSave: (patch: { place: string; myNote: string }) => void;
}) {
  const isJoined = (rehearsal.participantIds ?? []).includes(user.id);
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState(rehearsal.place ?? "");
  const [myNote, setMyNote] = useState(
    rehearsal.participantNotes?.[user.id] ?? "",
  );

  useEffect(() => {
    if (!open) return;
    setPlace(rehearsal.place ?? "");
    setMyNote(rehearsal.participantNotes?.[user.id] ?? "");
  }, [open, rehearsal.place, rehearsal.participantNotes, user.id]);

  if (!isJoined) return null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    onSave({ place, myNote });
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-ghost w-full"
        onClick={() => setOpen(true)}
      >
        일정 정보 입력/수정
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-[var(--line)] bg-white/70 p-3">
      <div className="field">
        <label htmlFor={`place-${rehearsal.id}`}>장소</label>
        <input
          id={`place-${rehearsal.id}`}
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          placeholder="예: 홍대 연습실 A"
        />
      </div>
      <div className="field">
        <label htmlFor={`note-${rehearsal.id}`}>내 메모</label>
        <textarea
          id={`note-${rehearsal.id}`}
          rows={3}
          value={myNote}
          onChange={(e) => setMyNote(e.target.value)}
          placeholder="참가자에게 남길 메모"
        />
      </div>
      <p className="text-xs text-[var(--ink-muted)]">
        장소는 참석자 모두가 수정할 수 있고, 메모는 본인 것만 수정됩니다.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="btn btn-ghost w-full"
          onClick={() => setOpen(false)}
        >
          닫기
        </button>
        <button type="submit" className="btn btn-soft w-full">
          저장
        </button>
      </div>
    </form>
  );
}

export function JoinRehearsalControls({
  data,
  rehearsal,
  user,
  onJoin,
  onLeave,
}: {
  data: AppData;
  rehearsal: Rehearsal;
  user: User;
  onJoin: (roleId?: string | null) => void;
  onLeave: () => void;
}) {
  const isJoined = (rehearsal.participantIds ?? []).includes(user.id);
  const roles = repo.getUserRolesInProduction(
    data,
    rehearsal.productionId,
    user.id,
  );
  const needsRolePick = !isJoined && roles.length > 1;
  const [picking, setPicking] = useState(false);
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");

  if (isJoined) {
    return (
      <button type="button" className="btn btn-ghost w-full" onClick={onLeave}>
        참석 취소
      </button>
    );
  }

  if (needsRolePick && picking) {
    return (
      <div className="space-y-2">
        <div className="field">
          <label htmlFor={`join-role-${rehearsal.id}`}>참석 배역</label>
          <select
            id={`join-role-${rehearsal.id}`}
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn btn-ghost w-full"
            onClick={() => setPicking(false)}
          >
            취소
          </button>
          <button
            type="button"
            className="btn btn-soft w-full"
            disabled={!roleId}
            onClick={() => {
              onJoin(roleId);
              setPicking(false);
            }}
          >
            참석 확정
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="btn btn-soft w-full"
      onClick={() => {
        if (needsRolePick) {
          setRoleId(roles[0]?.id ?? "");
          setPicking(true);
          return;
        }
        if (roles.length === 1) onJoin(roles[0].id);
        else onJoin(null);
      }}
    >
      참석하기
    </button>
  );
}
