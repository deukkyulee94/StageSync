"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import * as repo from "@/lib/data/repository";
import {
  JoinRehearsalControls,
  RehearsalCompleteControls,
  RehearsalInfoBlock,
  RehearsalInfoEditor,
  RehearsalParticipantBlock,
  RehearsalShareButton,
} from "@/components/RehearsalParticipants";
import { addDaysYmd, startOfWeekMondayKst } from "@/lib/kst";
import {
  buildWeekCalendarForProduction,
  buildWeeklyScheduleText,
  formatDateShort,
  formatDateWithWeekday,
  isPastRehearsal,
  isUpcomingRehearsal,
  isUserInRehearsal,
  sortRehearsalsAsc,
  sortRehearsalsDesc,
} from "@/lib/recommend";
import { copyText } from "@/lib/share";
import {
  ROLE_LABELS,
  isAdmin,
  type AppData,
  type Rehearsal,
  type User,
} from "@/types";

type ScheduleFilter = "mine" | "all";

function RehearsalCard({
  data,
  rehearsal,
  currentUser,
  canManage,
  onDelete,
  onJoin,
  onLeave,
  onSaveInfo,
  onComplete,
  onReopen,
}: {
  data: AppData;
  rehearsal: Rehearsal;
  currentUser: User;
  canManage: boolean;
  onDelete: () => void;
  onJoin: (roleId?: string | null) => void;
  onLeave: () => void;
  onSaveInfo: (patch: { place: string; myNote: string }) => void;
  onComplete: (note: string) => void;
  onReopen: () => void;
}) {
  const prod = data.productions.find((p) => p.id === rehearsal.productionId);
  const label = `${prod?.title ?? "연습"} · ${formatDateWithWeekday(rehearsal.date)}`;
  const statusLabel =
    rehearsal.status === "proposed"
      ? "제안"
      : rehearsal.status === "confirmed"
        ? "확정"
        : rehearsal.status === "done"
          ? "완료"
          : rehearsal.status;
  const canDelete =
    rehearsal.status !== "done" &&
    (canManage || isUserInRehearsal(rehearsal, currentUser.id));

  return (
    <li className="card-panel space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">{label}</p>
        <div className="flex shrink-0 items-center gap-2">
          <span className="chip">{statusLabel}</span>
          {canDelete && (
            <button
              type="button"
              className="text-sm font-semibold text-[var(--danger)]"
              onClick={onDelete}
            >
              삭제
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-[var(--ink-muted)]">
        {rehearsal.startTime}–{rehearsal.endTime}
        {rehearsal.locationNote ? ` · ${rehearsal.locationNote}` : ""}
      </p>
      <RehearsalParticipantBlock data={data} rehearsal={rehearsal} />
      <RehearsalInfoBlock data={data} rehearsal={rehearsal} />
      {rehearsal.status !== "done" && (
        <RehearsalInfoEditor
          rehearsal={rehearsal}
          user={currentUser}
          onSave={onSaveInfo}
        />
      )}
      <RehearsalShareButton data={data} rehearsal={rehearsal} />
      {rehearsal.status !== "done" && (
        <JoinRehearsalControls
          data={data}
          rehearsal={rehearsal}
          user={currentUser}
          onJoin={onJoin}
          onLeave={onLeave}
        />
      )}
      <RehearsalCompleteControls
        rehearsal={rehearsal}
        user={currentUser}
        onComplete={onComplete}
        onReopen={onReopen}
      />
    </li>
  );
}

export default function HomePage() {
  const { data, user, setData } = useApp();
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>("all");
  const [showPast, setShowPast] = useState(false);
  const [weekStart, setWeekStart] = useState(() => startOfWeekMondayKst());
  const [weekProductionId, setWeekProductionId] = useState("");
  const [copyBusy, setCopyBusy] = useState(false);
  const [weekOverviewOpen, setWeekOverviewOpen] = useState(false);

  const upcoming = useMemo(() => {
    if (!user) return [];
    return data.rehearsals
      .filter((r) => {
        if (!isUpcomingRehearsal(r)) return false;
        if (scheduleFilter === "mine") {
          return isUserInRehearsal(r, user.id);
        }
        return true;
      })
      .sort(sortRehearsalsAsc);
  }, [data.rehearsals, scheduleFilter, user]);

  const past = useMemo(() => {
    if (!user) return [];
    return data.rehearsals
      .filter((r) => {
        if (!isPastRehearsal(r)) return false;
        if (scheduleFilter === "mine") {
          return isUserInRehearsal(r, user.id);
        }
        return true;
      })
      .sort(sortRehearsalsDesc)
      .slice(0, 20);
  }, [data.rehearsals, scheduleFilter, user]);

  const productions = useMemo(() => {
    if (!user) return [];
    return repo.getVisibleProductions(data, user);
  }, [data, user]);

  const activeWeekProductionId = weekProductionId || productions[0]?.id || "";

  const weekCalendar = useMemo(() => {
    if (!activeWeekProductionId) return [];
    return buildWeekCalendarForProduction(
      data,
      activeWeekProductionId,
      weekStart,
    );
  }, [data, activeWeekProductionId, weekStart]);

  if (!user) return null;
  const currentUser = user;
  const canManage = isAdmin(currentUser.role);
  const myAvailCount = data.availabilities.filter(
    (a) => a.userId === currentUser.id,
  ).length;

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

  function completeRehearsal(rehearsalId: string, note: string) {
    try {
      setData((prev) => repo.markRehearsalDone(prev, rehearsalId, note));
    } catch (err) {
      alert(err instanceof Error ? err.message : "완료 처리 실패");
    }
  }

  function reopenRehearsal(rehearsalId: string) {
    if (!confirm("완료를 취소하고 확정 일정으로 되돌릴까요?")) return;
    try {
      setData((prev) => repo.reopenRehearsal(prev, rehearsalId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "되돌리기 실패");
    }
  }

  async function copyWeeklyText() {
    if (!activeWeekProductionId) return;
    setCopyBusy(true);
    try {
      const text = buildWeeklyScheduleText(
        data,
        activeWeekProductionId,
        weekStart,
      );
      await copyText(text);
      alert("주간 일정 텍스트를 복사했습니다. 단톡에 붙여넣으세요.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "복사에 실패했습니다.");
    } finally {
      setCopyBusy(false);
    }
  }

  function renderCard(r: Rehearsal) {
    const prod = data.productions.find((p) => p.id === r.productionId);
    const label = `${prod?.title ?? "연습"} · ${formatDateWithWeekday(r.date)}`;
    return (
      <RehearsalCard
        key={r.id}
        data={data}
        rehearsal={r}
        currentUser={currentUser}
        canManage={canManage}
        onDelete={() => deleteRehearsal(r.id, label)}
        onJoin={(roleId) => joinRehearsal(r.id, roleId)}
        onLeave={() => leaveRehearsal(r.id)}
        onSaveInfo={(patch) => saveRehearsalInfo(r.id, patch)}
        onComplete={(note) => completeRehearsal(r.id, note)}
        onReopen={() => reopenRehearsal(r.id)}
      />
    );
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
          <Link href="/guide" className="chip chip-accent">
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

      <section className="card-panel space-y-3 p-4">
        <button
          type="button"
          className="flex w-full items-start justify-between gap-3 text-left"
          onClick={() => setWeekOverviewOpen((v) => !v)}
          aria-expanded={weekOverviewOpen}
        >
          <div>
            <h2 className="font-display text-xl">주간 한눈에 보기</h2>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              가능 인원 수와 이미 잡힌 연습을 날짜별로 겹쳐 봅니다
            </p>
          </div>
          <span
            className="mt-1 shrink-0 text-sm font-semibold text-[var(--accent)]"
            aria-hidden
          >
            {weekOverviewOpen ? "접기" : "펼치기"}
          </span>
        </button>

        {weekOverviewOpen &&
          (productions.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">
              소속된 작품이 없습니다.
            </p>
          ) : (
            <>
              <div className="field">
                <label htmlFor="week-production">작품</label>
                <select
                  id="week-production"
                  value={activeWeekProductionId}
                  onChange={(e) => setWeekProductionId(e.target.value)}
                >
                  {productions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="btn btn-ghost px-3 py-1.5 text-sm"
                  onClick={() => setWeekStart(addDaysYmd(weekStart, -7))}
                >
                  이전 주
                </button>
                <p className="text-sm font-semibold">
                  {formatDateShort(weekStart)} ~
                </p>
                <button
                  type="button"
                  className="btn btn-ghost px-3 py-1.5 text-sm"
                  onClick={() => setWeekStart(addDaysYmd(weekStart, 7))}
                >
                  다음 주
                </button>
              </div>

              {weekCalendar.length === 0 ? (
                <p className="text-sm text-[var(--ink-muted)]">
                  표시할 날짜가 없습니다.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {weekCalendar.map((day) => (
                    <div
                      key={day.date}
                      className={`rounded-xl border px-3 py-3 ${
                        day.allAvailable
                          ? "border-[var(--forest)] bg-[var(--forest-soft)]/50"
                          : "border-[var(--line)] surface-soft"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {formatDateShort(day.date)}
                        </p>
                        <p className="text-xs text-[var(--ink-muted)]">
                          가능 {day.availableCount}/{day.totalPeople}
                        </p>
                      </div>
                      {day.rehearsals.length === 0 ? (
                        <p className="mt-2 text-xs text-[var(--ink-muted)]">
                          예정 연습 없음
                        </p>
                      ) : (
                        <ul className="mt-2 space-y-1">
                          {day.rehearsals.map((r) => (
                            <li
                              key={r.id}
                              className="text-xs text-[var(--accent)]"
                            >
                              {r.startTime}–{r.endTime} ·{" "}
                              {r.locationNote || "연습"}
                              {r.status === "proposed"
                                ? " (제안)"
                                : r.status === "done"
                                  ? " (완료)"
                                  : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                className="btn btn-ghost w-full"
                onClick={copyWeeklyText}
                disabled={!activeWeekProductionId || copyBusy}
              >
                {copyBusy ? "복사 중…" : "주간 일정 텍스트 복사 (전달용)"}
              </button>
            </>
          ))}
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
        <div className="mb-3 flex items-end justify-between gap-2">
          <h2 className="font-display text-xl">연습 일정</h2>
          <Link
            href="/availability"
            className="text-sm font-semibold text-[var(--accent)]"
          >
            가능일 입력
          </Link>
        </div>

        <div className="mb-3 flex gap-2">
          <button
            type="button"
            className={`min-h-10 flex-1 rounded-xl border text-sm font-semibold ${
              scheduleFilter === "all"
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[var(--line)] bg-[var(--bg-elevated)]"
            }`}
            onClick={() => setScheduleFilter("all")}
          >
            전체 일정
          </button>
          <button
            type="button"
            className={`min-h-10 flex-1 rounded-xl border text-sm font-semibold ${
              scheduleFilter === "mine"
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[var(--line)] bg-[var(--bg-elevated)]"
            }`}
            onClick={() => setScheduleFilter("mine")}
          >
            내 일정만
          </button>
        </div>

        {upcoming.length === 0 ? (
          <div className="card-panel p-4 text-sm text-[var(--ink-muted)]">
            {scheduleFilter === "mine"
              ? "내가 참석하는 확정·제안 연습이 없습니다."
              : "확정·제안된 연습이 없습니다. 연습 일정에서 가능일을 잡아보세요."}
          </div>
        ) : (
          <ul className="space-y-2">{upcoming.map(renderCard)}</ul>
        )}

        <div className="mt-4">
          <button
            type="button"
            className="text-sm font-semibold text-[var(--accent)]"
            onClick={() => setShowPast((v) => !v)}
          >
            {showPast ? "지난 일정 접기" : `지난 일정 보기 (${past.length})`}
          </button>
          {showPast && (
            <ul className="mt-3 space-y-2">
              {past.length === 0 ? (
                <li className="card-panel p-4 text-sm text-[var(--ink-muted)]">
                  지난 일정이 없습니다.
                </li>
              ) : (
                past.map(renderCard)
              )}
            </ul>
          )}
        </div>
      </section>

      <Link href="/recommend" className="btn btn-secondary w-full">
        주간 연습 일정 잡기
      </Link>
    </div>
  );
}
