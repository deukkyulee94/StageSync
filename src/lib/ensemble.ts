import type {
  AppData,
  CastEnsemble,
  EnsembleSlot,
  User,
} from "@/types";
import { weekDatesFromYmd } from "@/lib/kst";

export interface SubstituteCandidate {
  roleId: string;
  primaryUserId: string;
  substituteUserId: string;
  source: "alternate" | "same_role";
}

export interface EnsembleDayStatus {
  date: string;
  primaryAvailableIds: string[];
  primaryMissingIds: string[];
  primaryCount: number;
  primaryTotal: number;
  overlapStart: string | null;
  overlapEnd: string | null;
  /** soft: 빠진 본캐 배역을 메울 수 있는 대타 */
  substitutes: SubstituteCandidate[];
  coveredWithSubs: number;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function overlap(
  slots: { startTime: string; endTime: string }[],
): { start: string | null; end: string | null } {
  if (slots.length === 0) return { start: null, end: null };
  const start = Math.max(...slots.map((s) => timeToMinutes(s.startTime)));
  const end = Math.min(...slots.map((s) => timeToMinutes(s.endTime)));
  if (start >= end) return { start: null, end: null };
  return { start: minutesToTime(start), end: minutesToTime(end) };
}

export function getEnsemblePrimaryUsers(
  data: AppData,
  ensemble: CastEnsemble,
): User[] {
  const ids = [...new Set(ensemble.slots.map((s) => s.userId))];
  return data.users.filter((u) => ids.includes(u.id));
}

/** 동일 배역의 다른 배정 배우 (대타 후보 pool) */
export function getSameRoleAlternates(
  data: AppData,
  roleId: string,
  excludeUserId: string,
): string[] {
  return data.roleAssignments
    .filter((a) => a.roleId === roleId && a.userId !== excludeUserId)
    .map((a) => a.userId);
}

export function getAlternateEnsemble(
  data: AppData,
  ensemble: CastEnsemble,
): CastEnsemble | null {
  if (!ensemble.alternateEnsembleId) return null;
  return data.castEnsembles.find((e) => e.id === ensemble.alternateEnsembleId) ?? null;
}

export interface RoleSubstituteOption {
  userId: string;
  source: "same_role" | "alternate";
}

/**
 * 슬롯 대타 후보: A/B 반대 캐스트 우선 + 동일 배역 배정 배우.
 * `excludeUserIds`에 이미 라인업에 있는 인원을 넣어 중복 배정을 막는다.
 */
export function listSubstituteOptionsForSlot(
  data: AppData,
  ensemble: CastEnsemble,
  roleId: string,
  primaryUserId: string,
  excludeUserIds: Iterable<string> = [],
): RoleSubstituteOption[] {
  const blocked = new Set(excludeUserIds);
  blocked.add(primaryUserId);
  const seen = new Set<string>();
  const options: RoleSubstituteOption[] = [];

  const push = (userId: string, source: RoleSubstituteOption["source"]) => {
    if (blocked.has(userId) || seen.has(userId)) return;
    seen.add(userId);
    options.push({ userId, source });
  };

  const alt = getAlternateEnsemble(data, ensemble);
  if (alt) {
    const altSlot = alt.slots.find((s) => s.roleId === roleId);
    if (altSlot) push(altSlot.userId, "alternate");
  }

  for (const id of getSameRoleAlternates(data, roleId, primaryUserId)) {
    push(id, "same_role");
  }

  return options;
}

/** roleId → 대타 userId. 없는 배역은 본캐 유지 */
export function applySlotSubstitutions(
  ensemble: CastEnsemble,
  substitutions: Record<string, string>,
): EnsembleSlot[] {
  return ensemble.slots.map((slot) => ({
    roleId: slot.roleId,
    userId: substitutions[slot.roleId] ?? slot.userId,
  }));
}

export function hasSlotSubstitutions(
  substitutions: Record<string, string> | undefined,
): boolean {
  return !!substitutions && Object.keys(substitutions).length > 0;
}

export function substituteLocationNote(
  ensembleName: string,
  hasSubstitute: boolean,
): string {
  return hasSubstitute ? `${ensembleName}(대타)` : ensembleName;
}

/** 여러 장면 라벨을 한 연습 카드용으로 합침 */
export function combinedLocationNote(
  parts: { name: string; hasSubstitute: boolean }[],
): string {
  return parts
    .map((p) => substituteLocationNote(p.name, p.hasSubstitute))
    .join(", ");
}

/** rehearsal에 연결된 장면 id 목록 (구형 ensembleId 호환) */
export function rehearsalEnsembleIds(rehearsal: {
  ensembleId?: string | null;
  ensembleIds?: string[] | null;
}): string[] {
  if (rehearsal.ensembleIds && rehearsal.ensembleIds.length > 0) {
    return rehearsal.ensembleIds;
  }
  return rehearsal.ensembleId ? [rehearsal.ensembleId] : [];
}

export function findSubstitutesForMissing(
  data: AppData,
  ensemble: CastEnsemble,
  missingUserIds: string[],
  availableUserIds: Set<string>,
  allowRoleSubstitute = false,
): SubstituteCandidate[] {
  if (!allowRoleSubstitute || missingUserIds.length === 0) return [];

  const result: SubstituteCandidate[] = [];
  const usedSubs = new Set<string>();
  const alt = getAlternateEnsemble(data, ensemble);

  for (const missingId of missingUserIds) {
    const slot = ensemble.slots.find((s) => s.userId === missingId);
    if (!slot) continue;

    let picked: SubstituteCandidate | null = null;

    if (alt) {
      const altSlot = alt.slots.find((s) => s.roleId === slot.roleId);
      if (
        altSlot &&
        availableUserIds.has(altSlot.userId) &&
        !usedSubs.has(altSlot.userId)
      ) {
        picked = {
          roleId: slot.roleId,
          primaryUserId: missingId,
          substituteUserId: altSlot.userId,
          source: "alternate",
        };
      }
    }

    if (!picked) {
      for (const cand of getSameRoleAlternates(data, slot.roleId, missingId)) {
        if (availableUserIds.has(cand) && !usedSubs.has(cand)) {
          picked = {
            roleId: slot.roleId,
            primaryUserId: missingId,
            substituteUserId: cand,
            source: "same_role",
          };
          break;
        }
      }
    }

    if (picked) {
      usedSubs.add(picked.substituteUserId);
      result.push(picked);
    }
  }

  return result;
}

export function evaluateEnsembleWeek(
  data: AppData,
  ensemble: CastEnsemble,
  weekStart: string,
  options?: { allowRoleSubstitute?: boolean },
): EnsembleDayStatus[] {
  const allowRoleSubstitute = options?.allowRoleSubstitute ?? false;
  const primaryIds = [...new Set(ensemble.slots.map((s) => s.userId))];
  const weekDates = weekDatesFromYmd(weekStart);

  // 대타 후보 pool에 넣을 유저 (alternate + same role)
  const poolIds = new Set(primaryIds);
  if (allowRoleSubstitute) {
    const alt = getAlternateEnsemble(data, ensemble);
    if (alt) alt.slots.forEach((s) => poolIds.add(s.userId));
    for (const slot of ensemble.slots) {
      getSameRoleAlternates(data, slot.roleId, slot.userId).forEach((id) =>
        poolIds.add(id),
      );
    }
  }

  return weekDates.map((date) => {
    const daySlots = data.availabilities.filter(
      (a) =>
        a.productionId === ensemble.productionId &&
        a.date === date &&
        poolIds.has(a.userId),
    );
    const available = new Set(daySlots.map((s) => s.userId));
    const primaryAvailableIds = primaryIds.filter((id) => available.has(id));
    const primaryMissingIds = primaryIds.filter((id) => !available.has(id));
    const primaryDaySlots = daySlots.filter((s) =>
      primaryAvailableIds.includes(s.userId),
    );
    const ov = overlap(primaryDaySlots);
    const substitutes = findSubstitutesForMissing(
      data,
      ensemble,
      primaryMissingIds,
      available,
      allowRoleSubstitute,
    );

    return {
      date,
      primaryAvailableIds,
      primaryMissingIds,
      primaryCount: primaryAvailableIds.length,
      primaryTotal: primaryIds.length,
      overlapStart: ov.start,
      overlapEnd: ov.end,
      substitutes,
      coveredWithSubs: primaryAvailableIds.length + substitutes.length,
    };
  });
}

export function slotsFromTrack(
  data: AppData,
  productionId: string,
  trackId: string,
  roleIds?: string[],
): EnsembleSlot[] {
  return data.roleAssignments
    .filter((a) => {
      if (a.trackId !== trackId) return false;
      const role = data.roles.find((r) => r.id === a.roleId);
      if (!role || role.productionId !== productionId) return false;
      if (roleIds && roleIds.length > 0 && !roleIds.includes(a.roleId)) {
        return false;
      }
      return true;
    })
    .map((a) => ({ roleId: a.roleId, userId: a.userId }));
}
