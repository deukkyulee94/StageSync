import type { AppData, Rehearsal } from "@/types";
import { getRehearsalParticipantLabels } from "@/lib/data/repository";
import { formatDateWithWeekday } from "@/lib/recommend";

export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  // iPadOS desktop UA
  return navigator.maxTouchPoints > 1 && /Mac/i.test(ua);
}

export function buildRehearsalShareMessage(
  data: AppData,
  rehearsal: Rehearsal,
): string {
  const production = data.productions.find(
    (p) => p.id === rehearsal.productionId,
  );
  const participants = getRehearsalParticipantLabels(data, rehearsal);
  const place = rehearsal.place?.trim() ?? "";
  const notes = (rehearsal.participantIds ?? [])
    .map((userId) => {
      const note = rehearsal.participantNotes?.[userId]?.trim();
      if (!note) return null;
      const name = data.users.find((u) => u.id === userId)?.name ?? "?";
      return `- ${name}: ${note}`;
    })
    .filter(Boolean);

  const lines = [
    "[Stage Sync 연습 일정]",
    `작품: ${production?.title ?? "-"}`,
    `날짜: ${formatDateWithWeekday(rehearsal.date)}`,
    `시간: ${rehearsal.startTime}–${rehearsal.endTime}`,
  ];

  if (rehearsal.locationNote?.trim()) {
    lines.push(`장면: ${rehearsal.locationNote.trim()}`);
  }
  if (place) {
    lines.push(`장소: ${place}`);
  }
  if (participants.length > 0) {
    lines.push(`참가자: ${participants.join(" / ")}`);
  }
  if (notes.length > 0) {
    lines.push("메모:");
    lines.push(...(notes as string[]));
  }

  lines.push("", "일정을 확인해 주세요.");
  return lines.join("\n");
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

/**
 * PC: 메시지 복사
 * 모바일: 시스템 공유 시트(카카오톡 선택) → 실패 시 복사
 */
export async function shareRehearsalMessage(
  data: AppData,
  rehearsal: Rehearsal,
): Promise<"copied" | "shared"> {
  const text = buildRehearsalShareMessage(data, rehearsal);
  const mobile = isMobileDevice();

  if (mobile && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: "Stage Sync 연습 일정",
        text,
      });
      return "shared";
    } catch (err) {
      // 사용자가 공유 취소한 경우
      if (err instanceof DOMException && err.name === "AbortError") {
        throw err;
      }
      // share 실패 시 복사로 폴백
    }
  }

  await copyText(text);
  return "copied";
}
