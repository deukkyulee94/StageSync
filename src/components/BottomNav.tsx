"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "홈", icon: HomeIcon },
  { href: "/productions", label: "작품", icon: StageIcon },
  { href: "/availability", label: "일정", icon: CalIcon },
  { href: "/actors", label: "배우", icon: PeopleIcon },
  { href: "/profile", label: "나", icon: UserIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="bottom-nav fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-[var(--line)]"
      style={{ paddingBottom: "var(--safe-bottom)" }}
      aria-label="하단 메뉴"
    >
      <ul className="grid grid-cols-5 px-1 pt-1" style={{ height: "var(--nav-h)" }}>
        {ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex h-full flex-col items-center justify-center gap-0.5 text-[0.68rem] font-semibold transition-colors ${
                  active ? "text-[var(--accent)]" : "text-[var(--ink-muted)]"
                }`}
              >
                <Icon active={active} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke={active ? "var(--accent)" : "currentColor"}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StageIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 19h18M5 19V9l7-4 7 4v10M9 19v-4h6v4"
        stroke={active ? "var(--accent)" : "currentColor"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3.5"
        y="5"
        width="17"
        height="15"
        rx="2"
        stroke={active ? "var(--accent)" : "currentColor"}
        strokeWidth="1.8"
      />
      <path
        d="M8 3.5v3M16 3.5v3M3.5 10h17"
        stroke={active ? "var(--accent)" : "currentColor"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PeopleIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="9"
        cy="9"
        r="3"
        stroke={active ? "var(--accent)" : "currentColor"}
        strokeWidth="1.8"
      />
      <circle
        cx="16.5"
        cy="10"
        r="2.5"
        stroke={active ? "var(--accent)" : "currentColor"}
        strokeWidth="1.8"
      />
      <path
        d="M3.5 19c.8-2.6 2.8-4 5.5-4s4.7 1.4 5.5 4M13.5 15.2c1.4-.4 2.9-.2 4.2.8"
        stroke={active ? "var(--accent)" : "currentColor"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12"
        cy="9"
        r="3.5"
        stroke={active ? "var(--accent)" : "currentColor"}
        strokeWidth="1.8"
      />
      <path
        d="M5 19.5c1.2-3 3.5-4.5 7-4.5s5.8 1.5 7 4.5"
        stroke={active ? "var(--accent)" : "currentColor"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
