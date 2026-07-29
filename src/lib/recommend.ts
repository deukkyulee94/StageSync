import type { AppData } from "@/types";

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 항상 `YYYY-MM-DD (요일)` 형식 */
export function formatDateWithWeekday(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${dateStr} (${WEEKDAY_KO[d.getDay()]})`;
}

/** 오늘 기준 어제(YYYY-MM-DD). 지난 연습은 1일 뒤까지 보이고, 그다음부터 숨김 */
export function rehearsalVisibleFromDate(now = new Date()): string {
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function isRehearsalListVisible(
  dateStr: string,
  now = new Date(),
): boolean {
  return dateStr >= rehearsalVisibleFromDate(now);
}

/** 선택한 장면 참가자가 포함된 제안/확정 연습 */
export function findExistingRehearsalsForScenes(
  data: AppData,
  productionId: string,
  ensembleIds: string[],
) {
  const selected = data.castEnsembles.filter(
    (e) => e.productionId === productionId && ensembleIds.includes(e.id),
  );
  const participantIds = new Set(
    selected.flatMap((e) => e.slots.map((s) => s.userId)),
  );
  const ensembleIdSet = new Set(ensembleIds);

  return data.rehearsals
    .filter((r) => {
      if (r.productionId !== productionId) return false;
      if (r.status !== "proposed" && r.status !== "confirmed") return false;
      if (!isRehearsalListVisible(r.date)) return false;
      if (r.ensembleId && ensembleIdSet.has(r.ensembleId)) return true;
      return (r.participantIds ?? []).some((id) => participantIds.has(id));
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

/** 표용 짧은 형식: `7/27(월)` */
export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_KO[d.getDay()]})`;
}

export function weekDatesFrom(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + "T12:00:00");
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
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
  /** 전원 O인 날짜 */
  overlapDates: string[];
}

/** 선택한 장면들의 본캐 인원 가용성 표 + 겹치는 날짜 */
export function buildAvailabilityMatrix(
  data: AppData,
  productionId: string,
  ensembleIds: string[],
  weekStart: string,
): AvailabilityMatrix {
  const dates = weekDatesFrom(weekStart);
  const selected = data.castEnsembles.filter(
    (e) => e.productionId === productionId && ensembleIds.includes(e.id),
  );

  const userIds: string[] = [];
  const seen = new Set<string>();
  for (const ensemble of selected) {
    for (const slot of ensemble.slots) {
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
      : dates.filter((date) => people.every((p) => p.days[date]));

  return { dates, people, overlapDates };
}
