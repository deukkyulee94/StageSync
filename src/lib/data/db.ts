import type { AppData } from "@/types";
import { createEmptyData, migrate } from "@/lib/data/store";
import { createServiceClient } from "@/lib/supabase/client";

const STATE_ID = "main";
const BUCKET = "stage-sync";
const OBJECT_PATH = "app-data.json";

async function ensureBucket(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets?.some((b) => b.name === BUCKET || b.id === BUCKET)) return;
  await supabase.storage.createBucket(BUCKET, { public: false });
}

function normalize(raw: unknown): AppData {
  return migrate(raw);
}

/** app_state 테이블 우선, 없으면 Storage JSON으로 저장/로드. 없으면 빈 데이터. */
export async function loadAppDataFromDb(): Promise<AppData> {
  const supabase = createServiceClient();

  const table = await supabase
    .from("app_state")
    .select("data")
    .eq("id", STATE_ID)
    .maybeSingle();

  if (!table.error && table.data?.data) {
    return normalize(table.data.data);
  }

  await ensureBucket(supabase);
  const file = await supabase.storage.from(BUCKET).download(OBJECT_PATH);
  if (!file.error && file.data) {
    const text = await file.data.text();
    return normalize(JSON.parse(text));
  }

  const empty = createEmptyData();
  await saveAppDataToDb(empty);
  return empty;
}

export async function saveAppDataToDb(data: AppData): Promise<void> {
  const supabase = createServiceClient();
  const payload = {
    id: STATE_ID,
    data,
    updated_at: new Date().toISOString(),
  };

  const table = await supabase.from("app_state").upsert(payload, {
    onConflict: "id",
  });

  if (!table.error) return;

  await ensureBucket(supabase);
  const body = JSON.stringify(data);
  const upload = await supabase.storage.from(BUCKET).upload(OBJECT_PATH, body, {
    contentType: "application/json",
    upsert: true,
  });

  if (upload.error) {
    throw new Error(
      `Supabase 저장 실패: ${table.error?.message ?? ""} / ${upload.error.message}. ` +
        `supabase/schema.sql 을 SQL Editor에서 실행하면 테이블 저장이 활성화됩니다.`,
    );
  }
}

export async function clearAppDataInDb(): Promise<AppData> {
  const empty = createEmptyData();
  await saveAppDataToDb(empty);
  return empty;
}
