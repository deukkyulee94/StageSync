import type {
  AppData,
  CastEnsemble,
  EnsembleSlot,
  User,
} from "@/types";

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
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + "T12:00:00");
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

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
