"use client";

import { FormEvent, useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import * as repo from "@/lib/data/repository";
import { addDaysYmd, startOfWeekMondayKst } from "@/lib/kst";
import { validateTimeRange } from "@/lib/time";
import { DAY_INDEX, DAY_LABELS, type DayOfWeek } from "@/types";

const DAY_KO = ["월", "화", "수", "목", "금", "토", "일"];

export default function AvailabilityPage() {
  const { data, user, setData } = useApp();
  const [weekStart, setWeekStart] = useState(() => startOfWeekMondayKst());
  const [productionId, setProductionId] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => startOfWeekMondayKst());
  const [startTime, setStartTime] = useState("19:00");
  const [endTime, setEndTime] = useState("22:00");
  const [note, setNote] = useState("");
  const [patternDays, setPatternDays] = useState<DayOfWeek[]>(["tue", "thu"]);
  const [timeError, setTimeError] = useState("");
  const [patternError, setPatternError] = useState("");
  const [mode, setMode] = useState<"day" | "pattern">("day");

  const productions = user ? repo.getVisibleProductions(data, user) : [];
  const activeProductionId = productionId || productions[0]?.id || "";

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysYmd(weekStart, i)),
    [weekStart],
  );

  const mySlots = user
    ? data.availabilities.filter(
        (a) => a.userId === user.id && a.productionId === activeProductionId,
      )
    : [];

  const myPatterns = user
    ? data.availabilityPatterns.filter(
        (p) => p.userId === user.id && p.productionId === activeProductionId,
      )
    : [];

  if (!user) return null;

  function onSaveDay(e: FormEvent) {
    e.preventDefault();
    if (!activeProductionId) return;
    const err = validateTimeRange(startTime, endTime);
    if (err) {
      setTimeError(err);
      return;
    }
    setTimeError("");
    try {
      setData((prev) =>
        repo.upsertAvailability(prev, {
          userId: user!.id,
          productionId: activeProductionId,
          date: selectedDate,
          startTime,
          endTime,
          note: note || undefined,
        }),
      );
    } catch (saveErr) {
      setTimeError(
        saveErr instanceof Error ? saveErr.message : "저장에 실패했습니다.",
      );
    }
  }

  function onSavePattern(e: FormEvent) {
    e.preventDefault();
    setPatternError("");
    setTimeError("");
    if (!activeProductionId) return;
    const err = validateTimeRange(startTime, endTime);
    if (err) {
      setTimeError(err);
      return;
    }
    try {
      setData((prev) => {
        const withPattern = repo.upsertAvailabilityPattern(prev, {
          userId: user!.id,
          productionId: activeProductionId,
          days: patternDays,
          startTime,
          endTime,
          note: note || undefined,
          fromDate: weekStart,
          toDate: null,
          active: true,
        });
        return repo.expandPatternsToWeek(
          withPattern,
          user!.id,
          activeProductionId,
          weekStart,
        );
      });
    } catch (err) {
      setPatternError(err instanceof Error ? err.message : "저장 실패");
    }
  }

  function applyPatternsToWeek() {
    if (!activeProductionId) return;
    setData((prev) =>
      repo.expandPatternsToWeek(
        prev,
        user!.id,
        activeProductionId,
        weekStart,
      ),
    );
  }

  function removeSlot(id: string) {
    setData((prev) => repo.removeAvailability(prev, id));
  }

  function removePattern(id: string) {
    setData((prev) => repo.removeAvailabilityPattern(prev, id));
  }

  function togglePatternDay(day: DayOfWeek) {
    setPatternDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-3xl">연습 가능일</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          날짜별 입력 또는 매주 반복 패턴
        </p>
      </header>

      <div className="field">
        <label htmlFor="prod">작품</label>
        <select
          id="prod"
          value={activeProductionId}
          onChange={(e) => setProductionId(e.target.value)}
        >
          {productions.length === 0 && (
            <option value="">소속 작품 없음</option>
          )}
          {productions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-1 rounded-xl border border-[var(--line)] surface-soft p-1">
        {(
          [
            ["day", "날짜별"],
            ["pattern", "반복 패턴"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
              mode === key
                ? "bg-[var(--forest)] text-[var(--on-forest)]"
                : "text-[var(--ink-muted)]"
            }`}
            onClick={() => setMode(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "day" && (
        <>
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setWeekStart(addDaysYmd(weekStart, -7))}
            >
              ← 지난주
            </button>
            <p className="text-sm font-semibold">{weekStart} ~</p>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setWeekStart(addDaysYmd(weekStart, 7))}
            >
              다음주 →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {weekDates.map((date, i) => {
              const has = mySlots.some((s) => s.date === date);
              const selected = selectedDate === date;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  className={`rounded-xl border px-1 py-2 text-center transition-colors ${
                    selected
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--line)] surface-soft"
                  }`}
                >
                  <span className="block text-[0.65rem] text-[var(--ink-muted)]">
                    {DAY_KO[i]}
                  </span>
                  <span className="block text-sm font-semibold">
                    {date.slice(8)}
                  </span>
                  {has && (
                    <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--forest)]" />
                  )}
                </button>
              );
            })}
          </div>

          <form onSubmit={onSaveDay} className="card-panel space-y-3 p-4">
            <p className="font-semibold">{selectedDate} 가능 시간</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label htmlFor="start">시작</label>
                <input
                  id="start"
                  type="time"
                  value={startTime}
                  max={endTime || undefined}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    setTimeError("");
                  }}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="end">종료</label>
                <input
                  id="end"
                  type="time"
                  value={endTime}
                  min={startTime || undefined}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    setTimeError("");
                  }}
                  required
                />
              </div>
            </div>
            {timeError && (
              <p className="text-sm font-medium text-[var(--danger)]">
                {timeError}
              </p>
            )}
            <div className="field">
              <label htmlFor="note">메모 (선택)</label>
              <input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="야근 가능, 늦참 등"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={!activeProductionId}
            >
              저장
            </button>
          </form>
        </>
      )}

      {mode === "pattern" && (
        <form onSubmit={onSavePattern} className="card-panel space-y-3 p-4">
          <p className="font-semibold">매주 반복 가능 요일</p>
          <div className="flex flex-wrap gap-1.5">
            {DAY_INDEX.map((day) => {
              const on = patternDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  className={`min-h-10 min-w-10 rounded-xl border px-3 text-sm font-semibold ${
                    on
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "border-[var(--line)] bg-[var(--bg-elevated)]"
                  }`}
                  onClick={() => togglePatternDay(day)}
                >
                  {DAY_LABELS[day]}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label htmlFor="pattern-start">시작</label>
              <input
                id="pattern-start"
                type="time"
                value={startTime}
                max={endTime || undefined}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  setTimeError("");
                }}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="pattern-end">종료</label>
              <input
                id="pattern-end"
                type="time"
                value={endTime}
                min={startTime || undefined}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  setTimeError("");
                }}
                required
              />
            </div>
          </div>
          {timeError && (
            <p className="text-sm font-medium text-[var(--danger)]">
              {timeError}
            </p>
          )}
          <div className="field">
            <label>메모</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="예: 화·목 고정"
            />
          </div>
          {patternError && (
            <p className="text-sm text-[var(--danger)]">{patternError}</p>
          )}
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={!activeProductionId}
          >
            패턴 저장 + 이번 주 반영
          </button>
          <button
            type="button"
            className="btn btn-ghost w-full"
            onClick={applyPatternsToWeek}
            disabled={!activeProductionId || myPatterns.length === 0}
          >
            기존 패턴을 이번 주에 다시 펼치기
          </button>
        </form>
      )}

      <section>
        <h2 className="mb-2 font-display text-xl">내 반복 패턴</h2>
        <ul className="space-y-2">
          {myPatterns.map((p) => (
            <li
              key={p.id}
              className="card-panel flex items-center justify-between p-3"
            >
              <div>
                <p className="font-semibold">
                  매주 {p.days.map((d) => DAY_LABELS[d]).join("·")}{" "}
                  {p.startTime}–{p.endTime}
                </p>
                {p.note && (
                  <p className="text-xs text-[var(--ink-muted)]">{p.note}</p>
                )}
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-[var(--danger)]"
                onClick={() => removePattern(p.id)}
              >
                삭제
              </button>
            </li>
          ))}
          {myPatterns.length === 0 && (
            <li className="text-sm text-[var(--ink-muted)]">
              등록된 반복 패턴이 없습니다.
            </li>
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-display text-xl">이번 주 입력</h2>
        <ul className="space-y-2">
          {mySlots
            .filter((s) => weekDates.includes(s.date))
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((s) => (
              <li
                key={s.id}
                className="card-panel flex items-center justify-between p-3"
              >
                <div>
                  <p className="font-semibold">
                    {s.date} {s.startTime}–{s.endTime}
                    {s.patternId && (
                      <span className="chip ml-2">반복</span>
                    )}
                  </p>
                  {s.note && (
                    <p className="text-xs text-[var(--ink-muted)]">{s.note}</p>
                  )}
                </div>
                <button
                  type="button"
                  className="text-sm font-semibold text-[var(--danger)]"
                  onClick={() => removeSlot(s.id)}
                >
                  삭제
                </button>
              </li>
            ))}
          {mySlots.filter((s) => weekDates.includes(s.date)).length === 0 && (
            <li className="text-sm text-[var(--ink-muted)]">
              아직 입력한 가능일이 없습니다.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
