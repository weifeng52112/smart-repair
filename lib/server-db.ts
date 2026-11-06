import { getSupabase, hasSupabase } from "./supabase";
import { nextStatus, type NewTicket, type Ticket, type TicketStatus } from "./types";

/**
 * 服务端数据层：只在 app/api/** 的 route 里调用。
 * 为什么不在浏览器里直连 Supabase：国内网络访问 xxx.supabase.co 经常被重置，
 * 统一改成「浏览器 → 自己的 Vercel 接口 → Supabase」，链路稳定，密钥也不再下发到前端。
 */

function normalize(row: Record<string, unknown>): Ticket {
  return {
    ...(row as unknown as Ticket),
    suggestions: Array.isArray(row.suggestions) ? (row.suggestions as string[]) : [],
  };
}

export function serverHasDatabase(): boolean {
  return hasSupabase;
}

export async function serverListTickets(): Promise<Ticket[]> {
  const { data, error } = await getSupabase()
    .from("tickets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(normalize);
}

export async function serverGetTicket(id: string): Promise<Ticket | null> {
  const { data, error } = await getSupabase().from("tickets").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalize(data) : null;
}

export async function serverCreateTicket(input: NewTicket, suggestions: string[]): Promise<Ticket> {
  const { data, error } = await getSupabase()
    .from("tickets")
    .insert({
      name: input.name.trim(),
      area: input.area,
      device: input.device,
      description: input.description.trim(),
      status: "待处理" as TicketStatus,
      suggestions,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return normalize(data);
}

export async function serverUpdateTicket(
  id: string,
  patch: { status?: TicketStatus; suggestions?: string[] }
): Promise<Ticket | null> {
  const { data, error } = await getSupabase().from("tickets").update(patch).eq("id", id).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalize(data) : null;
}

export async function serverAdvanceStatus(id: string): Promise<Ticket | null> {
  const ticket = await serverGetTicket(id);
  if (!ticket) return null;
  return serverUpdateTicket(id, { status: nextStatus(ticket.status) });
}
