"use client";

import { useTheme } from "@/components/ThemeProvider";
import type { ThemePreference } from "@/lib/theme";

const LABELS: Record<ThemePreference, string> = {
  system: "시스템",
  light: "라이트",
  dark: "다크",
};

export function ThemeToggle({
  variant = "full",
}: {
  variant?: "full" | "compact";
}) {
  const { preference, setPreference, cyclePreference } = useTheme();

  if (variant === "compact") {
    return (
      <button
        type="button"
        className="btn btn-ghost shrink-0 px-3 py-1.5 text-sm"
        onClick={cyclePreference}
        aria-label={`테마: ${LABELS[preference]}`}
        title={`테마: ${LABELS[preference]}`}
      >
        {preference === "dark" ? "다크" : preference === "light" ? "라이트" : "자동"}
      </button>
    );
  }

  return (
    <div className="card-panel space-y-3 p-4">
      <div>
        <h2 className="font-semibold">화면 테마</h2>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          라이트·다크·시스템 설정을 고를 수 있습니다.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(["light", "dark", "system"] as const).map((value) => {
          const active = preference === value;
          return (
            <button
              key={value}
              type="button"
              className={`btn px-2 py-2 text-sm ${
                active ? "btn-soft" : "btn-ghost"
              }`}
              onClick={() => setPreference(value)}
              aria-pressed={active}
            >
              {LABELS[value]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
