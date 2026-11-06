"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { deviceIcon, statusStyle, type Ticket, type TicketStatus, STATUSES } from "@/lib/types";
import { advanceStatus, dataSourceLabel, listTickets } from "@/lib/store";

type Filter = "全部" | TicketStatus;
const FILTERS: Filter[] = ["全部", ...STATUSES];

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getMonth() + 1}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState<Filter>("全部");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");

  async function load() {
    try {
      setError("");
      setTickets(await listTickets());
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取工单失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const base: Record<Filter, number> = { 全部: tickets.length, 待处理: 0, 处理中: 0, 已完成: 0 };
    tickets.forEach((ticket) => {
      base[ticket.status] += 1;
    });
    return base;
  }, [tickets]);

  const visible = filter === "全部" ? tickets : tickets.filter((ticket) => ticket.status === filter);

  async function handleAdvance(id: string) {
    setPendingId(id);
    try {
      const status = await advanceStatus(id);
      setTickets((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
      void status;
    } catch (err) {
      setError(err instanceof Error ? err.message : "修改状态失败");
    } finally {
      setPendingId("");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">工单列表</h1>
          <p className="mt-1 text-sm text-slate-500">
            共 {tickets.length} 条工单 · 数据来源：{dataSourceLabel()} · 点状态按钮可以推进流程
          </p>
        </div>
        <Link href="/" className="btn-primary">
          + 新建报修
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => {
          const active = filter === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`rounded-full px-3.5 py-1.5 text-sm transition ${
                active
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {item}
              <span className={`ml-1.5 text-xs ${active ? "text-white/70" : "text-slate-400"}`}>
                {counts[item]}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      )}

      {loading ? (
        <div className="card px-6 py-16 text-center text-sm text-slate-400">正在读取工单…</div>
      ) : visible.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
            🗂️
          </div>
          <p className="mt-3 text-sm font-medium text-slate-700">
            {filter === "全部" ? "还没有任何报修单" : `没有「${filter}」的工单`}
          </p>
          <p className="mt-1 text-sm text-slate-500">设备出状况时，先在这里建一张单，AI 会给出自助排查建议。</p>
          <Link href="/" className="btn-primary mt-5">
            去提交第一张报修单
          </Link>
        </div>
      ) : (
        <div className="card divide-y divide-slate-100 overflow-hidden">
          {visible.map((ticket) => (
            <div
              key={ticket.id}
              className="flex flex-wrap items-center gap-4 px-5 py-4 transition hover:bg-slate-50/80"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg">
                {deviceIcon(ticket.device)}
              </div>

              <div className="min-w-[180px] flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/tickets/${ticket.id}`}
                    className="text-sm font-semibold text-slate-900 hover:text-brand-600"
                  >
                    {ticket.name} · {ticket.device}
                  </Link>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${statusStyle(ticket.status)}`}>
                    {ticket.status}
                  </span>
                </div>
                <p className="mt-1 line-clamp-1 text-sm text-slate-500">{ticket.description}</p>
              </div>

              <div className="w-24 text-xs text-slate-400">{ticket.area}</div>
              <div className="w-24 text-xs text-slate-400">{formatTime(ticket.created_at)}</div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-ghost !px-3 !py-1.5 text-xs"
                  onClick={() => handleAdvance(ticket.id)}
                  disabled={pendingId === ticket.id}
                >
                  {pendingId === ticket.id
                    ? "处理中…"
                    : ticket.status === "已完成"
                      ? "重开"
                      : ticket.status === "处理中"
                        ? "标记完成"
                        : "开始处理"}
                </button>
                <Link href={`/tickets/${ticket.id}`} className="text-xs text-brand-600 hover:underline">
                  详情
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
