import type {
  AppData,
  AvailabilityPattern,
  AvailabilitySlot,
  CastRole,
  DayOfWeek,
  Production,
  ProductionMember,
  Rehearsal,
  RoleAssignment,
  User,
  UserRole,
} from "@/types";
import { DAY_INDEX, isAdmin } from "@/types";
import { slotsFromTrack } from "@/lib/ensemble";
import { normalizePhone, uid } from "./store";

/** 휴대폰 또는 이름 + PIN 로그인 (테스트 편의: 이름만으로도 가능) */
export function login(
  data: AppData,
  identifier: string,
  pin: string,
): User | null {
  const raw = identifier.trim();
  if (!raw || !pin) return null;

  const phone = normalizePhone(raw);
  if (phone.length >= 10) {
    const byPhone = data.users.find((u) => u.phone === phone && u.pin === pin);
    if (byPhone) return byPhone;
  }

  const nameKey = raw.replace(/\s+/g, "").toLowerCase();
  const byNameExact = data.users.find(
    (u) =>
      u.pin === pin &&
      u.name.replace(/\s+/g, "").toLowerCase() === nameKey,
  );
  if (byNameExact) return byNameExact;

  // 부분 일치 (예: "승준", "석호A")
  const byNamePartial = data.users.filter(
    (u) =>
      u.pin === pin &&
      u.name.replace(/\s+/g, "").toLowerCase().includes(nameKey),
  );
  if (byNamePartial.length === 1) return byNamePartial[0];

  return null;
}

export function changePin(
  data: AppData,
  userId: string,
  newPin: string,
): AppData {
  if (!/^\d{4}$/.test(newPin)) throw new Error("비밀번호는 4자리 숫자여야 합니다.");
  return {
    ...data,
    users: data.users.map((u) => (u.id === userId ? { ...u, pin: newPin } : u)),
  };
}

export function createUser(
  data: AppData,
  input: {
    name: string;
    phone: string;
    role: UserRole;
    homeStationId?: string | null;
    workStationId?: string | null;
  },
): AppData {
  const phone = normalizePhone(input.phone);
  if (phone.length < 10) throw new Error("휴대폰 번호를 확인해주세요.");
  if (data.users.some((u) => u.phone === phone)) {
    throw new Error("이미 등록된 휴대폰 번호입니다.");
  }
  const user: User = {
    id: uid("u"),
    name: input.name.trim(),
    phone,
    pin: "0000",
    role: input.role,
    homeStationId: input.homeStationId ?? null,
    workStationId: input.workStationId ?? null,
    createdAt: new Date().toISOString(),
  };
  return { ...data, users: [...data.users, user] };
}

export function updateUser(
  data: AppData,
  userId: string,
  patch: Partial<
    Pick<User, "name" | "role" | "homeStationId" | "workStationId" | "phone" | "pin">
  >,
): AppData {
  const target = data.users.find((u) => u.id === userId);
  if (!target) throw new Error("사용자를 찾을 수 없습니다.");

  let nextPhone = target.phone;
  if (patch.phone !== undefined) {
    nextPhone = normalizePhone(patch.phone);
    if (nextPhone.length < 10) throw new Error("휴대폰 번호를 확인해주세요.");
    if (data.users.some((u) => u.id !== userId && u.phone === nextPhone)) {
      throw new Error("이미 등록된 휴대폰 번호입니다.");
    }
  }

  if (patch.pin !== undefined && !/^\d{4}$/.test(patch.pin)) {
    throw new Error("비밀번호는 4자리 숫자여야 합니다.");
  }

  return {
    ...data,
    users: data.users.map((u) =>
      u.id === userId
        ? {
            ...u,
            ...patch,
            phone: nextPhone,
            name: patch.name !== undefined ? patch.name.trim() : u.name,
          }
        : u,
    ),
  };
}

export function deleteUser(data: AppData, userId: string): AppData {
  return {
    ...data,
    users: data.users.filter((u) => u.id !== userId),
    productionMembers: data.productionMembers.filter((m) => m.userId !== userId),
    roleAssignments: data.roleAssignments.filter((a) => a.userId !== userId),
    castEnsembles: data.castEnsembles
      .map((e) => ({
        ...e,
        slots: e.slots.filter((s) => s.userId !== userId),
      }))
      .filter((e) => e.slots.length >= 1),
    availabilities: data.availabilities.filter((a) => a.userId !== userId),
    availabilityPatterns: data.availabilityPatterns.filter(
      (p) => p.userId !== userId,
    ),
    rehearsals: data.rehearsals.map((r) => {
      const participantRoles = { ...(r.participantRoles ?? {}) };
      delete participantRoles[userId];
      const participantNotes = { ...(r.participantNotes ?? {}) };
      delete participantNotes[userId];
      return {
        ...r,
        participantIds: (r.participantIds ?? []).filter((id) => id !== userId),
        participantRoles,
        participantNotes,
      };
    }),
  };
}

export function createProduction(
  data: AppData,
  input: { title: string; description?: string },
): AppData {
  const production: Production = {
    id: uid("p"),
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    status: "planning",
    createdAt: new Date().toISOString(),
  };
  return { ...data, productions: [...data.productions, production] };
}

export function updateProduction(
  data: AppData,
  productionId: string,
  patch: Partial<Pick<Production, "title" | "description" | "status">>,
): AppData {
  return {
    ...data,
    productions: data.productions.map((p) =>
      p.id === productionId ? { ...p, ...patch } : p,
    ),
  };
}

/** 작품과 연결된 멤버·배역·팀·Ensemble·가용성·연습까지 함께 삭제 */
export function deleteProduction(data: AppData, productionId: string): AppData {
  const roleIds = new Set(
    data.roles.filter((r) => r.productionId === productionId).map((r) => r.id),
  );
  return {
    ...data,
    productions: data.productions.filter((p) => p.id !== productionId),
    productionMembers: data.productionMembers.filter(
      (m) => m.productionId !== productionId,
    ),
    tracks: data.tracks.filter((t) => t.productionId !== productionId),
    roles: data.roles.filter((r) => r.productionId !== productionId),
    castGroups: data.castGroups.filter((g) => g.productionId !== productionId),
    castEnsembles: data.castEnsembles.filter(
      (e) => e.productionId !== productionId,
    ),
    roleAssignments: data.roleAssignments.filter((a) => !roleIds.has(a.roleId)),
    availabilities: data.availabilities.filter(
      (a) => a.productionId !== productionId,
    ),
    availabilityPatterns: data.availabilityPatterns.filter(
      (p) => p.productionId !== productionId,
    ),
    rehearsals: data.rehearsals.filter((r) => r.productionId !== productionId),
  };
}

export function addProductionMember(
  data: AppData,
  productionId: string,
  userId: string,
): AppData {
  if (
    data.productionMembers.some(
      (m) => m.productionId === productionId && m.userId === userId,
    )
  ) {
    return data;
  }
  const member: ProductionMember = {
    id: uid("pm"),
    productionId,
    userId,
  };
  return { ...data, productionMembers: [...data.productionMembers, member] };
}

export function removeProductionMember(
  data: AppData,
  productionId: string,
  userId: string,
): AppData {
  return {
    ...data,
    productionMembers: data.productionMembers.filter(
      (m) => !(m.productionId === productionId && m.userId === userId),
    ),
  };
}

export function createRole(
  data: AppData,
  input: { productionId: string; name: string; description: string },
): AppData {
  const role: CastRole = {
    id: uid("r"),
    productionId: input.productionId,
    name: input.name.trim(),
    description: input.description.trim(),
    pairRoleId: null,
  };
  return { ...data, roles: [...data.roles, role] };
}

export function setRolePair(
  data: AppData,
  roleIdA: string,
  roleIdB: string | null,
): AppData {
  const roleA = data.roles.find((r) => r.id === roleIdA);
  if (!roleA) throw new Error("배역을 찾을 수 없습니다.");

  let roles = data.roles.map((r) => {
    // 기존 A의 페어 해제
    if (r.pairRoleId === roleIdA) return { ...r, pairRoleId: null };
    return r;
  });

  if (!roleIdB) {
    roles = roles.map((r) =>
      r.id === roleIdA ? { ...r, pairRoleId: null } : r,
    );
    return { ...data, roles };
  }

  const roleB = roles.find((r) => r.id === roleIdB);
  if (!roleB) throw new Error("페어 배역을 찾을 수 없습니다.");
  if (roleB.productionId !== roleA.productionId) {
    throw new Error("같은 작품의 배역끼리만 페어를 맺을 수 있습니다.");
  }

  // B의 기존 페어도 해제
  roles = roles.map((r) => {
    if (r.pairRoleId === roleIdB) return { ...r, pairRoleId: null };
    return r;
  });

  roles = roles.map((r) => {
    if (r.id === roleIdA) return { ...r, pairRoleId: roleIdB };
    if (r.id === roleIdB) return { ...r, pairRoleId: roleIdA };
    return r;
  });

  return { ...data, roles };
}

export function createCastGroup(
  data: AppData,
  input: { productionId: string; name: string; roleIds: string[] },
): AppData {
  const unique = [...new Set(input.roleIds)];
  if (unique.length < 2) {
    throw new Error("페어/그룹은 배역을 2명 이상 선택해야 합니다.");
  }
  const roles = data.roles.filter((r) => unique.includes(r.id));
  if (roles.length !== unique.length) {
    throw new Error("존재하지 않는 배역이 포함되어 있습니다.");
  }
  if (roles.some((r) => r.productionId !== input.productionId)) {
    throw new Error("같은 작품의 배역만 묶을 수 있습니다.");
  }
  const group = {
    id: uid("cg"),
    productionId: input.productionId,
    name: input.name.trim() || roles.map((r) => r.name).join("·"),
    roleIds: unique,
  };
  return { ...data, castGroups: [...data.castGroups, group] };
}

export function updateCastGroup(
  data: AppData,
  groupId: string,
  patch: { name?: string; roleIds?: string[] },
): AppData {
  const group = data.castGroups.find((g) => g.id === groupId);
  if (!group) throw new Error("페어 그룹을 찾을 수 없습니다.");
  const roleIds = patch.roleIds ? [...new Set(patch.roleIds)] : group.roleIds;
  if (roleIds.length < 2) {
    throw new Error("페어/그룹은 배역을 2명 이상 선택해야 합니다.");
  }
  return {
    ...data,
    castGroups: data.castGroups.map((g) =>
      g.id === groupId
        ? {
            ...g,
            name: patch.name?.trim() || g.name,
            roleIds,
          }
        : g,
    ),
  };
}

export function deleteCastGroup(data: AppData, groupId: string): AppData {
  return {
    ...data,
    castGroups: data.castGroups.filter((g) => g.id !== groupId),
  };
}

export function createTrack(
  data: AppData,
  input: { productionId: string; name: string },
): AppData {
  const name = input.name.trim();
  if (!name) throw new Error("팀 이름을 입력해주세요.");
  if (
    data.tracks.some(
      (t) => t.productionId === input.productionId && t.name === name,
    )
  ) {
    throw new Error("같은 이름의 팀이 이미 있습니다.");
  }
  return {
    ...data,
    tracks: [
      ...data.tracks,
      { id: uid("tr"), productionId: input.productionId, name },
    ],
  };
}

export function deleteTrack(data: AppData, trackId: string): AppData {
  return {
    ...data,
    tracks: data.tracks.filter((t) => t.id !== trackId),
    roleAssignments: data.roleAssignments.map((a) =>
      a.trackId === trackId ? { ...a, trackId: null } : a,
    ),
  };
}

export function createCastEnsemble(
  data: AppData,
  input: {
    productionId: string;
    name: string;
    slots: { roleId: string; userId: string }[];
    alternateEnsembleId?: string | null;
  },
): AppData {
  if (input.slots.length < 1) {
    throw new Error("라인업 슬롯을 1개 이상 추가해주세요.");
  }
  for (const slot of input.slots) {
    const role = data.roles.find((r) => r.id === slot.roleId);
    if (!role || role.productionId !== input.productionId) {
      throw new Error("잘못된 배역이 포함되어 있습니다.");
    }
  }
  const ensemble = {
    id: uid("ce"),
    productionId: input.productionId,
    name: input.name.trim() || "연습 유닛",
    slots: input.slots,
    alternateEnsembleId: input.alternateEnsembleId ?? null,
    allowRoleSubstitute: false,
  };
  let next: AppData = {
    ...data,
    castEnsembles: [...data.castEnsembles, ensemble],
  };
  // 양방향 alternate 연결
  if (ensemble.alternateEnsembleId) {
    next = {
      ...next,
      castEnsembles: next.castEnsembles.map((e) =>
        e.id === ensemble.alternateEnsembleId
          ? { ...e, alternateEnsembleId: ensemble.id }
          : e,
      ),
    };
  }
  return next;
}

export function updateCastEnsemble(
  data: AppData,
  ensembleId: string,
  patch: Partial<{
    name: string;
    slots: { roleId: string; userId: string }[];
    alternateEnsembleId: string | null;
  }>,
): AppData {
  const current = data.castEnsembles.find((e) => e.id === ensembleId);
  if (!current) throw new Error("연습 유닛을 찾을 수 없습니다.");
  if (patch.slots && patch.slots.length < 1) {
    throw new Error("라인업 슬롯을 1개 이상 유지해주세요.");
  }

  let next = {
    ...data,
    castEnsembles: data.castEnsembles.map((e) =>
      e.id === ensembleId
        ? {
            ...e,
            name: patch.name?.trim() || e.name,
            slots: patch.slots ?? e.slots,
            alternateEnsembleId:
              patch.alternateEnsembleId !== undefined
                ? patch.alternateEnsembleId
                : e.alternateEnsembleId,
          }
        : e,
    ),
  };

  const updated = next.castEnsembles.find((e) => e.id === ensembleId)!;
  if (
    patch.alternateEnsembleId !== undefined &&
    patch.alternateEnsembleId &&
    patch.alternateEnsembleId !== current.alternateEnsembleId
  ) {
    next = {
      ...next,
      castEnsembles: next.castEnsembles.map((e) => {
        if (e.id === current.alternateEnsembleId && e.alternateEnsembleId === ensembleId) {
          return { ...e, alternateEnsembleId: null };
        }
        if (e.id === patch.alternateEnsembleId) {
          return { ...e, alternateEnsembleId: ensembleId };
        }
        return e;
      }),
    };
    void updated;
  }

  return next;
}

export function deleteCastEnsemble(data: AppData, ensembleId: string): AppData {
  return {
    ...data,
    castEnsembles: data.castEnsembles
      .filter((e) => e.id !== ensembleId)
      .map((e) =>
        e.alternateEnsembleId === ensembleId
          ? { ...e, alternateEnsembleId: null }
          : e,
      ),
  };
}

/** 트랙 assignment로 Ensemble 생성 */
export function createEnsembleFromTrack(
  data: AppData,
  productionId: string,
  trackId: string,
  name?: string,
  alternateTrackId?: string | null,
): AppData {
  const track = data.tracks.find((t) => t.id === trackId);
  if (!track || track.productionId !== productionId) {
    throw new Error("팀을 찾을 수 없습니다.");
  }
  const slots = slotsFromTrack(data, productionId, trackId);
  if (slots.length < 1) {
    throw new Error("이 팀에 배정된 배우가 없습니다.");
  }

  if (alternateTrackId) {
    const altSlots = slotsFromTrack(data, productionId, alternateTrackId);
    const altTrack = data.tracks.find((t) => t.id === alternateTrackId);
    if (altSlots.length > 0 && altTrack) {
      const withAlt = createCastEnsemble(data, {
        productionId,
        name: `${altTrack.name} 전체`,
        slots: altSlots,
      });
      const alternateEnsembleId =
        withAlt.castEnsembles[withAlt.castEnsembles.length - 1].id;
      return createCastEnsemble(withAlt, {
        productionId,
        name: name?.trim() || `${track.name} 전체`,
        slots,
        alternateEnsembleId,
      });
    }
  }

  return createCastEnsemble(data, {
    productionId,
    name: name?.trim() || `${track.name} 전체`,
    slots,
  });
}

export function assignActorToRole(
  data: AppData,
  roleId: string,
  userId: string,
  trackId: string | null = null,
): AppData {
  if (
    data.roleAssignments.some((a) => a.roleId === roleId && a.userId === userId)
  ) {
    // 트랙만 업데이트
    return {
      ...data,
      roleAssignments: data.roleAssignments.map((a) =>
        a.roleId === roleId && a.userId === userId
          ? { ...a, trackId }
          : a,
      ),
    };
  }
  const assignment: RoleAssignment = {
    id: uid("ra"),
    roleId,
    userId,
    trackId,
  };
  const role = data.roles.find((r) => r.id === roleId);
  let next = { ...data, roleAssignments: [...data.roleAssignments, assignment] };
  if (role) {
    next = addProductionMember(next, role.productionId, userId);
  }
  return next;
}

/** 기존 배역-배우 연결의 팀만 변경 (배역 연결은 유지) */
export function setAssignmentTrack(
  data: AppData,
  roleId: string,
  userId: string,
  trackId: string | null,
): AppData {
  const exists = data.roleAssignments.some(
    (a) => a.roleId === roleId && a.userId === userId,
  );
  if (!exists) {
    throw new Error("배역에 연결된 배우가 아닙니다. 먼저 배역에 배우를 연결하세요.");
  }
  return {
    ...data,
    roleAssignments: data.roleAssignments.map((a) =>
      a.roleId === roleId && a.userId === userId ? { ...a, trackId } : a,
    ),
  };
}

export function unassignActorFromRole(
  data: AppData,
  roleId: string,
  userId: string,
): AppData {
  return {
    ...data,
    roleAssignments: data.roleAssignments.filter(
      (a) => !(a.roleId === roleId && a.userId === userId),
    ),
  };
}

export function upsertAvailability(
  data: AppData,
  input: Omit<AvailabilitySlot, "id"> & { id?: string },
): AppData {
  if (input.id) {
    return {
      ...data,
      availabilities: data.availabilities.map((a) =>
        a.id === input.id ? { ...a, ...input, id: input.id } : a,
      ),
    };
  }
  // 같은 날짜 슬롯이 있으면 업데이트
  const existing = data.availabilities.find(
    (a) =>
      a.userId === input.userId &&
      a.productionId === input.productionId &&
      a.date === input.date,
  );
  if (existing) {
    return {
      ...data,
      availabilities: data.availabilities.map((a) =>
        a.id === existing.id
          ? {
              ...a,
              startTime: input.startTime,
              endTime: input.endTime,
              note: input.note,
            }
          : a,
      ),
    };
  }
  const slot: AvailabilitySlot = {
    id: uid("av"),
    userId: input.userId,
    productionId: input.productionId,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    note: input.note,
  };
  return { ...data, availabilities: [...data.availabilities, slot] };
}

export function removeAvailability(data: AppData, id: string): AppData {
  return {
    ...data,
    availabilities: data.availabilities.filter((a) => a.id !== id),
  };
}

export function upsertAvailabilityPattern(
  data: AppData,
  input: Omit<AvailabilityPattern, "id"> & { id?: string },
): AppData {
  if (input.days.length === 0) {
    throw new Error("반복 요일을 하나 이상 선택해주세요.");
  }
  if (input.id) {
    return {
      ...data,
      availabilityPatterns: data.availabilityPatterns.map((p) =>
        p.id === input.id ? { ...p, ...input, id: input.id } : p,
      ),
    };
  }
  const pattern: AvailabilityPattern = {
    id: uid("ap"),
    userId: input.userId,
    productionId: input.productionId,
    days: input.days,
    startTime: input.startTime,
    endTime: input.endTime,
    note: input.note,
    fromDate: input.fromDate,
    toDate: input.toDate,
    active: input.active,
  };
  return {
    ...data,
    availabilityPatterns: [...data.availabilityPatterns, pattern],
  };
}

export function removeAvailabilityPattern(data: AppData, id: string): AppData {
  return {
    ...data,
    availabilityPatterns: data.availabilityPatterns.filter((p) => p.id !== id),
    availabilities: data.availabilities.filter((a) => a.patternId !== id),
  };
}

function dayOfWeekFromDate(dateStr: string): DayOfWeek {
  const d = new Date(dateStr + "T12:00:00");
  // JS: 0=일 … 6=토 → mon-first index
  const js = d.getDay();
  const idx = js === 0 ? 6 : js - 1;
  return DAY_INDEX[idx];
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 활성 반복 패턴을 주간 슬롯으로 펼쳐 가용성에 반영 */
export function expandPatternsToWeek(
  data: AppData,
  userId: string,
  productionId: string,
  weekStart: string,
): AppData {
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  let next = { ...data, availabilities: [...data.availabilities] };

  const patterns = data.availabilityPatterns.filter(
    (p) =>
      p.active &&
      p.userId === userId &&
      p.productionId === productionId,
  );

  for (const pattern of patterns) {
    for (const date of weekDates) {
      if (date < pattern.fromDate) continue;
      if (pattern.toDate && date > pattern.toDate) continue;
      const dow = dayOfWeekFromDate(date);
      if (!pattern.days.includes(dow)) continue;

      next = upsertAvailability(next, {
        userId,
        productionId,
        date,
        startTime: pattern.startTime,
        endTime: pattern.endTime,
        note: pattern.note ?? "반복 패턴",
        patternId: pattern.id,
      });
    }
  }
  return next;
}

export function createRehearsal(
  data: AppData,
  input: Omit<Rehearsal, "id" | "createdAt" | "status"> & {
    status?: Rehearsal["status"];
  },
): AppData {
  const participantIds = input.participantIds ?? [];
  let participantRoles = { ...(input.participantRoles ?? {}) };

  // 장면 슬롯 기준으로 본캐 배역 채우기
  if (input.ensembleId) {
    const ensemble = data.castEnsembles.find((e) => e.id === input.ensembleId);
    for (const slot of ensemble?.slots ?? []) {
      if (participantIds.includes(slot.userId) && participantRoles[slot.userId] === undefined) {
        participantRoles[slot.userId] = slot.roleId;
      }
    }
  }

  const rehearsal: Rehearsal = {
    ...input,
    participantIds,
    participantRoles,
    participantNotes: input.participantNotes ?? {},
    place: input.place ?? "",
    requiresAdmin: input.requiresAdmin ?? false,
    adminConfirmed: input.adminConfirmed ?? false,
    id: uid("rh"),
    status: input.status ?? "proposed",
    createdAt: new Date().toISOString(),
  };
  return { ...data, rehearsals: [...data.rehearsals, rehearsal] };
}

export function updateRehearsal(
  data: AppData,
  rehearsalId: string,
  patch: Partial<Rehearsal>,
): AppData {
  return {
    ...data,
    rehearsals: data.rehearsals.map((r) =>
      r.id === rehearsalId ? { ...r, ...patch } : r,
    ),
  };
}

export function deleteRehearsal(data: AppData, rehearsalId: string): AppData {
  return {
    ...data,
    rehearsals: data.rehearsals.filter((r) => r.id !== rehearsalId),
  };
}

/** 작품에 배정된 해당 유저의 배역 목록 */
export function getUserRolesInProduction(
  data: AppData,
  productionId: string,
  userId: string,
): CastRole[] {
  const roleIds = data.roleAssignments
    .filter((a) => a.userId === userId)
    .map((a) => a.roleId);
  return data.roles.filter(
    (r) => r.productionId === productionId && roleIds.includes(r.id),
  );
}

export function joinRehearsal(
  data: AppData,
  rehearsalId: string,
  userId: string,
  roleId?: string | null,
): AppData {
  const rehearsal = data.rehearsals.find((r) => r.id === rehearsalId);
  if (!rehearsal) throw new Error("연습을 찾을 수 없습니다.");
  if (rehearsal.participantIds.includes(userId)) return data;

  const roles = getUserRolesInProduction(data, rehearsal.productionId, userId);
  let resolvedRoleId: string | null;
  if (roleId !== undefined) {
    if (roleId !== null && !roles.some((r) => r.id === roleId)) {
      throw new Error("선택한 배역이 올바르지 않습니다.");
    }
    resolvedRoleId = roleId;
  } else if (roles.length === 0) {
    resolvedRoleId = null;
  } else if (roles.length === 1) {
    resolvedRoleId = roles[0].id;
  } else {
    throw new Error("배역을 선택해주세요.");
  }

  return {
    ...data,
    rehearsals: data.rehearsals.map((r) =>
      r.id === rehearsalId
        ? {
            ...r,
            participantIds: [...r.participantIds, userId],
            participantRoles: {
              ...(r.participantRoles ?? {}),
              [userId]: resolvedRoleId,
            },
          }
        : r,
    ),
  };
}

export function leaveRehearsal(
  data: AppData,
  rehearsalId: string,
  userId: string,
): { data: AppData; deleted: boolean } {
  const rehearsal = data.rehearsals.find((r) => r.id === rehearsalId);
  if (!rehearsal) return { data, deleted: false };

  const remaining = (rehearsal.participantIds ?? []).filter((id) => id !== userId);
  if (remaining.length === 0) {
    return {
      data: {
        ...data,
        rehearsals: data.rehearsals.filter((r) => r.id !== rehearsalId),
      },
      deleted: true,
    };
  }

  const participantRoles = { ...(rehearsal.participantRoles ?? {}) };
  delete participantRoles[userId];
  const participantNotes = { ...(rehearsal.participantNotes ?? {}) };
  delete participantNotes[userId];

  return {
    data: {
      ...data,
      rehearsals: data.rehearsals.map((r) =>
        r.id === rehearsalId
          ? {
              ...r,
              participantIds: remaining,
              participantRoles,
              participantNotes,
            }
          : r,
      ),
    },
    deleted: false,
  };
}

export function setRehearsalPlace(
  data: AppData,
  rehearsalId: string,
  place: string,
): AppData {
  return updateRehearsal(data, rehearsalId, { place: place.trim() });
}

export function setParticipantNote(
  data: AppData,
  rehearsalId: string,
  userId: string,
  note: string,
): AppData {
  const rehearsal = data.rehearsals.find((r) => r.id === rehearsalId);
  if (!rehearsal) throw new Error("연습을 찾을 수 없습니다.");
  if (!(rehearsal.participantIds ?? []).includes(userId)) {
    throw new Error("참석자만 메모를 남길 수 있습니다.");
  }
  const text = note.trim();
  const participantNotes = { ...(rehearsal.participantNotes ?? {}) };
  if (text) participantNotes[userId] = text;
  else delete participantNotes[userId];
  return updateRehearsal(data, rehearsalId, { participantNotes });
}

function resolveParticipantRoleId(
  data: AppData,
  rehearsal: Rehearsal,
  userId: string,
): string | null {
  const stored = rehearsal.participantRoles?.[userId];
  if (stored !== undefined) return stored;

  const ensemble = rehearsal.ensembleId
    ? data.castEnsembles.find((e) => e.id === rehearsal.ensembleId)
    : null;
  const slot = ensemble?.slots.find((s) => s.userId === userId);
  if (slot) return slot.roleId;

  const roles = getUserRolesInProduction(data, rehearsal.productionId, userId);
  if (roles.length === 1) return roles[0].id;
  return null;
}

/** 참가자 표시: `이름(배역)` (배역 없으면 이름만) */
export function getRehearsalParticipantLabels(
  data: AppData,
  rehearsal: Rehearsal,
): string[] {
  return (rehearsal.participantIds ?? []).map((userId) => {
    const name = data.users.find((u) => u.id === userId)?.name ?? "?";
    const roleId = resolveParticipantRoleId(data, rehearsal, userId);
    if (!roleId) return name;
    const roleName = data.roles.find((r) => r.id === roleId)?.name;
    return roleName ? `${name}(${roleName})` : name;
  });
}

/** 권한에 따라 볼 수 있는 작품 목록 */
export function getVisibleProductions(data: AppData, user: User): Production[] {
  if (isAdmin(user.role)) return data.productions;
  const ids = new Set(
    data.productionMembers
      .filter((m) => m.userId === user.id)
      .map((m) => m.productionId),
  );
  return data.productions.filter((p) => ids.has(p.id));
}

export function getUserById(data: AppData, id: string): User | undefined {
  return data.users.find((u) => u.id === id);
}

export function getActorsForRole(data: AppData, roleId: string): User[] {
  const userIds = data.roleAssignments
    .filter((a) => a.roleId === roleId)
    .map((a) => a.userId);
  return data.users.filter((u) => userIds.includes(u.id));
}

export function getRolesForUser(
  data: AppData,
  userId: string,
  productionId?: string,
): CastRole[] {
  const roleIds = data.roleAssignments
    .filter((a) => a.userId === userId)
    .map((a) => a.roleId);
  return data.roles.filter(
    (r) =>
      roleIds.includes(r.id) &&
      (!productionId || r.productionId === productionId),
  );
}
