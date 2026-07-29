"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AppData, User } from "@/types";
import * as repo from "@/lib/data/repository";
import { createEmptyData, SESSION_KEY } from "@/lib/data/store";

interface AppContextValue {
  ready: boolean;
  saving: boolean;
  dbError: string | null;
  data: AppData;
  user: User | null;
  login: (identifier: string, pin: string) => { ok: boolean; error?: string };
  logout: () => void;
  setData: (updater: (prev: AppData) => AppData) => void;
  clearAllData: () => void;
  refreshUser: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

async function fetchData(): Promise<AppData> {
  const res = await fetch("/api/data");
  const json = (await res.json()) as { data?: AppData; error?: string };
  if (!res.ok || !json.data) {
    throw new Error(json.error ?? "데이터 로드 실패");
  }
  return json.data;
}

async function putData(data: AppData): Promise<void> {
  const res = await fetch("/api/data", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  const json = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(json.error ?? "데이터 저장 실패");
}

async function clearRemote(): Promise<AppData> {
  const res = await fetch("/api/data", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clear: true }),
  });
  const json = (await res.json()) as { data?: AppData; error?: string };
  if (!res.ok || !json.data) {
    throw new Error(json.error ?? "초기화 실패");
  }
  return json.data;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [data, setDataState] = useState<AppData>(() => createEmptyData());
  const [user, setUser] = useState<User | null>(null);
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await fetchData();
        if (cancelled) return;
        setDataState(loaded);
        setDbError(null);
        try {
          const sessionId = localStorage.getItem(SESSION_KEY);
          if (sessionId) {
            setUser(loaded.users.find((u) => u.id === sessionId) ?? null);
          }
        } catch {
          /* ignore */
        }
      } catch (err) {
        if (!cancelled) {
          setDbError(err instanceof Error ? err.message : "DB 연결 실패");
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: AppData) => {
    setSaving(true);
    saveQueue.current = saveQueue.current
      .then(async () => {
        await putData(next);
        setDbError(null);
      })
      .catch((err: unknown) => {
        setDbError(err instanceof Error ? err.message : "저장 실패");
      })
      .finally(() => setSaving(false));
  }, []);

  const setData = useCallback(
    (updater: (prev: AppData) => AppData) => {
      setDataState((prev) => {
        const next = updater(prev);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const login = useCallback(
    (identifier: string, pin: string) => {
      const found = repo.login(data, identifier, pin);
      if (!found) {
        return {
          ok: false,
          error: "이름(또는 휴대폰) / 비밀번호가 올바르지 않습니다.",
        };
      }
      setUser(found);
      localStorage.setItem(SESSION_KEY, found.id);
      return { ok: true };
    },
    [data],
  );

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  }, []);

  const clearAllData = useCallback(() => {
    setSaving(true);
    clearRemote()
      .then((empty) => {
        setDataState(empty);
        setUser(null);
        localStorage.removeItem(SESSION_KEY);
        setDbError(null);
      })
      .catch((err: unknown) => {
        setDbError(err instanceof Error ? err.message : "초기화 실패");
      })
      .finally(() => setSaving(false));
  }, []);

  const refreshUser = useCallback(() => {
    if (!user) return;
    setUser(data.users.find((u) => u.id === user.id) ?? null);
  }, [data.users, user]);

  useEffect(() => {
    if (!user) return;
    const latest = data.users.find((u) => u.id === user.id);
    if (latest && latest !== user) setUser(latest);
  }, [data.users, user]);

  const value = useMemo(
    () => ({
      ready,
      saving,
      dbError,
      data,
      user,
      login,
      logout,
      setData,
      clearAllData,
      refreshUser,
    }),
    [
      ready,
      saving,
      dbError,
      data,
      user,
      login,
      logout,
      setData,
      clearAllData,
      refreshUser,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
