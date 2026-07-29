import type { AppData, Rehearsal } from "@/types";
import {
  addDaysYmd,
  isTodayOrFutureKst,
  todayKst,
  weekdayKoFromYmd,
  weekDatesFromYmd,
} from "@/lib/kst";
import { timesOverlap } from "@/lib/time";
import { rehearsalEnsembleIds } from "@/lib/ensemble";

/** 항상 `YYYY-MM-DD (요일)` 형식 — 요일은 KST 달력일 기준 */
export function formatDateWithWeekday(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  return `${dateStr} (${weekdayKoFromYmd(dateStr)})`;
}

/** 오늘(KST) 기준 어제(YYYY-MM-DD). 지난 연습은 1일 뒤까지 보이고, 그다음부터 숨김 */
export function rehearsalVisibleFromDate(now = new Date()): string {
  return addDaysYmd(todayKst(now), -1);
}

export function isRehearsalListVisible(
  dateStr: string,
  now = new Date(),
): boolean {
  return dateStr >= rehearsalVisibleFromDate(now);
}

/** 다가오는(목록) 연습: 제안/확정 + 날짜 가시 범위 */
export function isUpcomingRehearsal(r: Rehearsal, now = new Date()): boolean {
  if (r.status !== "proposed" && r.status !== "confirmed") return false;
  return isRehearsalListVisible(r.date, now);
}

/** 지난 연습: 완료이거나, 제안/확정이지만 목록 가시 범위보다 이전 */
export function isPastRehearsal(r: Rehearsal, now = new Date()): boolean {
  if (r.status === "cancelled") return false;
  if (r.status === "done") return true;
  if (r.status !== "proposed" && r.status !== "confirmed") return false;
  return !isRehearsalListVisible(r.date, now);
}

export function sortRehearsalsAsc(a: Rehearsal, b: Rehearsal): number {
  return (
    a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
  );
}

export function sortRehearsalsDesc(a: Rehearsal, b: Rehearsal): number {
  return (
    b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime)
  );
}

export function isUserInRehearsal(r: Rehearsal, userId: string): boolean {
  return (r.participantIds ?? []).includes(userId);
}

/** 홈용: 가장 가까운 다음 연습 1건 */
export function getNextRehearsal(
  data: AppData,
  opts?: { userId?: string; mineOnly?: boolean },
  now = new Date(),
): Rehearsal | null {
  const today = todayKst(now);
  const list = data.rehearsals
    .filter((r) => {
      if (!isUpcomingRehearsal(r, now)) return false;
      if (r.date < today) return false;
      if (opts?.mineOnly && opts.userId) {
        return isUserInRehearsal(r, opts.userId);
      }
      return true;
    })
    .sort(sortRehearsalsAsc);
  return list[0] ?? null;
}

/** ensembleId → 임시 슬롯 (대타 적용 등). 없으면 원본 슬롯 사용 */
export type EnsembleSlotOverrides = Record<
  string,
  { roleId: string; userId: string }[]
>;

function resolveEnsembleSlots(
  ensemble: { id: string; slots: { roleId: string; userId: string }[] },
  slotOverrides?: EnsembleSlotOverrides,
) {
  return slotOverrides?.[ensemble.id] ?? ensemble.slots;
}

/** 선택한 장면 참가자가 포함된 제안/확정 연습 */
export function findExistingRehearsalsForScenes(
  data: AppData,
  productionId: string,
  ensembleIds: string[],
  slotOverrides?: EnsembleSlotOverrides,
) {
  const selected = data.castEnsembles.filter(
    (e) => e.productionId === productionId && ensembleIds.includes(e.id),
  );
  const participantIds = new Set(
    selected.flatMap((e) =>
      resolveEnsembleSlots(e, slotOverrides).map((s) => s.userId),
    ),
  );
  const ensembleIdSet = new Set(ensembleIds);

  return data.rehearsals
    .filter((r) => {
      if (r.productionId !== productionId) return false;
      if (r.status !== "proposed" && r.status !== "confirmed") return false;
      if (!isRehearsalListVisible(r.date)) return false;
      if (rehearsalEnsembleIds(r).some((id) => ensembleIdSet.has(id))) {
        return true;
      }
      return (r.participantIds ?? []).some((id) => participantIds.has(id));
    })
    .sort(sortRehearsalsAsc);
}

/** 작품의 제안/확정 연습 전체 (날짜·시간순) */
export function findProductionRehearsals(data: AppData, productionId: string) {
  return data.rehearsals
    .filter((r) => {
      if (r.productionId !== productionId) return false;
      if (r.status !== "proposed" && r.status !== "confirmed") return false;
      return isRehearsalListVisible(r.date);
    })
    .sort(sortRehearsalsAsc);
}

/** 특정 날짜에 이미 잡힌 작품 연습 */
export function findRehearsalsOnDate(
  data: AppData,
  productionId: string,
  date: string,
) {
  return findProductionRehearsals(data, productionId).filter(
    (r) => r.date === date,
  );
}

export interface ConfirmConflict {
  kind: "time_overlap" | "double_book";
  message: string;
  rehearsal: Rehearsal;
}

/** 확정 직전 충돌: 시간 겹침 + 동일 인원 이중 배정 */
export function findConfirmConflicts(
  data: AppData,
  input: {
    productionId: string;
    date: string;
    startTime: string;
    endTime: string;
    participantIds: string[];
  },
): ConfirmConflict[] {
  const conflicts: ConfirmConflict[] = [];
  const participants = new Set(input.participantIds);
  const existing = data.rehearsals.filter(
    (r) =>
      r.productionId === input.productionId &&
      r.date === input.date &&
      (r.status === "proposed" || r.status === "confirmed"),
  );

  for (const r of existing) {
    const overlap = timesOverlap(
      input.startTime,
      input.endTime,
      r.startTime,
      r.endTime,
    );
    const shared = (r.participantIds ?? []).filter((id) =>
      participants.has(id),
    );
    if (shared.length > 0 && overlap) {
      const names = shared
        .map((id) => data.users.find((u) => u.id === id)?.name ?? "?")
        .join(", ");
      conflicts.push({
        kind: "double_book",
        message: `${names}님이 같은 시간대(${r.startTime}–${r.endTime})에 이미 배정됨 · ${r.locationNote || "연습"}`,
        rehearsal: r,
      });
    } else if (overlap) {
      conflicts.push({
        kind: "time_overlap",
        message: `같은 날 ${r.startTime}–${r.endTime}에 다른 연습이 있음 · ${r.locationNote || "연습"}`,
        rehearsal: r,
      });
    } else if (shared.length > 0) {
      const names = shared
        .map((id) => data.users.find((u) => u.id === id)?.name ?? "?")
        .join(", ");
      conflicts.push({
        kind: "double_book",
        message: `${names}님이 같은 날 다른 시간(${r.startTime}–${r.endTime})에 이미 배정됨 · ${r.locationNote || "연습"}`,
        rehearsal: r,
      });
    }
  }

  return conflicts;
}

/** 선택한 장면 인원 중, 이번 주에 가능일을 하나도 안 넣은 사람 */
export function findMissingAvailabilityUsers(
  data: AppData,
  productionId: string,
  ensembleIds: string[],
  weekStart: string,
  now = new Date(),
  slotOverrides?: EnsembleSlotOverrides,
): { userId: string; userName: string }[] {
  const today = todayKst(now);
  const dates = weekDatesFrom(weekStart).filter((d) => d >= today);
  const selected = data.castEnsembles.filter(
    (e) => e.productionId === productionId && ensembleIds.includes(e.id),
  );
  const userIds: string[] = [];
  const seen = new Set<string>();
  for (const ensemble of selected) {
    for (const slot of resolveEnsembleSlots(ensemble, slotOverrides)) {
      if (seen.has(slot.userId)) continue;
      seen.add(slot.userId);
      userIds.push(slot.userId);
    }
  }

  return userIds
    .filter((userId) => {
      return !dates.some((date) =>
        data.availabilities.some(
          (a) =>
            a.productionId === productionId &&
            a.userId === userId &&
            a.date === date,
        ),
      );
    })
    .map((userId) => ({
      userId,
      userName: data.users.find((u) => u.id === userId)?.name ?? "?",
    }));
}

/** 표용 짧은 형식: `7/27(월)` — KST 달력일 기준 */
export function formatDateShort(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [, m, d] = dateStr.split("-");
  return `${Number(m)}/${Number(d)}(${weekdayKoFromYmd(dateStr)})`;
}

export function weekDatesFrom(weekStart: string): string[] {
  return weekDatesFromYmd(weekStart);
}

export interface AvailabilityMatrixPerson {
  userId: string;
  userName: string;
  /** date -> available */
  days: Record<string, boolean>;
}

export interface AvailabilityMatrix {
  dates: string[];
  people: AvailabilityMatrixPerson[];
  /** 전원 O인 날짜 (오늘 KST 이상만) */
  overlapDates: string[];
}

/** 선택한 장면들의 본캐(또는 대타) 인원 가용성 표 + 겹치는 날짜 */
export function buildAvailabilityMatrix(
  data: AppData,
  productionId: string,
  ensembleIds: string[],
  weekStart: string,
  now = new Date(),
  slotOverrides?: EnsembleSlotOverrides,
): AvailabilityMatrix {
  const today = todayKst(now);
  const dates = weekDatesFrom(weekStart).filter((date) => date >= today);
  const selected = data.castEnsembles.filter(
    (e) => e.productionId === productionId && ensembleIds.includes(e.id),
  );

  const userIds: string[] = [];
  const seen = new Set<string>();
  for (const ensemble of selected) {
    for (const slot of resolveEnsembleSlots(ensemble, slotOverrides)) {
      if (seen.has(slot.userId)) continue;
      seen.add(slot.userId);
      userIds.push(slot.userId);
    }
  }

  const people: AvailabilityMatrixPerson[] = userIds.map((userId) => {
    const userName = data.users.find((u) => u.id === userId)?.name ?? "?";
    const days: Record<string, boolean> = {};
    for (const date of dates) {
      days[date] = data.availabilities.some(
        (a) =>
          a.productionId === productionId &&
          a.userId === userId &&
          a.date === date,
      );
    }
    return { userId, userName, days };
  });

  const overlapDates =
    people.length === 0
      ? []
      : dates.filter(
          (date) =>
            isTodayOrFutureKst(date, now) && people.every((p) => p.days[date]),
        );

  return { dates, people, overlapDates };
}

export interface WeekCalendarDay {
  date: string;
  availableCount: number;
  totalPeople: number;
  allAvailable: boolean;
  rehearsals: Rehearsal[];
}

/** 작품 전체 장면 기준으로 주간 캘린더 (홈용) */
export function buildWeekCalendarForProduction(
  data: AppData,
  productionId: string,
  weekStart: string,
  now = new Date(),
): WeekCalendarDay[] {
  const ensembleIds = data.castEnsembles
    .filter((e) => e.productionId === productionId)
    .map((e) => e.id);
  return buildWeekCalendar(data, productionId, ensembleIds, weekStart, now);
}

/** 주간 캘린더: 가능 인원 수 + 확정/제안 연습 겹쳐 보기 */
export function buildWeekCalendar(
  data: AppData,
  productionId: string,
  ensembleIds: string[],
  weekStart: string,
  now = new Date(),
): WeekCalendarDay[] {
  const matrix = buildAvailabilityMatrix(
    data,
    productionId,
    ensembleIds,
    weekStart,
    now,
  );
  const today = todayKst(now);
  const allWeek = weekDatesFrom(weekStart).filter((d) => d >= today);
  const dates = allWeek.length > 0 ? allWeek : weekDatesFrom(weekStart);

  return dates.map((date) => {
    const availableCount = matrix.people.filter((p) => p.days[date]).length;
    const totalPeople = matrix.people.length;
    const rehearsals = data.rehearsals
      .filter(
        (r) =>
          r.productionId === productionId &&
          r.date === date &&
          (r.status === "proposed" ||
            r.status === "confirmed" ||
            r.status === "done"),
      )
      .sort(sortRehearsalsAsc);
    return {
      date,
      availableCount,
      totalPeople,
      allAvailable: totalPeople > 0 && availableCount === totalPeople,
      rehearsals,
    };
  });
}

/** 단톡 복붙용 주간 일정 텍스트 */
export function buildWeeklyScheduleText(
  data: AppData,
  productionId: string,
  weekStart: string,
): string {
  const production = data.productions.find((p) => p.id === productionId);
  const weekEnd = addDaysYmd(weekStart, 6);
  const dates = weekDatesFrom(weekStart);
  const rehearsals = data.rehearsals
    .filter(
      (r) =>
        r.productionId === productionId &&
        dates.includes(r.date) &&
        (r.status === "proposed" ||
          r.status === "confirmed" ||
          r.status === "done"),
    )
    .sort(sortRehearsalsAsc);

  const lines = [
    `[Stage Sync 주간 일정]`,
    `작품: ${production?.title ?? "-"}`,
    `기간: ${formatDateWithWeekday(weekStart)} ~ ${formatDateWithWeekday(weekEnd)}`,
    "",
  ];

  if (rehearsals.length === 0) {
    lines.push("이번 주 등록된 연습이 없습니다.");
  } else {
    for (const r of rehearsals) {
      const participants = (r.participantIds ?? [])
        .map((id) => data.users.find((u) => u.id === id)?.name ?? "?")
        .join(", ");
      const status =
        r.status === "proposed"
          ? "제안"
          : r.status === "confirmed"
            ? "확정"
            : r.status === "done"
              ? "완료"
              : r.status;
      lines.push(
        `• ${formatDateWithWeekday(r.date)} ${r.startTime}–${r.endTime} [${status}]`,
      );
      lines.push(`  ${r.locationNote || "연습"}`);
      if (r.place?.trim()) lines.push(`  장소: ${r.place.trim()}`);
      if (participants) lines.push(`  참가자: ${participants}`);
      if (r.completionNote?.trim()) {
        lines.push(`  완료메모: ${r.completionNote.trim()}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n").trimEnd();
}
