import { hasSupabase } from "./supabase";
import { nextStatus, type NewTicket, type Ticket, type TicketStatus } from "./types";

/**
 * 浏览器侧数据层。
 * 配了 Supabase 时不直连数据库，而是打自己的 /api/tickets 接口（同源、不会被网络重置），
 * 由服务端再去连 Supabase。没配密钥时退回到 localStorage，保证永远跑得起来。
 */

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
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function localRecord(input: NewTicket, suggestions: string[]): Ticket {
  return {
    id: newId(),
    name: input.name.trim(),
    area: input.area,
    device: input.device,
    description: input.description.trim(),
    status: "待处理",
    suggestions,
    created_at: new Date().toISOString(),
  };
}

export function dataSourceLabel(): string {
  return hasSupabase ? "Supabase 数据库" : "浏览器本地存储";
}

async function callApi<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    throw new Error("连不上服务器，请检查网络后重试");
  }

  const payload = (await res.json().catch(() => ({}))) as {
    error?: string;
    detail?: string;
  } & Record<string, unknown>;

  if (!res.ok) {
    if (res.status === 503) throw new Error("NO_DB");
    throw new Error(payload.error || "服务器返回异常");
  }
  return payload as T;
}

export async function listTickets(): Promise<Ticket[]> {
  if (!hasSupabase) return readLocal();
  try {
    const { tickets } = await callApi<{ tickets: Ticket[] }>("/api/tickets");
    return tickets;
  } catch (error) {
    if (error instanceof Error && error.message === "NO_DB") return readLocal();
    throw error;
  }
}

export async function getTicket(id: string): Promise<Ticket | null> {
  if (!hasSupabase) return readLocal().find((item) => item.id === id) ?? null;
  try {
    const { ticket } = await callApi<{ ticket: Ticket }>(`/api/tickets/${id}`);
    return ticket;
  } catch (error) {
    if (error instanceof Error && error.message === "NO_DB") {
      return readLocal().find((item) => item.id === id) ?? null;
    }
    throw error;
  }
}

export async function createTicket(input: NewTicket, suggestions: string[]): Promise<Ticket> {
  if (!hasSupabase) {
    const record = localRecord(input, suggestions);
    writeLocal([record, ...readLocal()]);
    return record;
  }

  try {
    const { ticket } = await callApi<{ ticket: Ticket }>("/api/tickets", {
      method: "POST",
      body: JSON.stringify({ ...input, suggestions }),
    });
    return ticket;
  } catch (error) {
    if (error instanceof Error && error.message === "NO_DB") {
      const record = localRecord(input, suggestions);
      writeLocal([record, ...readLocal()]);
      return record;
    }
    throw error;
  }
}

export async function updateStatus(id: string, status: TicketStatus): Promise<void> {
  if (!hasSupabase) {
    writeLocal(readLocal().map((item) => (item.id === id ? { ...item, status } : item)));
    return;
  }
  await callApi(`/api/tickets/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export async function advanceStatus(id: string): Promise<TicketStatus> {
  if (!hasSupabase) {
    const ticket = readLocal().find((item) => item.id === id);
    if (!ticket) throw new Error("工单不存在");
    const status = nextStatus(ticket.status);
    writeLocal(readLocal().map((item) => (item.id === id ? { ...item, status } : item)));
    return status;
  }

  const { ticket } = await callApi<{ ticket: Ticket }>(`/api/tickets/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ advance: true }),
  });
  return ticket.status;
}

export async function saveSuggestions(id: string, suggestions: string[]): Promise<void> {
  if (!hasSupabase) {
    writeLocal(readLocal().map((item) => (item.id === id ? { ...item, suggestions } : item)));
    return;
  }
  await callApi(`/api/tickets/${id}`, { method: "PATCH", body: JSON.stringify({ suggestions }) });
}
