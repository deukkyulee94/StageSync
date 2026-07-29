"use client";

import Link from "next/link";
import { useApp } from "@/context/AppContext";
import * as repo from "@/lib/data/repository";
import {
  JoinRehearsalControls,
  RehearsalInfoBlock,
  RehearsalInfoEditor,
  RehearsalParticipantBlock,
} from "@/components/RehearsalParticipants";
import { formatDateWithWeekday, isRehearsalListVisible } from "@/lib/recommend";
import { ROLE_LABELS, isAdmin } from "@/types";

export default function HomePage() {
  const { data, user, setData } = useApp();
  if (!user) return null;
  const currentUser = user;

  const productions = repo.getVisibleProductions(data, currentUser);
  const upcoming = data.rehearsals
    .filter(
      (r) =>
        (r.status === "proposed" || r.status === "confirmed") &&
        isRehearsalListVisible(r.date),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  const myAvailCount = data.availabilities.filter(
    (a) => a.userId === currentUser.id,
  ).length;
  const canManage = isAdmin(currentUser.role);

  function deleteRehearsal(rehearsalId: string, label: string) {
    if (!confirm(`"${label}" 연습을 삭제할까요?`)) return;
    setData((prev) => repo.deleteRehearsal(prev, rehearsalId));
  }

  function joinRehearsal(rehearsalId: string, roleId?: string | null) {
    try {
      setData((prev) =>
        repo.joinRehearsal(prev, rehearsalId, currentUser.id, roleId),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "참석 실패");
    }
  }

  function leaveRehearsal(rehearsalId: string) {
    if (!confirm("참석을 취소할까요?")) return;
    let deleted = false;
    setData((prev) => {
      const result = repo.leaveRehearsal(prev, rehearsalId, currentUser.id);
      deleted = result.deleted;
      return result.data;
    });
    if (deleted) {
      alert("참석자가 없어 연습 일정이 삭제되었습니다.");
    }
  }

  function saveRehearsalInfo(
    rehearsalId: string,
    patch: { place: string; myNote: string },
  ) {
    try {
      setData((prev) => {
        let next = repo.setRehearsalPlace(prev, rehearsalId, patch.place);
        next = repo.setParticipantNote(
          next,
          rehearsalId,
          currentUser.id,
          patch.myNote,
        );
        return next;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "저장 실패");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-[var(--ink-muted)]">안녕하세요</p>
        <h1 className="font-display mt-1 text-3xl tracking-tight">
          {currentUser.name}
        </h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="chip">{ROLE_LABELS[currentUser.role]}</span>
          <Link
            href="/guide"
            className="chip chip-accent"
          >
            이용 가이드
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="card-panel p-4">
          <p className="text-xs font-semibold text-[var(--ink-muted)]">작품</p>
          <p className="mt-1 font-display text-3xl">{productions.length}</p>
        </div>
        <div className="card-panel p-4">
          <p className="text-xs font-semibold text-[var(--ink-muted)]">
            내 가능일
          </p>
          <p className="mt-1 font-display text-3xl">{myAvailCount}</p>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-xl">작품 워크스페이스</h2>
          {isAdmin(currentUser.role) && (
            <Link
              href="/productions"
              className="text-sm font-semibold text-[var(--accent)]"
            >
              관리
            </Link>
          )}
        </div>
        <ul className="space-y-2">
          {productions.length === 0 && (
            <li className="card-panel p-4 text-sm text-[var(--ink-muted)]">
              소속된 작품이 없습니다.
            </li>
          )}
          {productions.map((p) => (
            <li key={p.id}>
              <Link
                href={`/productions/${p.id}`}
                className="card-panel flex items-center justify-between p-4 transition-transform active:scale-[0.99]"
              >
                <p className="font-semibold">{p.title}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-xl">연습 일정</h2>
          <Link
            href="/availability"
            className="text-sm font-semibold text-[var(--accent)]"
          >
            가능일 입력
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="card-panel p-4 text-sm text-[var(--ink-muted)]">
            확정·제안된 연습이 없습니다. 연습 일정에서 가능일을
            잡아보세요.
          </div>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((r) => {
              const prod = data.productions.find((p) => p.id === r.productionId);
              const label = `${prod?.title ?? "연습"} · ${formatDateWithWeekday(r.date)}`;
              return (
                <li key={r.id} className="card-panel space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{label}</p>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="chip">
                        {r.status === "proposed"
                          ? "제안"
                          : r.status === "confirmed"
                            ? "확정"
                            : r.status}
                      </span>
                      {canManage && (
                        <button
                          type="button"
                          className="text-sm font-semibold text-[var(--danger)]"
                          onClick={() => deleteRehearsal(r.id, label)}
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-[var(--ink-muted)]">
                    {r.startTime}–{r.endTime}
                    {r.locationNote ? ` · ${r.locationNote}` : ""}
                  </p>
                  <RehearsalParticipantBlock data={data} rehearsal={r} />
                  <RehearsalInfoBlock data={data} rehearsal={r} />
                  <RehearsalInfoEditor
                    rehearsal={r}
                    user={currentUser}
                    onSave={(patch) => saveRehearsalInfo(r.id, patch)}
                  />
                  <JoinRehearsalControls
                    data={data}
                    rehearsal={r}
                    user={currentUser}
                    onJoin={(roleId) => joinRehearsal(r.id, roleId)}
                    onLeave={() => leaveRehearsal(r.id)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Link href="/recommend" className="btn btn-secondary w-full">
        주간 연습 일정 잡기
      </Link>
    </div>
  );
}
