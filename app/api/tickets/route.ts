import { NextResponse } from "next/server";
import { serverCreateTicket, serverListTickets, serverHasDatabase } from "@/lib/server-db";
import type { NewTicket } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!serverHasDatabase()) {
    return NextResponse.json({ error: "未配置数据库", code: "NO_DB" }, { status: 503 });
  }
  try {
    const tickets = await serverListTickets();
    return NextResponse.json({ tickets });
  } catch (error) {
    console.error("[api/tickets] 读取失败：", error);
    return NextResponse.json(
      { error: "数据库暂时不可用", detail: error instanceof Error ? error.message : "" },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  if (!serverHasDatabase()) {
    return NextResponse.json({ error: "未配置数据库", code: "NO_DB" }, { status: 503 });
  }

  let body: NewTicket & { suggestions?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (!body?.name?.trim() || !body?.area || !body?.device || !body?.description?.trim()) {
    return NextResponse.json({ error: "姓名、办公区、设备、故障描述都不能为空" }, { status: 400 });
  }

  try {
    const ticket = await serverCreateTicket(body, Array.isArray(body.suggestions) ? body.suggestions : []);
    return NextResponse.json({ ticket });
  } catch (error) {
    console.error("[api/tickets] 写入失败：", error);
    return NextResponse.json(
      { error: "工单保存失败", detail: error instanceof Error ? error.message : "" },
      { status: 502 }
    );
  }
}
