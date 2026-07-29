import { NextResponse } from "next/server";
import type { AppData } from "@/types";
import {
  clearAppDataInDb,
  loadAppDataFromDb,
  saveAppDataToDb,
} from "@/lib/data/db";

export async function GET() {
  try {
    const data = await loadAppDataFromDb();
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "데이터 로드 실패",
      },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as {
      data?: AppData;
      reset?: boolean;
      clear?: boolean;
    };
    if (body.reset || body.clear) {
      const data = await clearAppDataInDb();
      return NextResponse.json({ data });
    }
    if (!body.data) {
      return NextResponse.json({ error: "data가 필요합니다." }, { status: 400 });
    }
    await saveAppDataToDb(body.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "데이터 저장 실패",
      },
      { status: 500 },
    );
  }
}
