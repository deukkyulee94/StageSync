/** 유저 권한: 배우(일반) / 단장·연출(관리자) / 시스템관리자 */
export type UserRole = "actor" | "director" | "producer" | "sysadmin";

export type DayOfWeek =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

export interface SubwayStation {
  id: string;
  name: string;
  line: string;
  lat: number;
  lng: number;
  hasPracticeRoom: boolean;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  pin: string;
  role: UserRole;
  homeStationId: string | null;
  workStationId: string | null;
  createdAt: string;
}

export interface Production {
  id: string;
  title: string;
  description: string;
  status: "planning" | "rehearsing" | "performing" | "archived";
  createdAt: string;
}

export interface ProductionMember {
  id: string;
  productionId: string;
  userId: string;
}

/** A팀/B팀 등 더블캐스팅 트랙 */
export interface ProductionTrack {
  id: string;
  productionId: string;
  name: string;
}

export interface CastRole {
  id: string;
  productionId: string;
  name: string;
  description: string;
  /** 하위 호환용 1:1 페어 */
  pairRoleId: string | null;
}

/** 하위 호환 — 신규 UI는 CastEnsemble 사용 */
export interface CastGroup {
  id: string;
  productionId: string;
  name: string;
  roleIds: string[];
}

/** 연습 유닛의 확정 라인업 슬롯 */
export interface EnsembleSlot {
  roleId: string;
  userId: string;
}

/**
 * 연습 일정 산출의 원자 단위.
 * CASE1 팀 전체 / CASE2 장면 캐스트 모두 이 구조로 표현.
 */
export interface CastEnsemble {
  id: string;
  productionId: string;
  name: string;
  slots: EnsembleSlot[];
  /** `/` 반대편 캐스트 */
  alternateEnsembleId: string | null;
  /** @deprecated 추천 시점에 선택. 하위 호환용 필드 */
  allowRoleSubstitute?: boolean;
}

export interface RoleAssignment {
  id: string;
  roleId: string;
  userId: string;
  /** CASE1: A팀/B팀. CASE2는 null 가능 */
  trackId: string | null;
}

export interface AvailabilitySlot {
  id: string;
  userId: string;
  productionId: string;
  date: string;
  startTime: string;
  endTime: string;
  note?: string;
  patternId?: string;
}

export interface AvailabilityPattern {
  id: string;
  userId: string;
  productionId: string;
  days: DayOfWeek[];
  startTime: string;
  endTime: string;
  note?: string;
  fromDate: string;
  toDate: string | null;
  active: boolean;
}

export interface Rehearsal {
  id: string;
  productionId: string;
  date: string;
  startTime: string;
  endTime: string;
  stationId: string;
  /** 장면명 등 요약 라벨 */
  locationNote: string;
  /** 실제 연습 장소 */
  place?: string;
  roleIds: string[];
  participantIds: string[];
  /** 참석 시 선택한 배역 (userId -> roleId). null이면 배역 없음 */
  participantRoles?: Record<string, string | null>;
  /** 참가자별 댓글/메모 (userId -> text) */
  participantNotes?: Record<string, string>;
  ensembleId?: string | null;
  requiresAdmin: boolean;
  adminConfirmed: boolean;
  status: "proposed" | "confirmed" | "cancelled" | "done";
  createdAt: string;
}

export interface AppData {
  users: User[];
  productions: Production[];
  productionMembers: ProductionMember[];
  tracks: ProductionTrack[];
  roles: CastRole[];
  castGroups: CastGroup[];
  castEnsembles: CastEnsemble[];
  roleAssignments: RoleAssignment[];
  availabilities: AvailabilitySlot[];
  availabilityPatterns: AvailabilityPattern[];
  rehearsals: Rehearsal[];
}

export const ROLE_LABELS: Record<UserRole, string> = {
  actor: "배우",
  director: "연출",
  producer: "단장",
  sysadmin: "시스템 관리자",
};

export const DAY_LABELS: Record<DayOfWeek, string> = {
  mon: "월",
  tue: "화",
  wed: "수",
  thu: "목",
  fri: "금",
  sat: "토",
  sun: "일",
};

export const DAY_INDEX: DayOfWeek[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

export function isAdmin(role: UserRole): boolean {
  return role === "director" || role === "producer" || role === "sysadmin";
}

export function isSysAdmin(role: UserRole): boolean {
  return role === "sysadmin";
}
