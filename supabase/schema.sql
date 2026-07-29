-- Stage Sync: Supabase SQL Editor에서 한 번 실행하세요.
-- (Dashboard → SQL → New query → Run)

create table if not exists public.app_state (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

-- 단일 극단 앱: anon 읽기/쓰기 허용 (추후 Auth/RLS 강화)
drop policy if exists "app_state_select" on public.app_state;
drop policy if exists "app_state_upsert" on public.app_state;
drop policy if exists "app_state_update" on public.app_state;
drop policy if exists "app_state_insert" on public.app_state;

create policy "app_state_select" on public.app_state
  for select to anon, authenticated using (true);

create policy "app_state_insert" on public.app_state
  for insert to anon, authenticated with check (true);

create policy "app_state_update" on public.app_state
  for update to anon, authenticated using (true) with check (true);

-- 실시간 갱신(선택)
-- alter publication supabase_realtime add table public.app_state;
  - EAST : 승준, 지민
   - GLORY : 어매, 지원
   - JIMMY : 서우, 서훈
   - SANDRINE : 이매, 민주
   - WAITRESS : 유진, 영은
   - MARVALYN : 은경, 지원
   - STEVE : 승준, 서우
   - GAYLE : 이매, 유진
   - LENDALL : 득규, 서훈
   - RANDY : 상우
   - CHAD : 민형
- SHELLY : 유진
   - DEENA : 영은
   - PHIL : 지민, 상우
   - MARCY : 은경, 도연
   - HOPE : 영은, 도연
   - DANIEL : 민형, 동규
   - RHONDA : 어매, 민주
   - DAVE : 득규, 동규
