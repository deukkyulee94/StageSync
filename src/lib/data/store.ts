import type { AppData, CastingMode, Production } from "@/types";

export const STORAGE_KEY = "stage-sync-data-v4";
export const SESSION_KEY = "stage-sync-session-v1";

export function createEmptyData(): AppData {
  return {
    users: [],
    productions: [],
    productionMembers: [],
    tracks: [],
    roles: [],
    castGroups: [],
    castEnsembles: [],
    roleAssignments: [],
    availabilities: [],
    availabilityPatterns: [],
    rehearsals: [],
  };
}

function groupsFromPairs(
  roles: AppData["roles"],
  existing: AppData["castGroups"],
): AppData["castGroups"] {
  if (existing.length > 0) return existing;
  const seen = new Set<string>();
  const groups: AppData["castGroups"] = [];
  for (const r of roles) {
    if (!r.pairRoleId) continue;
    const key = [r.id, r.pairRoleId].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    const other = roles.find((x) => x.id === r.pairRoleId);
    if (!other || other.productionId !== r.productionId) continue;
    groups.push({
      id: `cg-migrated-${key}`,
      productionId: r.productionId,
      name: `${r.name}·${other.name}`,
      roleIds: [r.id, other.id],
    });
  }
  return groups;
}

/** 기존 작품: 팀/장면 중 하나로 추정. 현재 운영 데이터는 장면(CASE2). */
export function inferCastingMode(
  production: Pick<Production, "id"> & Partial<Production>,
  data: Pick<AppData, "tracks">,
): CastingMode {
  if (production.castingMode === "team" || production.castingMode === "scene") {
    return production.castingMode;
  }
  // 사용자 확인: 현재 작품은 CASE2(장면)뿐 → 기본 scene
  // (팀이 있어도 명시적 모드가 없으면 scene으로 둔다)
  void data;
  return "scene";
}

export function migrate(raw: unknown): AppData {
  const data = raw as Partial<AppData>;
  const roles = data.roles ?? [];
  const roleAssignments = (data.roleAssignments ?? []).map((a) => ({
    ...a,
    trackId: a.trackId ?? null,
  }));
  const tracks = data.tracks ?? [];
  const rehearsals = (data.rehearsals ?? []).map((r) => {
    const ensembleIds =
      r.ensembleIds && r.ensembleIds.length > 0
        ? r.ensembleIds
        : r.ensembleId
          ? [r.ensembleId]
          : [];
    return {
      ...r,
      participantIds: r.participantIds ?? [],
      participantRoles: r.participantRoles ?? {},
      participantNotes: r.participantNotes ?? {},
      participantSlots: r.participantSlots ?? [],
      place: r.place ?? "",
      requiresAdmin: r.requiresAdmin ?? false,
      ensembleId: ensembleIds[0] ?? null,
      ensembleIds,
    };
  });

  const productions = (data.productions ?? []).map((p) => ({
    ...p,
    castingMode: inferCastingMode(p, { tracks }),
  }));

  return {
    users: data.users ?? [],
    productions,
    productionMembers: data.productionMembers ?? [],
    tracks,
    roles,
    castGroups: groupsFromPairs(roles, data.castGroups ?? []),
    castEnsembles: data.castEnsembles ?? [],
    roleAssignments,
    availabilities: data.availabilities ?? [],
    availabilityPatterns: data.availabilityPatterns ?? [],
    rehearsals,
  };
}

/** migrate로 castingMode가 채워졌는지 (저장 여부 판단용) */
export function needsCastingModePersist(raw: unknown): boolean {
  const data = raw as Partial<AppData>;
  return (data.productions ?? []).some(
    (p) => p.castingMode !== "team" && p.castingMode !== "scene",
  );
}

export function loadData(): AppData {
  if (typeof window === "undefined") return createEmptyData();
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ??
      localStorage.getItem("stage-sync-data-v3") ??
      localStorage.getItem("stage-sync-data-v2") ??
      localStorage.getItem("stage-sync-data-v1");
    if (!raw) return createEmptyData();
    const parsed = JSON.parse(raw) as unknown;
    const migrated = migrate(parsed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return createEmptyData();
  }
}

export function saveData(data: AppData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function resetData(): AppData {
  const empty = createEmptyData();
  saveData(empty);
  return empty;
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}
