"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import * as repo from "@/lib/data/repository";
import {
  buildAvailabilityMatrix,
  findExistingRehearsalsForScenes,
  formatDateShort,
  formatDateWithWeekday,
} from "@/lib/recommend";

function startOfWeek(d = new Date()): string {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return mon.toISOString().slice(0, 10);
}

/** 유저가 속한 장면 전부 선택. 없으면 첫 장면 1개 */
function defaultEnsembleIds(
  ensembles: { id: string; slots: { userId: string }[] }[],
  userId?: string,
): string[] {
  if (ensembles.length === 0) return [];
  if (userId) {
    const mine = ensembles
      .filter((e) => e.slots.some((s) => s.userId === userId))
      .map((e) => e.id);
    if (mine.length > 0) return mine;
  }
  return [ensembles[0].id];
}

function RecommendInner() {
  const searchParams = useSearchParams();
  const { data, user, setData } = useApp();
  const initialProd = searchParams.get("productionId") ?? "";

  const productions = user ? repo.getVisibleProductions(data, user) : [];
  const [productionId, setProductionId] = useState(
    initialProd || productions[0]?.id || "",
  );
  const [weekStart, setWeekStart] = useState(startOfWeek());
  const [selectedEnsembleIds, setSelectedEnsembleIds] = useState<string[]>(
    () => {
      const prodId = initialProd || productions[0]?.id || "";
      const list = data.castEnsembles.filter((e) => e.productionId === prodId);
      return defaultEnsembleIds(list, user?.id);
    },
  );
  const [requiresAdmin, setRequiresAdmin] = useState(false);

  const ensembles = useMemo(
    () => data.castEnsembles.filter((e) => e.productionId === productionId),
    [data.castEnsembles, productionId],
  );

  const activeEnsembleIds = useMemo(
    () =>
      selectedEnsembleIds.filter((id) => ensembles.some((e) => e.id === id)),
    [selectedEnsembleIds, ensembles],
  );

  const matrix = useMemo(() => {
    if (!productionId || activeEnsembleIds.length === 0) return null;
    return buildAvailabilityMatrix(
      data,
      productionId,
      activeEnsembleIds,
      weekStart,
    );
  }, [data, productionId, activeEnsembleIds, weekStart]);

  const existingRehearsals = useMemo(() => {
    if (!productionId || activeEnsembleIds.length === 0) return [];
    return findExistingRehearsalsForScenes(
      data,
      productionId,
      activeEnsembleIds,
    );
  }, [data, productionId, activeEnsembleIds]);

  const existingDates = useMemo(
    () => new Set(existingRehearsals.map((r) => r.date)),
    [existingRehearsals],
  );

  function toggleEnsemble(id: string) {
    setSelectedEnsembleIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }

  function confirmOnDate(date: string) {
    if (!user || activeEnsembleIds.length === 0) return;
    const selected = ensembles.filter((e) => activeEnsembleIds.includes(e.id));
    let next = data;
    for (const ensemble of selected) {
      next = repo.createRehearsal(next, {
        productionId,
        date,
        startTime: "19:00",
        endTime: "22:00",
        stationId: "",
        locationNote: ensemble.name,
        roleIds: ensemble.slots.map((s) => s.roleId),
        participantIds: [...new Set(ensemble.slots.map((s) => s.userId))],
        ensembleId: ensemble.id,
        requiresAdmin,
        adminConfirmed: true,
        status: "confirmed",
      });
    }
    setData(() => next);
    alert(
      `${formatDateWithWeekday(date)} 연습이 확정되었습니다. (${selected.length}개 장면)`,
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-3xl">연습 일정</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          장면을 고르면 인원별 가능일과 겹치는 날짜를 확인할 수 있습니다
        </p>
      </header>

      <div className="card-panel space-y-3 p-4">
        <div className="field">
          <label htmlFor="production">작품</label>
          <select
            id="production"
            value={productionId}
            onChange={(e) => {
              const nextProd = e.target.value;
              setProductionId(nextProd);
              const list = data.castEnsembles.filter(
                (ens) => ens.productionId === nextProd,
              );
              setSelectedEnsembleIds(defaultEnsembleIds(list, user.id));
            }}
          >
            {productions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">장면 (1개 이상)</p>
          {ensembles.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">
              등록된 장면이 없습니다.
            </p>
          ) : (
            <ul className="max-h-[22rem] space-y-2 overflow-y-auto overscroll-contain rounded-xl border border-[var(--line)] bg-white/40 p-2">
              {ensembles.map((e) => {
                const checked = selectedEnsembleIds.includes(e.id);
                return (
                  <li key={e.id}>
                    <label className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-white/80 px-3 py-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={checked}
                        onChange={() => toggleEnsemble(e.id)}
                      />
                      <span className="text-sm">
                        <span className="font-semibold">{e.name}</span>
                        <span className="mt-0.5 block text-xs text-[var(--ink-muted)]">
                          {e.slots.length}인
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="field">
          <label htmlFor="weekStart">주 시작일 (월요일)</label>
          <input
            id="weekStart"
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
          />
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--forest-soft)]/40 px-3 py-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={requiresAdmin}
            onChange={(e) => setRequiresAdmin(e.target.checked)}
          />
          <span className="text-sm">
            <span className="font-semibold">단장/연출 참석 필요</span>
            <span className="mt-0.5 block text-xs text-[var(--ink-muted)]">
              기본은 없이 연습합니다.
            </span>
          </span>
        </label>
      </div>

      {existingRehearsals.length > 0 && (
        <section className="card-panel space-y-3 border-[var(--accent)] p-4 page-enter">
          <div>
            <h2 className="font-display text-xl text-[var(--accent)]">
              이미 예정된 연습일정
            </h2>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              선택한 장면 참가자가 포함된 제안·확정 연습입니다
            </p>
          </div>
          <ul className="space-y-2">
            {existingRehearsals.map((r) => {
              const participants = repo
                .getRehearsalParticipantLabels(data, r)
                .join(" / ");
              return (
                <li
                  key={r.id}
                  className="rounded-xl border border-[var(--line)] bg-white/70 px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">
                      {formatDateWithWeekday(r.date)} · {r.startTime}–{r.endTime}
                    </p>
                    <span className="chip shrink-0">
                      {r.status === "proposed" ? "제안" : "확정"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--ink-muted)]">
                    {r.locationNote || "연습"}
                    {r.place?.trim() ? ` · ${r.place.trim()}` : ""}
                  </p>
                  {participants && (
                    <p className="mt-1 text-sm text-[var(--ink-muted)]">
                      {participants}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {matrix && matrix.people.length > 0 && (
        <section className="card-panel space-y-4 p-4 page-enter">
          <div>
            <h2 className="font-display text-xl">인원별 가능일</h2>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              선택한 장면 포함 인원 · O = 가능
            </p>
          </div>

          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[28rem] border-collapse text-center text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-[var(--bg-elevated)] px-2 py-2 text-left font-semibold text-[var(--ink-muted)]">
                    이름
                  </th>
                  {matrix.dates.map((date) => (
                    <th
                      key={date}
                      className="px-1.5 py-2 font-semibold text-[var(--ink-muted)] whitespace-nowrap"
                    >
                      {formatDateShort(date)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.people.map((person) => (
                  <tr
                    key={person.userId}
                    className="border-t border-[var(--line)]"
                  >
                    <td className="sticky left-0 z-10 bg-[var(--bg-elevated)] px-2 py-2.5 text-left font-semibold whitespace-nowrap">
                      {person.userName}
                    </td>
                    {matrix.dates.map((date) => (
                      <td key={date} className="px-1.5 py-2.5">
                        {person.days[date] ? (
                          <span className="font-semibold text-[var(--forest)]">
                            O
                          </span>
                        ) : (
                          <span className="text-[var(--ink-muted)]/40">·</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 border-t border-[var(--line)] pt-4">
            <h3 className="font-semibold">연습 가능일자</h3>
            {matrix.overlapDates.length === 0 ? (
              <p className="text-sm text-[var(--ink-muted)]">
                선택한 인원이 모두 가능한 날이 없습니다.
              </p>
            ) : (
              <ul className="space-y-2">
                {matrix.overlapDates.map((date) => {
                  const alreadyBooked = existingDates.has(date);
                  return (
                  <li
                    key={date}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white/70 px-3 py-3"
                  >
                    <div>
                      <p className="font-semibold">
                        {formatDateWithWeekday(date)}
                      </p>
                      {alreadyBooked && (
                        <p className="mt-0.5 text-xs font-semibold text-[var(--accent)]">
                          이미 예정된 연습일정이 있습니다
                        </p>
                      )}
                    </div>
                    {!alreadyBooked && (
                      <button
                        type="button"
                        className="btn btn-soft shrink-0 px-3 py-1.5 text-sm"
                        onClick={() => confirmOnDate(date)}
                      >
                        확정
                      </button>
                    )}
                  </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}

      {matrix && matrix.people.length === 0 && activeEnsembleIds.length > 0 && (
        <p className="card-panel p-4 text-sm text-[var(--ink-muted)]">
          선택한 장면에 배정된 배우가 없습니다.
        </p>
      )}
    </div>
  );
}

export default function RecommendPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-[var(--ink-muted)]">불러오는 중…</p>
      }
    >
      <RecommendInner />
    </Suspense>
  );
}
