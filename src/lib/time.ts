/** `HH:mm` → 분. 잘못된 형식이면 null */
export function timeToMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** 시작 < 종료인지 검사. 통과하면 null, 실패하면 메시지 */
export function validateTimeRange(
  startTime: string,
  endTime: string,
): string | null {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start == null || end == null) {
    return "시작·종료 시간을 올바르게 입력해 주세요.";
  }
  if (end <= start) {
    return "종료 시간은 시작 시간보다 늦어야 합니다.";
  }
  return null;
}

/** 두 시간 구간이 겹치면 true ([start, end) 기준) */
export function timesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const as = timeToMinutes(aStart);
  const ae = timeToMinutes(aEnd);
  const bs = timeToMinutes(bStart);
  const be = timeToMinutes(bEnd);
  if (as == null || ae == null || bs == null || be == null) return false;
  return as < be && bs < ae;
}
