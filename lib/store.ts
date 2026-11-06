import { getSupabase, hasSupabase } from "./supabase";
import { nextStatus, type NewTicket, type Ticket, type TicketStatus } from "./types";

const LOCAL_KEY = "smart-repair-tickets";

function readLocal(): Ticket[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    const list = raw ? (JSON.parse(raw) as Ticket[]) : [];
    return list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  } catch {
    return [];
  }
}

function writeLocal(list: Ticket[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
}

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function dataSourceLabel(): string {
  return hasSupabase ? "Supabase 数据库" : "浏览器本地存储";
}

export async function listTickets(): Promise<Ticket[]> {
  if (!hasSupabase) return readLocal();

  const { data, error } = await getSupabase()
    .from("tickets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...row,
    suggestions: Array.isArray(row.suggestions) ? row.suggestions : [],
  })) as Ticket[];
}

export async function getTicket(id: string): Promise<Ticket | null> {
  if (!hasSupabase) {
    return readLocal().find((item) => item.id === id) ?? null;
  }

  const { data, error } = await getSupabase().from("tickets").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    ...data,
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
  } as Ticket;
}

export async function createTicket(input: NewTicket, suggestions: string[]): Promise<Ticket> {
  const record: Ticket = {
    id: newId(),
    name: input.name.trim(),
    area: input.area,
    device: input.device,
    description: input.description.trim(),
    status: "待处理",
    suggestions,
    created_at: new Date().toISOString(),
  };

  if (!hasSupabase) {
    writeLocal([record, ...readLocal()]);
    return record;
  }

  const { data, error } = await getSupabase().from("tickets").insert(record).select("*").single();
  if (error) throw new Error(error.message);
  return {
    ...(data as Ticket),
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
  };
}

export async function updateStatus(id: string, status: TicketStatus): Promise<void> {
  if (!hasSupabase) {
    writeLocal(readLocal().map((item) => (item.id === id ? { ...item, status } : item)));
    return;
  }

  const { error } = await getSupabase().from("tickets").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function advanceStatus(id: string): Promise<TicketStatus> {
  const ticket = await getTicket(id);
  if (!ticket) throw new Error("工单不存在");
  const status = nextStatus(ticket.status);
  await updateStatus(id, status);
  return status;
}

export async function saveSuggestions(id: string, suggestions: string[]): Promise<void> {
  if (!hasSupabase) {
    writeLocal(readLocal().map((item) => (item.id === id ? { ...item, suggestions } : item)));
    return;
  }

  const { error } = await getSupabase().from("tickets").update({ suggestions }).eq("id", id);
  if (error) throw new Error(error.message);
}
