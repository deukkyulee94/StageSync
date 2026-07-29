"use client";

import { FormEvent, useEffect, useState } from "react";
import type { AppData, Rehearsal, User } from "@/types";
import { isAdmin } from "@/types";
import * as repo from "@/lib/data/repository";
import { isMobileDevice, shareRehearsalMessage } from "@/lib/share";

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
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-[var(--line)] surface-soft p-3">
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

export function RehearsalShareButton({
  data,
  rehearsal,
}: {
  data: AppData;
  rehearsal: Rehearsal;
}) {
  const [busy, setBusy] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    setMobile(isMobileDevice());
  }, []);

  if (rehearsal.status !== "confirmed") return null;

  async function onShare() {
    setBusy(true);
    try {
      const result = await shareRehearsalMessage(data, rehearsal);
      if (result === "copied") {
        alert(
          mobile
            ? "메시지를 복사했습니다. 카카오톡에 붙여넣어 주세요."
            : "연습 일정 메시지를 복사했습니다. 카카오톡에 붙여넣어 공유하세요.",
        );
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      alert(err instanceof Error ? err.message : "공유에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="btn btn-secondary w-full"
      onClick={onShare}
      disabled={busy}
    >
      {busy
        ? "준비 중…"
        : mobile
          ? "카카오톡으로 일정 공유"
          : "일정 공유 (메시지 복사)"}
    </button>
  );
}

export function RehearsalCompleteControls({
  rehearsal,
  user,
  onComplete,
  onReopen,
}: {
  rehearsal: Rehearsal;
  user: User;
  onComplete: (note: string) => void;
  onReopen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(rehearsal.completionNote ?? "");
  const isJoined = (rehearsal.participantIds ?? []).includes(user.id);
  const canEdit = isJoined || isAdmin(user.role);

  if (!canEdit) {
    if (rehearsal.status === "done" && rehearsal.completionNote?.trim()) {
      return (
        <p className="text-sm text-[var(--ink-muted)]">
          <span className="font-semibold text-[var(--ink)]">완료 메모: </span>
          {rehearsal.completionNote.trim()}
        </p>
      );
    }
    return null;
  }

  if (rehearsal.status === "done") {
    return (
      <div className="space-y-2">
        {rehearsal.completionNote?.trim() && (
          <p className="text-sm text-[var(--ink-muted)]">
            <span className="font-semibold text-[var(--ink)]">완료 메모: </span>
            {rehearsal.completionNote.trim()}
          </p>
        )}
        {onReopen && (
          <button
            type="button"
            className="btn btn-ghost w-full"
            onClick={onReopen}
          >
            완료 취소 (확정으로 되돌리기)
          </button>
        )}
      </div>
    );
  }

  if (rehearsal.status !== "confirmed" && rehearsal.status !== "proposed") {
    return null;
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-ghost w-full"
        onClick={() => setOpen(true)}
      >
        연습 완료 처리
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--line)] surface-soft p-3">
      <p className="text-sm font-semibold">연습 완료</p>
      <div className="field">
        <label htmlFor={`done-note-${rehearsal.id}`}>
          다음 연습 메모 (선택)
        </label>
        <textarea
          id={`done-note-${rehearsal.id}`}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="다음에 볼 장면, 보완할 점 등"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="btn btn-ghost w-full"
          onClick={() => setOpen(false)}
        >
          닫기
        </button>
        <button
          type="button"
          className="btn btn-soft w-full"
          onClick={() => {
            onComplete(note);
            setOpen(false);
          }}
        >
          완료
        </button>
      </div>
    </div>
  );
}
