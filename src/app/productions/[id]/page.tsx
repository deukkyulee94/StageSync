"use client";

import Link from "next/link";
import { FormEvent, use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import * as repo from "@/lib/data/repository";
import {
  JoinRehearsalControls,
  RehearsalCompleteControls,
  RehearsalInfoBlock,
  RehearsalInfoEditor,
  RehearsalParticipantBlock,
  RehearsalShareButton,
} from "@/components/RehearsalParticipants";
import { isRehearsalListVisible, isUserInRehearsal } from "@/lib/recommend";
import { isAdmin } from "@/types";

type Tab = "roles" | "teams" | "ensembles" | "members" | "rehearsals";

export default function ProductionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data, user, setData } = useApp();
  const [tab, setTab] = useState<Tab>("roles");
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [trackName, setTrackName] = useState("");
  const [ensembleName, setEnsembleName] = useState("");
  const [draftSlots, setDraftSlots] = useState<
    { roleId: string; userId: string }[]
  >([]);
  const [slotRoleId, setSlotRoleId] = useState("");
  const [slotUserId, setSlotUserId] = useState("");
  const [alternateId, setAlternateId] = useState("");
  const [editingEnsembleId, setEditingEnsembleId] = useState<string | null>(null);
  const [editEnsembleName, setEditEnsembleName] = useState("");
  const [editSlots, setEditSlots] = useState<{ roleId: string; userId: string }[]>([]);
  const [editSlotRoleId, setEditSlotRoleId] = useState("");
  const [editSlotUserId, setEditSlotUserId] = useState("");
  const [editAlternateId, setEditAlternateId] = useState("");
  const [assignTrackId, setAssignTrackId] = useState("");
  const [teamAddRoleId, setTeamAddRoleId] = useState("");
  const [teamAddUserId, setTeamAddUserId] = useState("");
  const [teamAddTargetId, setTeamAddTargetId] = useState("");
  const [error, setError] = useState("");

  const production = data.productions.find((p) => p.id === id);
  const roles = useMemo(
    () => data.roles.filter((r) => r.productionId === id),
    [data.roles, id],
  );
  const tracks = useMemo(
    () => data.tracks.filter((t) => t.productionId === id),
    [data.tracks, id],
  );
  const ensembles = useMemo(
    () => data.castEnsembles.filter((e) => e.productionId === id),
    [data.castEnsembles, id],
  );
  const members = useMemo(
    () =>
      data.productionMembers
        .filter((m) => m.productionId === id)
        .map((m) => data.users.find((u) => u.id === m.userId))
        .filter(Boolean),
    [data.productionMembers, data.users, id],
  );
  const rehearsals = useMemo(
    () =>
      data.rehearsals
        .filter(
          (r) => r.productionId === id && isRehearsalListVisible(r.date),
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.rehearsals, id],
  );

  if (!user) return null;
  if (!production) {
    return (
      <div className="space-y-4">
        <p>작품을 찾을 수 없습니다.</p>
        <Link href="/productions" className="btn btn-ghost">
          목록으로
        </Link>
      </div>
    );
  }

  const canManage = isAdmin(user.role);
  const visible = repo.getVisibleProductions(data, user).some((p) => p.id === id);
  if (!visible) {
    return <p className="text-[var(--danger)]">접근 권한이 없습니다.</p>;
  }

  function onAddRole(e: FormEvent) {
    e.preventDefault();
    setError("");
    setData((prev) =>
      repo.createRole(prev, {
        productionId: id,
        name: roleName,
        description: roleDesc,
      }),
    );
    setRoleName("");
    setRoleDesc("");
  }

  function assign(roleId: string, userId: string, trackId?: string | null) {
    if (!userId) return;
    setData((prev) =>
      repo.assignActorToRole(
        prev,
        roleId,
        userId,
        trackId !== undefined ? trackId : assignTrackId || null,
      ),
    );
  }

  function changeAssignmentTrack(
    roleId: string,
    userId: string,
    trackId: string | null,
  ) {
    setError("");
    try {
      setData((prev) =>
        repo.setAssignmentTrack(prev, roleId, userId, trackId),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "팀 배정 실패");
    }
  }

  function addToTeam(trackId: string) {
    setError("");
    if (!teamAddRoleId || !teamAddUserId) {
      setError("배역과 배우를 선택해주세요.");
      return;
    }
    try {
      setData((prev) =>
        repo.assignActorToRole(prev, teamAddRoleId, teamAddUserId, trackId),
      );
      setTeamAddRoleId("");
      setTeamAddUserId("");
      setTeamAddTargetId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "팀 배정 실패");
    }
  }

  function removeFromTeam(roleId: string, userId: string) {
    setData((prev) => repo.setAssignmentTrack(prev, roleId, userId, null));
  }

  function unassign(roleId: string, userId: string) {
    setData((prev) => repo.unassignActorFromRole(prev, roleId, userId));
  }

  function addMember(userId: string) {
    if (!userId) return;
    setData((prev) => repo.addProductionMember(prev, id, userId));
  }

  function removeMember(userId: string) {
    setData((prev) => repo.removeProductionMember(prev, id, userId));
  }

  function confirmRehearsal(rehearsalId: string) {
    setData((prev) =>
      repo.updateRehearsal(prev, rehearsalId, {
        status: "confirmed",
        adminConfirmed: true,
      }),
    );
  }

  function deleteRehearsal(rehearsalId: string, label: string) {
    if (!confirm(`"${label}" 연습을 삭제할까요?`)) return;
    setData((prev) => repo.deleteRehearsal(prev, rehearsalId));
  }

  function joinRehearsal(rehearsalId: string, roleId?: string | null) {
    try {
      setData((prev) => repo.joinRehearsal(prev, rehearsalId, user!.id, roleId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "참석 실패");
    }
  }

  function leaveRehearsal(rehearsalId: string) {
    if (!confirm("참석을 취소할까요?")) return;
    let deleted = false;
    setData((prev) => {
      const result = repo.leaveRehearsal(prev, rehearsalId, user!.id);
      deleted = result.deleted;
      return result.data;
    });
    if (deleted) {
      alert("참석자가 없어 연습 일정이 삭제되었습니다.");
    }
  }

  function saveRehearsalInfo(
    rehearsalId: string,
    patch: { place: string; myNote: string },
  ) {
    try {
      setData((prev) => {
        let next = repo.setRehearsalPlace(prev, rehearsalId, patch.place);
        next = repo.setParticipantNote(
          next,
          rehearsalId,
          user!.id,
          patch.myNote,
        );
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    }
  }

  function completeRehearsal(rehearsalId: string, note: string) {
    try {
      setData((prev) => repo.markRehearsalDone(prev, rehearsalId, note));
    } catch (err) {
      setError(err instanceof Error ? err.message : "완료 처리 실패");
    }
  }

  function reopenRehearsal(rehearsalId: string) {
    if (!confirm("완료를 취소하고 확정 일정으로 되돌릴까요?")) return;
    try {
      setData((prev) => repo.reopenRehearsal(prev, rehearsalId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "되돌리기 실패");
    }
  }

  function onDeleteProduction() {
    if (
      !confirm(
        `"${production!.title}" 작품을 삭제할까요?\n배역·팀·연습 유닛·일정도 함께 삭제됩니다.`,
      )
    ) {
      return;
    }
    setData((prev) => repo.deleteProduction(prev, id));
    router.replace("/productions");
  }

  function onAddTrack(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      setData((prev) =>
        repo.createTrack(prev, { productionId: id, name: trackName }),
      );
      setTrackName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "팀 생성 실패");
    }
  }

  function makeEnsembleFromTrack(trackId: string) {
    setError("");
    try {
      const other = tracks.find((t) => t.id !== trackId);
      setData((prev) =>
        repo.createEnsembleFromTrack(
          prev,
          id,
          trackId,
          undefined,
          other?.id ?? null,
        ),
      );
      setTab("ensembles");
    } catch (err) {
      setError(err instanceof Error ? err.message : "연습 유닛 생성 실패");
    }
  }

  function addDraftSlot() {
    if (!slotRoleId || !slotUserId) return;
    if (draftSlots.some((s) => s.roleId === slotRoleId && s.userId === slotUserId)) {
      return;
    }
    setDraftSlots((prev) => [
      ...prev,
      { roleId: slotRoleId, userId: slotUserId },
    ]);
    setSlotUserId("");
  }

  function onAddEnsemble(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      setData((prev) =>
        repo.createCastEnsemble(prev, {
          productionId: id,
          name: ensembleName,
          slots: draftSlots,
          alternateEnsembleId: alternateId || null,
        }),
      );
      setEnsembleName("");
      setDraftSlots([]);
      setAlternateId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    }
  }

  function startEditEnsemble(ensembleId: string) {
    const target = ensembles.find((ensemble) => ensemble.id === ensembleId);
    if (!target) return;
    setEditingEnsembleId(ensembleId);
    setEditEnsembleName(target.name);
    setEditSlots(target.slots);
    setEditSlotRoleId("");
    setEditSlotUserId("");
    setEditAlternateId(target.alternateEnsembleId ?? "");
    setError("");
  }

  function cancelEditEnsemble() {
    setEditingEnsembleId(null);
    setEditEnsembleName("");
    setEditSlots([]);
    setEditSlotRoleId("");
    setEditSlotUserId("");
    setEditAlternateId("");
  }

  function addEditSlot() {
    if (!editSlotRoleId || !editSlotUserId) return;
    if (editSlots.some((slot) => slot.roleId === editSlotRoleId && slot.userId === editSlotUserId)) {
      return;
    }
    setEditSlots((prev) => [...prev, { roleId: editSlotRoleId, userId: editSlotUserId }]);
    setEditSlotUserId("");
  }

  function onEditEnsemble(e: FormEvent) {
    e.preventDefault();
    if (!editingEnsembleId) return;
    setError("");
    try {
      setData((prev) =>
        repo.updateCastEnsemble(prev, editingEnsembleId, {
          name: editEnsembleName,
          slots: editSlots,
          alternateEnsembleId: editAlternateId || null,
        }),
      );
      cancelEditEnsemble();
    } catch (err) {
      setError(err instanceof Error ? err.message : "장면 수정 실패");
    }
  }

  const actorsForSlotRole = slotRoleId
    ? data.roleAssignments
        .filter((a) => a.roleId === slotRoleId)
        .map((a) => data.users.find((u) => u.id === a.userId))
        .filter(Boolean)
    : [];

  const actorsForEditSlotRole = editSlotRoleId
    ? data.roleAssignments
        .filter((a) => a.roleId === editSlotRoleId)
        .map((a) => data.users.find((u) => u.id === a.userId))
        .filter(Boolean)
    : [];

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/productions"
          className="text-sm font-semibold text-[var(--forest)]"
        >
          ← 작품 목록
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-3xl">{production.title}</h1>
          </div>
          {canManage && (
            <button
              type="button"
              className="shrink-0 text-sm font-semibold text-[var(--danger)]"
              onClick={onDeleteProduction}
            >
              삭제
            </button>
          )}
        </div>
      </div>

      <Link
        href={`/recommend?productionId=${id}`}
        className="btn btn-secondary w-full"
      >
        이 작품 연습 일정 잡기
      </Link>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--line)] bg-white/70 p-1">
        {(
          [
            ["roles", "배역"],
            ["teams", "팀"],
            ["ensembles", "장면"],
            ["members", "멤버"],
            ["rehearsals", "연습"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`shrink-0 flex-1 rounded-lg px-2 py-2 text-sm font-semibold ${
              tab === key
                ? "bg-[var(--forest)] text-white"
                : "text-[var(--ink-muted)]"
            }`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      {tab === "roles" && (
        <div className="space-y-4">
          {canManage && (
            <form onSubmit={onAddRole} className="card-panel space-y-3 p-4">
              <p className="font-semibold">배역 등록</p>
              <div className="field">
                <label>배역명</label>
                <input
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>설명</label>
                <input
                  value={roleDesc}
                  onChange={(e) => setRoleDesc(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-soft w-full">
                배역 추가
              </button>
            </form>
          )}

          {canManage && tracks.length > 0 && (
            <div className="field">
              <label>배우 연결 시 기본 팀</label>
              <select
                value={assignTrackId}
                onChange={(e) => setAssignTrackId(e.target.value)}
              >
                <option value="">팀 미지정</option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                팀 탭에서도 배역할 수 있습니다.
              </p>
            </div>
          )}

          <ul className="space-y-3">
            {roles.map((role) => {
              const assignments = data.roleAssignments.filter(
                (a) => a.roleId === role.id,
              );
              return (
                <li key={role.id} className="card-panel p-4">
                  <p className="font-semibold text-lg">{role.name}</p>
                  <p className="text-sm text-[var(--ink-muted)]">
                    {role.description || "설명 없음"}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {assignments.length === 0 && (
                      <li className="text-sm text-[var(--ink-muted)]">
                        배우 없음
                      </li>
                    )}
                    {assignments.map((a) => {
                      const actor = data.users.find((u) => u.id === a.userId);
                      return (
                        <li
                          key={a.id}
                          className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2"
                        >
                          <span className="font-semibold text-sm">
                            {actor?.name ?? "?"}
                          </span>
                          {canManage ? (
                            <>
                              <select
                                className="min-h-9 flex-1 rounded-lg border border-[var(--line)] bg-white px-2 text-sm"
                                value={a.trackId ?? ""}
                                onChange={(e) =>
                                  changeAssignmentTrack(
                                    role.id,
                                    a.userId,
                                    e.target.value || null,
                                  )
                                }
                              >
                                <option value="">팀 미지정</option>
                                {tracks.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="text-sm font-semibold text-[var(--danger)]"
                                onClick={() => unassign(role.id, a.userId)}
                              >
                                해제
                              </button>
                            </>
                          ) : (
                            <span className="chip">
                              {tracks.find((t) => t.id === a.trackId)?.name ??
                                "팀 미지정"}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {canManage && (
                    <div className="mt-3 field">
                      <label>배우 연결</label>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          assign(role.id, e.target.value);
                          e.target.value = "";
                        }}
                      >
                        <option value="">선택</option>
                        {data.users
                          .filter(
                            (u) => u.role === "actor" || isAdmin(u.role),
                          )
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tab === "teams" && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--ink-muted)]">
            A/B팀 더블캐스트용(완벽한 타인/도덕적 도둑 케이스)입니다. <br />팀에 배역·배우를 배정한 뒤 연습 유닛을
            만드세요.
          </p>
          {canManage && (
            <form onSubmit={onAddTrack} className="card-panel space-y-3 p-4">
              <div className="field">
                <label>팀 이름</label>
                <input
                  value={trackName}
                  onChange={(e) => setTrackName(e.target.value)}
                  placeholder="A팀"
                  required
                />
              </div>
              <button type="submit" className="btn btn-soft w-full">
                팀 추가
              </button>
            </form>
          )}
          <ul className="space-y-3">
            {tracks.map((t) => {
              const teamAssignments = data.roleAssignments.filter(
                (a) => a.trackId === t.id,
              );
              const actorOptions = data.users.filter(
                (u) => u.role === "actor" || isAdmin(u.role),
              );

              return (
                <li key={t.id} className="card-panel space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{t.name}</p>
                      <p className="text-xs text-[var(--ink-muted)]">
                        배정 {teamAssignments.length}명
                      </p>
                    </div>
                    {canManage && (
                      <button
                        type="button"
                        className="text-sm font-semibold text-[var(--danger)]"
                        onClick={() =>
                          setData((prev) => repo.deleteTrack(prev, t.id))
                        }
                      >
                        팀 삭제
                      </button>
                    )}
                  </div>

                  <ul className="space-y-1.5">
                    {teamAssignments.length === 0 && (
                      <li className="text-sm text-[var(--ink-muted)]">
                        아직 배정된 인원이 없습니다. 아래에서 추가하세요.
                      </li>
                    )}
                    {teamAssignments.map((a) => {
                      const role = roles.find((r) => r.id === a.roleId);
                      const actor = data.users.find((u) => u.id === a.userId);
                      return (
                        <li
                          key={a.id}
                          className="flex items-center justify-between rounded-lg bg-[var(--bg)] px-3 py-2 text-sm"
                        >
                          <span>
                            <span className="font-semibold">{role?.name}</span>
                            {" · "}
                            {actor?.name}
                          </span>
                          {canManage && (
                            <button
                              type="button"
                              className="font-semibold text-[var(--danger)]"
                              onClick={() =>
                                removeFromTeam(a.roleId, a.userId)
                              }
                            >
                              제외
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {canManage && (
                    <div className="space-y-2 rounded-xl border border-dashed border-[var(--line)] p-3">
                      <p className="text-xs font-semibold text-[var(--ink-muted)]">
                        이 팀에 배정
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="field">
                          <label>배역</label>
                          <select
                            value={
                              teamAddTargetId === t.id ? teamAddRoleId : ""
                            }
                            onChange={(e) => {
                              setTeamAddTargetId(t.id);
                              setTeamAddRoleId(e.target.value);
                              setTeamAddUserId("");
                            }}
                          >
                            <option value="">선택</option>
                            {roles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label>배우</label>
                          <select
                            value={
                              teamAddTargetId === t.id ? teamAddUserId : ""
                            }
                            onChange={(e) => {
                              setTeamAddTargetId(t.id);
                              setTeamAddUserId(e.target.value);
                            }}
                          >
                            <option value="">선택</option>
                            {(teamAddTargetId === t.id && teamAddRoleId
                              ? actorOptions
                              : []
                            ).map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <p className="text-[0.7rem] text-[var(--ink-muted)]">
                        배역에 아직 없는 배우면 자동으로 배역에도 연결됩니다.
                        배역 탭에서 먼저 연결해 두면 선택이 쉬워집니다.
                      </p>
                      <button
                        type="button"
                        className="btn btn-ghost w-full !min-h-10 text-sm"
                        disabled={
                          teamAddTargetId !== t.id ||
                          !teamAddRoleId ||
                          !teamAddUserId
                        }
                        onClick={() => addToTeam(t.id)}
                      >
                        팀에 추가
                      </button>
                    </div>
                  )}

                  {canManage && (
                    <button
                      type="button"
                      className="btn btn-secondary w-full"
                      disabled={teamAssignments.length === 0}
                      onClick={() => makeEnsembleFromTrack(t.id)}
                    >
                      {teamAssignments.length === 0
                        ? "배정 후 연습 유닛 만들기"
                        : "이 팀으로 연습 유닛 만들기"}
                    </button>
                  )}
                </li>
              );
            })}
            {tracks.length === 0 && (
              <li className="text-sm text-[var(--ink-muted)]">
                등록된 팀이 없습니다.
              </li>
            )}
          </ul>
        </div>
      )}

      {tab === "ensembles" && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--ink-muted)]">
            장면·페어 연습 유닛(죽음 혹은 아님/올모스트 메인 케이스)입니다. <br />배역+배우 슬롯으로 확정 라인업을
            만듭니다.
          </p>
          {canManage && (
            <form onSubmit={onAddEnsemble} className="card-panel space-y-3 p-4">
              <p className="font-semibold">연습 유닛 등록</p>
              <div className="field">
                <label>이름</label>
                <input
                  value={ensembleName}
                  onChange={(e) => setEnsembleName(e.target.value)}
                  placeholder="1장 캐스트1"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="field">
                  <label>배역</label>
                  <select
                    value={slotRoleId}
                    onChange={(e) => {
                      setSlotRoleId(e.target.value);
                      setSlotUserId("");
                    }}
                  >
                    <option value="">선택</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>배우</label>
                  <select
                    value={slotUserId}
                    onChange={(e) => setSlotUserId(e.target.value)}
                  >
                    <option value="">선택</option>
                    {actorsForSlotRole.map((u) => (
                      <option key={u!.id} value={u!.id}>
                        {u!.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost w-full"
                onClick={addDraftSlot}
                disabled={!slotRoleId || !slotUserId}
              >
                슬롯 추가
              </button>
              {draftSlots.length > 0 && (
                <ul className="space-y-1">
                  {draftSlots.map((s, i) => (
                    <li
                      key={`${s.roleId}-${s.userId}-${i}`}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>
                        {roles.find((r) => r.id === s.roleId)?.name} ·{" "}
                        {data.users.find((u) => u.id === s.userId)?.name}
                      </span>
                      <button
                        type="button"
                        className="text-[var(--danger)]"
                        onClick={() =>
                          setDraftSlots((prev) =>
                            prev.filter((_, idx) => idx !== i),
                          )
                        }
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="field">
                <label>반대 캐스트 (alternate)</label>
                <select
                  value={alternateId}
                  onChange={(e) => setAlternateId(e.target.value)}
                >
                  <option value="">없음</option>
                  {ensembles.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="btn btn-soft w-full"
                disabled={draftSlots.length < 1}
              >
                연습 유닛 저장
              </button>
            </form>
          )}

          <ul className="space-y-2">
            {ensembles.map((e) => {
              const alt = ensembles.find((x) => x.id === e.alternateEnsembleId);
              const isEditing = editingEnsembleId === e.id;
              return (
                <li key={e.id} className="card-panel p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{e.name}</p>
                      <ul className="mt-2 space-y-0.5 text-sm text-[var(--ink-muted)]">
                        {e.slots.map((s) => (
                          <li key={`${s.roleId}-${s.userId}`}>
                            {roles.find((r) => r.id === s.roleId)?.name} ·{" "}
                            {data.users.find((u) => u.id === s.userId)?.name}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="chip">{e.slots.length}인</span>
                        {alt && <span className="chip">↔ {alt.name}</span>}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex gap-3">
                        <button
                          type="button"
                          className="text-sm font-semibold text-[var(--forest)]"
                          onClick={() =>
                            isEditing ? cancelEditEnsemble() : startEditEnsemble(e.id)
                          }
                        >
                          {isEditing ? "취소" : "수정"}
                        </button>
                        <button
                          type="button"
                          className="text-sm font-semibold text-[var(--danger)]"
                          onClick={() =>
                            setData((prev) =>
                              repo.deleteCastEnsemble(prev, e.id),
                            )
                          }
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                  {canManage && isEditing && (
                    <form onSubmit={onEditEnsemble} className="mt-4 space-y-3 border-t border-black/5 pt-4">
                      <div className="field">
                        <label>장면 이름</label>
                        <input
                          value={editEnsembleName}
                          onChange={(event) => setEditEnsembleName(event.target.value)}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="field">
                          <label>배역</label>
                          <select
                            value={editSlotRoleId}
                            onChange={(event) => {
                              setEditSlotRoleId(event.target.value);
                              setEditSlotUserId("");
                            }}
                          >
                            <option value="">선택</option>
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label>배우</label>
                          <select
                            value={editSlotUserId}
                            onChange={(event) => setEditSlotUserId(event.target.value)}
                          >
                            <option value="">선택</option>
                            {actorsForEditSlotRole.map((actor) => (
                              <option key={actor!.id} value={actor!.id}>
                                {actor!.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost w-full"
                        onClick={addEditSlot}
                        disabled={!editSlotRoleId || !editSlotUserId}
                      >
                        슬롯 추가
                      </button>
                      {editSlots.length > 0 && (
                        <ul className="space-y-1">
                          {editSlots.map((slot, index) => (
                            <li
                              key={`${slot.roleId}-${slot.userId}-${index}`}
                              className="flex items-center justify-between text-sm"
                            >
                              <span>
                                {roles.find((role) => role.id === slot.roleId)?.name} ·{" "}
                                {data.users.find((member) => member.id === slot.userId)?.name}
                              </span>
                              <button
                                type="button"
                                className="text-[var(--danger)]"
                                onClick={() =>
                                  setEditSlots((prev) =>
                                    prev.filter((_, slotIndex) => slotIndex !== index),
                                  )
                                }
                              >
                                ×
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="field">
                        <label>반대 캐스트 (alternate)</label>
                        <select
                          value={editAlternateId}
                          onChange={(event) => setEditAlternateId(event.target.value)}
                        >
                          <option value="">없음</option>
                          {ensembles
                            .filter((ensemble) => ensemble.id !== e.id)
                            .map((ensemble) => (
                              <option key={ensemble.id} value={ensemble.id}>
                                {ensemble.name}
                              </option>
                            ))}
                        </select>
                      </div>
                      <button
                        type="submit"
                        className="btn btn-soft w-full"
                        disabled={editSlots.length < 1}
                      >
                        장면 수정 저장
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
            {ensembles.length === 0 && (
              <li className="text-sm text-[var(--ink-muted)]">
                등록된 연습 유닛이 없습니다. 팀 탭에서 만들거나 여기서
                추가하세요.
              </li>
            )}
          </ul>
        </div>
      )}

      {tab === "members" && (
        <div className="space-y-4">
          {canManage && (
            <div className="card-panel p-4">
              <div className="field">
                <label>멤버 추가</label>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    addMember(e.target.value);
                    e.target.value = "";
                  }}
                >
                  <option value="">선택</option>
                  {data.users
                    .filter((u) => !members.some((m) => m!.id === u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}
          <ul className="space-y-2">
            {members.map((m) => {
              if (!m) return null;
              const userRoles = repo.getRolesForUser(data, m.id, id);
              return (
                <li
                  key={m.id}
                  className="card-panel flex items-center justify-between p-4"
                >
                  <div>
                    <p className="font-semibold">{m.name}</p>
                    <p className="text-xs text-[var(--ink-muted)]">
                      {userRoles.map((r) => r.name).join(", ") || "배역 미배정"}
                    </p>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      className="text-sm font-semibold text-[var(--danger)]"
                      onClick={() => removeMember(m.id)}
                    >
                      제거
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tab === "rehearsals" && (
        <ul className="space-y-2">
          {rehearsals.length === 0 && (
            <li className="card-panel p-4 text-sm text-[var(--ink-muted)]">
              등록된 연습이 없습니다.
            </li>
          )}
          {rehearsals.map((r) => {
            const label = `${r.locationNote || "연습"} · ${r.date}`;
            return (
            <li key={r.id} className="card-panel space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {r.date} {r.startTime}–{r.endTime}
                  </p>
                  <p className="mt-1 text-sm text-[var(--ink-muted)]">
                    {r.locationNote}
                  </p>
                  <div className="mt-2">
                    <RehearsalParticipantBlock data={data} rehearsal={r} />
                  </div>
                  <div className="mt-2">
                    <RehearsalInfoBlock data={data} rehearsal={r} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="chip">
                      {r.requiresAdmin ? "단장/연출 필요" : "배우만 연습"}
                    </span>
                    {(r.participantIds?.length ?? 0) > 0 && (
                      <span className="chip chip-accent">
                        {r.participantIds.length}명
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="chip">
                    {r.status === "proposed"
                      ? "제안"
                      : r.status === "confirmed"
                        ? "확정"
                        : r.status}
                  </span>
                  {(canManage || isUserInRehearsal(r, user.id)) &&
                    r.status !== "done" && (
                    <button
                      type="button"
                      className="text-sm font-semibold text-[var(--danger)]"
                      onClick={() => deleteRehearsal(r.id, label)}
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
              <RehearsalInfoEditor
                rehearsal={r}
                user={user}
                onSave={(patch) => saveRehearsalInfo(r.id, patch)}
              />
              <RehearsalShareButton data={data} rehearsal={r} />
              <JoinRehearsalControls
                data={data}
                rehearsal={r}
                user={user}
                onJoin={(roleId) => joinRehearsal(r.id, roleId)}
                onLeave={() => leaveRehearsal(r.id)}
              />
              <RehearsalCompleteControls
                rehearsal={r}
                user={user}
                onComplete={(note) => completeRehearsal(r.id, note)}
                onReopen={() => reopenRehearsal(r.id)}
              />
              {canManage && r.status === "proposed" && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={r.requiresAdmin}
                      onChange={(e) =>
                        setData((prev) =>
                          repo.updateRehearsal(prev, r.id, {
                            requiresAdmin: e.target.checked,
                          }),
                        )
                      }
                    />
                    단장/연출 참석 필요로 변경
                  </label>
                  <button
                    type="button"
                    className="btn btn-primary w-full"
                    onClick={() => confirmRehearsal(r.id)}
                  >
                    연습 확정
                  </button>
                </div>
              )}
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
