"use client";

import { Suspense, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import * as repo from "@/lib/data/repository";
import {
  applySlotSubstitutions,
  combinedLocationNote,
  hasSlotSubstitutions,
  listSubstituteOptionsForSlot,
} from "@/lib/ensemble";
import {
  buildAvailabilityMatrix,
  findConfirmConflicts,
  findExistingRehearsalsForScenes,
  findMissingAvailabilityUsers,
  findProductionRehearsals,
  findRehearsalsOnDate,
  formatDateShort,
  formatDateWithWeekday,
  weekDatesFrom,
  type EnsembleSlotOverrides,
} from "@/lib/recommend";
import {
  startOfWeekMondayFromYmd,
  startOfWeekMondayKst,
  todayKst,
} from "@/lib/kst";
import { validateTimeRange } from "@/lib/time";

/** ensembleId → (roleId → substituteUserId) */
type EnsembleSubstitutions = Record<string, Record<string, string>>;

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
  const [weekStart, setWeekStart] = useState(() => startOfWeekMondayKst());
  const [selectedEnsembleIds, setSelectedEnsembleIds] = useState<string[]>(
    () => {
      const prodId = initialProd || productions[0]?.id || "";
      const list = data.castEnsembles.filter((e) => e.productionId === prodId);
      return defaultEnsembleIds(list, user?.id);
    },
  );
  const [requiresAdmin, setRequiresAdmin] = useState(false);
  const [confirmDate, setConfirmDate] = useState<string | null>(null);
  const [confirmStart, setConfirmStart] = useState("19:00");
  const [confirmEnd, setConfirmEnd] = useState("22:00");
  const [confirmPlace, setConfirmPlace] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [substitutions, setSubstitutions] = useState<EnsembleSubstitutions>({});
  const [showSubstitutePanel, setShowSubstitutePanel] = useState(false);

  const ensembles = useMemo(
    () => data.castEnsembles.filter((e) => e.productionId === productionId),
    [data.castEnsembles, productionId],
  );

  const activeEnsembleIds = useMemo(
    () =>
      selectedEnsembleIds.filter((id) => ensembles.some((e) => e.id === id)),
    [selectedEnsembleIds, ensembles],
  );

  const activeEnsembles = useMemo(
    () => ensembles.filter((e) => activeEnsembleIds.includes(e.id)),
    [ensembles, activeEnsembleIds],
  );

  const slotOverrides = useMemo((): EnsembleSlotOverrides => {
    const overrides: EnsembleSlotOverrides = {};
    for (const ensemble of activeEnsembles) {
      const subs = substitutions[ensemble.id];
      if (!hasSlotSubstitutions(subs)) continue;
      overrides[ensemble.id] = applySlotSubstitutions(ensemble, subs);
    }
    return overrides;
  }, [activeEnsembles, substitutions]);

  const hasAnySubstitution = useMemo(
    () =>
      activeEnsembleIds.some((id) =>
        hasSlotSubstitutions(substitutions[id]),
      ),
    [activeEnsembleIds, substitutions],
  );

  const matrix = useMemo(() => {
    if (!productionId || activeEnsembleIds.length === 0) return null;
    return buildAvailabilityMatrix(
      data,
      productionId,
      activeEnsembleIds,
      weekStart,
      undefined,
      slotOverrides,
    );
  }, [data, productionId, activeEnsembleIds, weekStart, slotOverrides]);

  const missingUsers = useMemo(() => {
    if (!productionId || activeEnsembleIds.length === 0) return [];
    return findMissingAvailabilityUsers(
      data,
      productionId,
      activeEnsembleIds,
      weekStart,
      undefined,
      slotOverrides,
    );
  }, [data, productionId, activeEnsembleIds, weekStart, slotOverrides]);

  const existingRehearsals = useMemo(() => {
    if (!productionId || activeEnsembleIds.length === 0) return [];
    return findExistingRehearsalsForScenes(
      data,
      productionId,
      activeEnsembleIds,
      slotOverrides,
    );
  }, [data, productionId, activeEnsembleIds, slotOverrides]);

  const existingDates = useMemo(
    () => new Set(existingRehearsals.map((r) => r.date)),
    [existingRehearsals],
  );

  const weekRehearsals = useMemo(() => {
    if (!productionId) return [];
    const today = todayKst();
    const weekDates = new Set(
      weekDatesFrom(weekStart).filter((d) => d >= today),
    );
    return findProductionRehearsals(data, productionId).filter((r) =>
      weekDates.has(r.date),
    );
  }, [data, productionId, weekStart]);

  function clearSubstitutions() {
    setSubstitutions({});
  }

  function toggleEnsemble(id: string) {
    setSelectedEnsembleIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
    setSubstitutions((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function setRoleSubstitute(
    ensembleId: string,
    roleId: string,
    substituteUserId: string | null,
  ) {
    setSubstitutions((prev) => {
      const current = { ...(prev[ensembleId] ?? {}) };
      if (!substituteUserId) {
        delete current[roleId];
      } else {
        current[roleId] = substituteUserId;
      }
      const next = { ...prev };
      if (Object.keys(current).length === 0) {
        delete next[ensembleId];
      } else {
        next[ensembleId] = current;
      }
      return next;
    });
  }

  function clearEnsembleSubstitutions(ensembleId: string) {
    setSubstitutions((prev) => {
      if (!(ensembleId in prev)) return prev;
      const next = { ...prev };
      delete next[ensembleId];
      return next;
    });
  }

  function openConfirm(date: string) {
    setConfirmDate(date);
    setConfirmStart("19:00");
    setConfirmEnd("22:00");
    setConfirmPlace("");
    setConfirmError("");
  }

  function closeConfirm() {
    setConfirmDate(null);
    setConfirmError("");
  }

  function submitConfirm() {
    if (!user || !confirmDate || activeEnsembleIds.length === 0) return;

    const timeErr = validateTimeRange(confirmStart, confirmEnd);
    if (timeErr) {
      setConfirmError(timeErr);
      return;
    }

    const selected = activeEnsembles;
    const participantIds = [
      ...new Set(
        selected.flatMap((e) =>
          applySlotSubstitutions(e, substitutions[e.id] ?? {}).map(
            (s) => s.userId,
          ),
        ),
      ),
    ];

    const conflicts = findConfirmConflicts(data, {
      productionId,
      date: confirmDate,
      startTime: confirmStart,
      endTime: confirmEnd,
      participantIds,
    });

    if (conflicts.length > 0) {
      const detail = conflicts.map((c) => `· ${c.message}`).join("\n");
      const ok = confirm(
        `충돌 가능성이 있습니다.\n\n${detail}\n\n그래도 확정할까요?`,
      );
      if (!ok) return;
    }

    let next = data;
    const allSlots = selected.flatMap((ensemble) =>
      applySlotSubstitutions(ensemble, substitutions[ensemble.id] ?? {}),
    );
    const participantRoles: Record<string, string> = {};
    for (const slot of allSlots) {
      if (participantRoles[slot.userId] === undefined) {
        participantRoles[slot.userId] = slot.roleId;
      }
    }
    const ensembleIds = selected.map((e) => e.id);
    next = repo.createRehearsal(next, {
      productionId,
      date: confirmDate,
      startTime: confirmStart,
      endTime: confirmEnd,
      stationId: "",
      locationNote: combinedLocationNote(
        selected.map((ensemble) => ({
          name: ensemble.name,
          hasSubstitute: hasSlotSubstitutions(substitutions[ensemble.id]),
        })),
      ),
      place: confirmPlace.trim(),
      roleIds: [...new Set(allSlots.map((s) => s.roleId))],
      participantIds: [...new Set(allSlots.map((s) => s.userId))],
      participantRoles,
      participantSlots: allSlots,
      ensembleId: ensembleIds[0] ?? null,
      ensembleIds,
      requiresAdmin,
      adminConfirmed: true,
      status: "confirmed",
    });
    setData(() => next);
    closeConfirm();
    clearSubstitutions();
    setShowSubstitutePanel(false);
    alert(
      `${formatDateWithWeekday(confirmDate)} ${confirmStart}–${confirmEnd} 연습이 확정되었습니다.${
        selected.length > 1 ? ` (${selected.length}개 장면)` : ""
      }`,
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
              clearSubstitutions();
              setShowSubstitutePanel(false);
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
            <ul className="max-h-[22rem] space-y-2 overflow-y-auto overscroll-contain rounded-xl border border-[var(--line)] surface-soft p-2">
              {ensembles.map((e) => {
                const checked = selectedEnsembleIds.includes(e.id);
                return (
                  <li key={e.id}>
                    <label className="flex items-start gap-3 rounded-xl border border-[var(--line)] surface-soft px-3 py-3">
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
                          {hasSlotSubstitutions(substitutions[e.id])
                            ? " · 대타 적용"
                            : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {missingUsers.length > 0 && (
          <div className="rounded-xl border border-[var(--gold)] bg-[var(--accent-soft)]/40 px-3 py-3">
            <p className="text-sm font-semibold text-[var(--accent)]">
              이번 주 가능일 미입력
            </p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              {missingUsers.map((u) => u.userName).join(", ")}
            </p>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              가능일을 입력해 달라고 독촉합시다.
            </p>
          </div>
        )}

        <div className="field">
          <label htmlFor="weekStart">주 시작일 (월요일)</label>
          <input
            id="weekStart"
            type="date"
            value={weekStart}
            onChange={(e) =>
              setWeekStart(startOfWeekMondayFromYmd(e.target.value))
            }
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

      {weekRehearsals.length > 0 && (
        <section className="card-panel space-y-3 border-[var(--accent)] p-4 page-enter">
          <div>
            <h2 className="font-display text-xl text-[var(--accent)]">
              이미 예정된 연습일정
            </h2>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              이번 주 이 작품에 잡힌 제안·확정 연습입니다 (다른 장면·인원 포함)
            </p>
          </div>
          <ul className="space-y-2">
            {weekRehearsals.map((r) => {
              const participants = repo
                .getRehearsalParticipantLabels(data, r)
                .join(" / ");
              return (
                <li
                  key={r.id}
                  className="rounded-xl border border-[var(--line)] surface-soft px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">
                      {formatDateWithWeekday(r.date)} · {r.startTime}–
                      {r.endTime}
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
              선택한 장면 포함 인원
              {hasAnySubstitution ? " (대타 반영)" : ""} · O = 가능
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
              <div className="space-y-3">
                <p className="text-sm text-[var(--ink-muted)]">
                  선택한 인원이 모두 가능한 날이 없습니다.
                </p>
                <button
                  type="button"
                  className="btn btn-soft px-3 py-1.5 text-sm"
                  onClick={() => setShowSubstitutePanel((v) => !v)}
                >
                  {showSubstitutePanel ? "대타 접기" : "대타 조회"}
                </button>
              </div>
            ) : (
              <ul className="space-y-2">
                {matrix.overlapDates.map((date) => {
                  const bookedForSelected = existingDates.has(date);
                  const rehearsalsOnDate = findRehearsalsOnDate(
                    data,
                    productionId,
                    date,
                  );
                  return (
                    <li
                      key={date}
                      className="flex items-start justify-between gap-3 rounded-xl border border-[var(--line)] surface-soft px-3 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {formatDateWithWeekday(date)}
                        </p>
                        {rehearsalsOnDate.length > 0 && (
                          <ul className="mt-1.5 space-y-1">
                            {rehearsalsOnDate.map((r) => {
                              const participants = repo
                                .getRehearsalParticipantLabels(data, r)
                                .join(" / ");
                              return (
                                <li
                                  key={r.id}
                                  className="text-xs text-[var(--accent)]"
                                >
                                  <span className="font-semibold">
                                    이미 예정
                                    {r.status === "proposed" ? "(제안)" : ""}
                                    :{" "}
                                  </span>
                                  {r.locationNote || "연습"}
                                  {` · ${r.startTime}–${r.endTime}`}
                                  {participants ? ` · ${participants}` : ""}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                      {!bookedForSelected && (
                        <button
                          type="button"
                          className="btn btn-soft shrink-0 px-3 py-1.5 text-sm"
                          onClick={() => openConfirm(date)}
                        >
                          확정
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {hasAnySubstitution && (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs text-[var(--accent)]">
                  대타가 적용되어 가능일을 다시 조회했습니다.
                </p>
                {matrix.overlapDates.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost px-3 py-1.5 text-sm"
                    onClick={() => setShowSubstitutePanel((v) => !v)}
                  >
                    {showSubstitutePanel ? "대타 접기" : "대타 조정"}
                  </button>
                )}
              </div>
            )}
          </div>

          {showSubstitutePanel && (
            <div className="space-y-4 border-t border-[var(--line)] pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">대타 조회</h3>
                  <p className="mt-1 text-xs text-[var(--ink-muted)]">
                    배역별로 대타를 고르면 본캐 대신 가능일을 다시 조회합니다.
                    장면 원본 배정은 바뀌지 않습니다.
                  </p>
                </div>
                {hasAnySubstitution && (
                  <button
                    type="button"
                    className="btn btn-ghost shrink-0 px-3 py-1.5 text-sm"
                    onClick={clearSubstitutions}
                  >
                    전체 대타 해제
                  </button>
                )}
              </div>

              <ul className="space-y-3">
                {activeEnsembles.map((ensemble) => {
                  const ensembleSubs = substitutions[ensemble.id] ?? {};
                  const effectiveSlots = applySlotSubstitutions(
                    ensemble,
                    ensembleSubs,
                  );
                  return (
                    <li
                      key={ensemble.id}
                      className="space-y-2 rounded-xl border border-[var(--line)] surface-soft p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">{ensemble.name}</p>
                        {hasSlotSubstitutions(ensembleSubs) && (
                          <button
                            type="button"
                            className="text-xs font-semibold text-[var(--accent)]"
                            onClick={() =>
                              clearEnsembleSubstitutions(ensemble.id)
                            }
                          >
                            이 장면 대타 해제
                          </button>
                        )}
                      </div>
                      <ul className="space-y-2">
                        {ensemble.slots.map((slot) => {
                          const roleName =
                            data.roles.find((r) => r.id === slot.roleId)
                              ?.name ?? "배역";
                          const primaryName =
                            data.users.find((u) => u.id === slot.userId)
                              ?.name ?? "?";
                          const otherEffectiveIds = effectiveSlots
                            .filter((s) => s.roleId !== slot.roleId)
                            .map((s) => s.userId);
                          const options = listSubstituteOptionsForSlot(
                            data,
                            ensemble,
                            slot.roleId,
                            slot.userId,
                            otherEffectiveIds,
                          );
                          const selectedSub =
                            ensembleSubs[slot.roleId] ?? "";
                          return (
                            <li
                              key={`${ensemble.id}:${slot.roleId}`}
                              className="space-y-1.5 rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)]/60 px-3 py-2.5"
                            >
                              <p className="text-sm">
                                <span className="font-semibold">
                                  {roleName}
                                </span>
                                <span className="text-[var(--ink-muted)]">
                                  {" "}
                                  · 본캐 {primaryName}
                                </span>
                              </p>
                              {options.length === 0 ? (
                                <p className="text-xs text-[var(--ink-muted)]">
                                  후보 없음
                                </p>
                              ) : (
                                <div className="field !mb-0">
                                  <label
                                    htmlFor={`sub-${ensemble.id}-${slot.roleId}`}
                                  >
                                    대타 선택
                                  </label>
                                  <select
                                    id={`sub-${ensemble.id}-${slot.roleId}`}
                                    value={selectedSub}
                                    onChange={(e) =>
                                      setRoleSubstitute(
                                        ensemble.id,
                                        slot.roleId,
                                        e.target.value || null,
                                      )
                                    }
                                  >
                                    <option value="">
                                      기존 캐스팅 ({primaryName})
                                    </option>
                                    {options.map((opt) => {
                                      const name =
                                        data.users.find(
                                          (u) => u.id === opt.userId,
                                        )?.name ?? "?";
                                      const sourceLabel = "대타";
                                      return (
                                        <option
                                          key={opt.userId}
                                          value={opt.userId}
                                        >
                                          대타 ({name})
                                        </option>
                                      );
                                    })}
                                  </select>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      )}

      {matrix && matrix.people.length === 0 && activeEnsembleIds.length > 0 && (
        <p className="card-panel p-4 text-sm text-[var(--ink-muted)]">
          선택한 장면에 배정된 배우가 없습니다.
        </p>
      )}

      {confirmDate &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/40 p-4"
            style={{
              paddingBottom: "calc(1rem + var(--safe-bottom))",
            }}
          >
            <div
              className="card-panel my-auto w-full max-w-[min(28rem,100%)] space-y-4 p-5"
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
            >
              <div>
                <h2 id="confirm-title" className="font-display text-2xl">
                  연습 확정
                </h2>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">
                  {formatDateWithWeekday(confirmDate)}
                  {hasAnySubstitution ? " · 대타 포함" : ""}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label htmlFor="confirm-start">시작</label>
                  <input
                    id="confirm-start"
                    type="time"
                    value={confirmStart}
                    max={confirmEnd || undefined}
                    onChange={(e) => {
                      setConfirmStart(e.target.value);
                      setConfirmError("");
                    }}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="confirm-end">종료</label>
                  <input
                    id="confirm-end"
                    type="time"
                    value={confirmEnd}
                    min={confirmStart || undefined}
                    onChange={(e) => {
                      setConfirmEnd(e.target.value);
                      setConfirmError("");
                    }}
                    required
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="confirm-place">장소 (선택)</label>
                <input
                  id="confirm-place"
                  value={confirmPlace}
                  onChange={(e) => setConfirmPlace(e.target.value)}
                  placeholder="예: 홍대 연습실 A"
                />
              </div>
              {confirmError && (
                <p className="text-sm font-medium text-[var(--danger)]">
                  {confirmError}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="btn btn-ghost w-full"
                  onClick={closeConfirm}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="btn btn-primary w-full"
                  onClick={submitConfirm}
                >
                  확정
                </button>
              </div>
            </div>
          </div>,
          document.body,
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
