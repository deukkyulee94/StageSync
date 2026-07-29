import type { AppData } from "@/types";

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

export function migrate(raw: unknown): AppData {
  const data = raw as Partial<AppData>;
  const roles = data.roles ?? [];
  const roleAssignments = (data.roleAssignments ?? []).map((a) => ({
    ...a,
    trackId: a.trackId ?? null,
  }));
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

  return {
    users: data.users ?? [],
    productions: data.productions ?? [],
    productionMembers: data.productionMembers ?? [],
    tracks: data.tracks ?? [],
    roles,
    castGroups: groupsFromPairs(roles, data.castGroups ?? []),
    castEnsembles: data.castEnsembles ?? [],
    roleAssignments,
    availabilities: data.availabilities ?? [],
    availabilityPatterns: data.availabilityPatterns ?? [],
    rehearsals,
  };
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
    const migrated = migrate(JSON.parse(raw));
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
