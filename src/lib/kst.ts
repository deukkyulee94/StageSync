/** 캘린더 날짜(YYYY-MM-DD)는 항상 KST 기준으로 취급한다. */

const KST = "Asia/Seoul";
const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** 절대시각 `now`를 KST 달력 날짜(YYYY-MM-DD)로 */
export function todayKst(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** YYYY-MM-DD에 n일 가감 (타임존 무관, 달력 산술) */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** 해당 KST 달력일의 요일 (0=일 … 6=토) */
export function weekdayIndexFromYmd(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

export function weekdayKoFromYmd(ymd: string): string {
  return WEEKDAY_KO[weekdayIndexFromYmd(ymd)];
}

/** 해당 KST 달력일이 속한 주의 월요일 */
export function startOfWeekMondayFromYmd(ymd: string): string {
  const dow = weekdayIndexFromYmd(ymd);
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDaysYmd(ymd, diff);
}

/** 오늘(KST)이 속한 주의 월요일 */
export function startOfWeekMondayKst(now = new Date()): string {
  return startOfWeekMondayFromYmd(todayKst(now));
}

export function weekDatesFromYmd(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysYmd(weekStart, i));
}

/** 오늘(KST) 이상(포함)이면 true */
export function isTodayOrFutureKst(ymd: string, now = new Date()): boolean {
  return ymd >= todayKst(now);
}
