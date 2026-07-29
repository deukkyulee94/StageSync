"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { isAdmin } from "@/types";

type GuideTab = "user" | "admin";

export default function GuidePage() {
  const { user } = useApp();
  const admin = user ? isAdmin(user.role) : false;
  const [tab, setTab] = useState<GuideTab>(admin ? "admin" : "user");

  if (!user) return null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-3xl">이용 가이드</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          로그인 후 무엇을 하면 되는지 순서대로 안내합니다
        </p>
      </header>

      {admin && (
        <div className="flex gap-1 rounded-xl border border-[var(--line)] surface-soft p-1">
          <button
            type="button"
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
              tab === "user"
                ? "bg-[var(--forest)] text-[var(--on-forest)]"
                : "text-[var(--ink-muted)]"
            }`}
            onClick={() => setTab("user")}
          >
            일반 사용자
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
              tab === "admin"
                ? "bg-[var(--forest)] text-[var(--on-forest)]"
                : "text-[var(--ink-muted)]"
            }`}
            onClick={() => setTab("admin")}
          >
            관리자
          </button>
        </div>
      )}

      {admin && tab === "admin" ? <AdminGuide /> : <UserGuide />}
    </div>
  );
}

function Step({
  n,
  title,
  children,
  href,
  linkLabel,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <li className="card-panel space-y-2 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--forest-soft)] text-sm font-bold text-[var(--forest)]">
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{title}</h3>
          <div className="mt-1 space-y-1.5 text-sm leading-relaxed text-[var(--ink-muted)]">
            {children}
          </div>
          {href && linkLabel && (
            <Link
              href={href}
              className="mt-3 inline-flex text-sm font-semibold text-[var(--accent)]"
            >
              {linkLabel} →
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

function UserGuide() {
  return (
    <section className="space-y-3 page-enter">
      <p className="text-sm text-[var(--ink-muted)]">
        배우 등 일반 사용자는 <strong className="text-[var(--ink)]">가능일 입력</strong>과{" "}
        <strong className="text-[var(--ink)]">연습 참석</strong>이 핵심입니다.
      </p>
      <ol className="space-y-2">
        <Step n={1} title="로그인" href="/login" linkLabel="로그인 화면">
          <p>휴대폰 번호와 4자리 비밀번호로 로그인합니다.</p>
          <p>처음 비밀번호는 관리자가 알려준 값을 사용하세요. (예시 : 0000)</p>
        </Step>
        <Step n={2} title="비밀번호 변경" href="/profile" linkLabel="나 탭">
          <p>
            <strong className="text-[var(--ink)]">나</strong> 탭에서 비밀번호를
            바꿔 두는 것을 권장합니다.
          </p>
        </Step>
        <Step n={3} title="가능일 입력" href="/availability" linkLabel="일정 탭">
          <p>
            <strong className="text-[var(--ink)]">일정</strong> 탭에서 연습 가능한
            날짜·시간을 입력합니다.
          </p>
          <p>연습 일정을 잡으려면 참가자들의 연습 가능일이 먼저 있어야 합니다.</p>
        </Step>
        <Step n={4} title="연습 일정 확인" href="/" linkLabel="홈">
          <p>
            <strong className="text-[var(--ink)]">홈</strong>의 연습 일정에서
            제안·확정된 연습을 확인합니다.
          </p>
          <p>어제부터의 일정만 보이며, 더 오래된 일정은 자동으로 숨겨집니다.</p>
        </Step>
        <Step n={5} title="참석하기 / 참석 취소">
          <p>
            일정 카드의 <strong className="text-[var(--ink)]">참석하기</strong>로
            본인을 참가자에 추가할 수 있습니다.
          </p>
          <p>배역이 여러 개면 참석 배역을 고른 뒤 참석합니다.</p>
          <p>
            <strong className="text-[var(--ink)]">참석 취소</strong> 시 확인 후
            빠지며, 마지막 참석자면 일정이 삭제됩니다.
          </p>
        </Step>
        <Step n={6} title="장소·메모 남기기">
          <p>
            참석 중인 일정에서{" "}
            <strong className="text-[var(--ink)]">일정 정보 입력/수정</strong>으로
            장소와 내 메모를 적을 수 있습니다.
          </p>
          <p>장소는 참석자 누구나 수정할 수 있고, 메모는 본인 것만 수정됩니다.</p>
        </Step>
        <Step n={7} title="작품 보기" href="/productions" linkLabel="작품 탭">
          <p>
            소속된 작품의 배역·장면·멤버 정보를{" "}
            <strong className="text-[var(--ink)]">작품</strong> 탭에서 확인할 수
            있습니다. (등록·수정은 관리자)
          </p>
        </Step>
      </ol>
    </section>
  );
}

function AdminGuide() {
  return (
    <section className="space-y-3 page-enter">
      <p className="text-sm text-[var(--ink-muted)]">
        단장·연출·시스템 관리자는{" "}
        <strong className="text-[var(--ink)]">작품·배역·장면 구성</strong> 후{" "}
        <strong className="text-[var(--ink)]">연습 일정을 확정</strong>합니다.
      </p>
      <ol className="space-y-2">
        <Step n={1} title="로그인" href="/login" linkLabel="로그인 화면">
          <p>관리자 계정으로 로그인합니다. 계정이 없으면 최초 관리자 생성 화면이 나옵니다.</p>
        </Step>
        <Step n={2} title="배우(사용자) 등록" href="/actors" linkLabel="배우 탭">
          <p>
            <strong className="text-[var(--ink)]">배우</strong> 탭에서 이름·휴대폰·역할을
            등록합니다.
          </p>
          <p>역할: 배우 / 연출 / 단장 / 시스템 관리자</p>
          <p>초기 비밀번호는 0000입니다. 사용자에게 로그인을 안내하세요.</p>
        </Step>
        <Step n={3} title="작품 등록" href="/productions" linkLabel="작품 탭">
          <p>
            <strong className="text-[var(--ink)]">작품</strong> → 등록에서 작품명을
            만듭니다.
          </p>
        </Step>
        <Step n={4} title="작품 세팅 (배역·팀·장면·멤버)">
          <p>작품을 열어 아래 순서로 구성합니다.</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              <strong className="text-[var(--ink)]">배역</strong>: 배역 추가 후 배우 배정
            </li>
            <li>
              <strong className="text-[var(--ink)]">팀</strong>: A/B팀 등이 있으면 구성
              (선택)
            </li>
            <li>
              <strong className="text-[var(--ink)]">장면</strong>: 연습 단위(배역+배우
              슬롯) 생성
            </li>
            <li>
              <strong className="text-[var(--ink)]">멤버</strong>: 작품에 속할 사람 추가
            </li>
          </ul>
          <Link
            href="/productions"
            className="mt-2 inline-flex text-sm font-semibold text-[var(--accent)]"
          >
            작품 목록 →
          </Link>
        </Step>
        <Step n={5} title="가능일 입력 요청" href="/availability" linkLabel="일정 탭">
          <p>배우들에게 일정 탭에서 연습 가능일을 입력해 달라고 안내합니다.</p>
          <p>관리자도 본인 연습 가능일을 입력할 수 있습니다.</p>
        </Step>
        <Step
          n={6}
          title="연습 일정 잡기"
          href="/recommend"
          linkLabel="주간 연습 일정 잡기"
        >
          <p>홈 또는 작품 상세의 일정 잡기로 이동합니다.</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>작품을 고르고 장면을 1개 이상 선택</li>
            <li>인원별 가능일 표와 겹치는 날짜 확인</li>
            <li>
              이미 잡힌 일정이 있는 날짜는 확정 버튼이 숨겨집니다
            </li>
            <li>
              <strong className="text-[var(--ink)]">확정</strong>을 누르면 바로 확정
              연습이 생성됩니다
            </li>
          </ul>
        </Step>
        <Step n={7} title="연습 관리" href="/" linkLabel="홈 연습 일정">
          <p>홈·작품 연습 탭에서 확정 일정을 확인하고 삭제할 수 있습니다.</p>
          <p>참석·장소·메모는 참석자도 직접 수정할 수 있습니다.</p>
        </Step>
      </ol>
      <div className="card-panel space-y-2 p-4 text-sm text-[var(--ink-muted)]">
        <p className="font-semibold text-[var(--ink)]">한 줄 요약</p>
        <p>
          배우 등록 → 작품·배역·장면 구성 → 가능일 받기 → 연습 일정에서 장면 선택 후
          확정
        </p>
      </div>
    </section>
  );
}
