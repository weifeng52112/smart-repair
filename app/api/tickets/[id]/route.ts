import { NextResponse } from "next/server";
import { serverAdvanceStatus, serverGetTicket, serverHasDatabase, serverUpdateTicket } from "@/lib/server-db";
import type { TicketStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function GET(_request: Request, { params }: Params) {
  if (!serverHasDatabase()) {
    return NextResponse.json({ error: "未配置数据库", code: "NO_DB" }, { status: 503 });
  }
  try {
    const ticket = await serverGetTicket(params.id);
    if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
    return NextResponse.json({ ticket });
  } catch (error) {
    console.error("[api/tickets/:id] 读取失败：", error);
    return NextResponse.json({ error: "数据库暂时不可用" }, { status: 502 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  if (!serverHasDatabase()) {
    return NextResponse.json({ error: "未配置数据库", code: "NO_DB" }, { status: 503 });
  }

  let body: { status?: TicketStatus; suggestions?: string[]; advance?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  try {
    if (body.advance) {
      const ticket = await serverAdvanceStatus(params.id);
      if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
      return NextResponse.json({ ticket });
    }

    const ticket = await serverUpdateTicket(params.id, {
      status: body.status,
      suggestions: Array.isArray(body.suggestions) ? body.suggestions : undefined,
    });
    if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
    return NextResponse.json({ ticket });
  } catch (error) {
    console.error("[api/tickets/:id] 更新失败：", error);
    return NextResponse.json({ error: "工单更新失败" }, { status: 502 });
  }
}
