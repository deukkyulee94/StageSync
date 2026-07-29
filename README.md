# Stage Sync

극단 연극 연습 일정·팀/장면 라인업 조율 웹앱 (모바일 웹 최적화).

## 빠른 시작

```bash
npm install
cp .env.example .env.local   # Supabase 키 입력
npm run dev
```

### Supabase

Dashboard → SQL → [`supabase/schema.sql`](supabase/schema.sql) 실행(권장).

테이블이 없으면 Storage(`stage-sync/app-data.json`)로 폴백합니다.

최초 실행 시 계정이 없으면 로그인 화면에서 **관리자 계정**을 만들 수 있습니다.

## 데이터

- 앱 상태는 Supabase에만 저장 (`/api/data`)
- 연습 일정은 장면 선택 후 인원별 가능일 표·겹치는 날짜로 잡습니다
