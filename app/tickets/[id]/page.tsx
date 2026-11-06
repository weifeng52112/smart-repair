"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { deviceIcon, nextStatus, statusStyle, type Ticket } from "@/lib/types";
import { advanceStatus, dataSourceLabel, getTicket, saveSuggestions } from "@/lib/store";

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "status" | "suggest">("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!id) return;
    getTicket(id)
      .then((data) => setTicket(data))
      .catch((err) => setError(err instanceof Error ? err.message : "读取失败"))
      .finally(() => setLoading(false));
  }, [id]);

  async function regenerate() {
    if (!ticket) return;
    setBusy("suggest");
    setNote("");
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceType: ticket.device, description: ticket.description }),
      });
      const data = (await res.json()) as { suggestions?: string[]; source?: string };
      const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
      await saveSuggestions(ticket.id, suggestions);
      setTicket({ ...ticket, suggestions });
      setNote(data.source === "ai" ? "已由 DeepSeek 重新生成" : "AI 不可用，已使用本地规则建议");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "生成失败");
    } finally {
      setBusy("");
    }
  }

  async function changeStatus() {
    if (!ticket) return;
    setBusy("status");
    try {
      await advanceStatus(ticket.id);
      setTicket({ ...ticket, status: nextStatus(ticket.status) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "修改状态失败");
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return <div className="card px-6 py-16 text-center text-sm text-slate-400">正在读取工单…</div>;
  }

  if (error || !ticket) {
    return (
      <div className="card px-6 py-16 text-center">
        <p className="text-sm font-medium text-slate-700">{error || "这条工单不存在"}</p>
        <p className="mt-1 text-sm text-slate-500">
          如果你之前在本地存储里提交过，换浏览器或清缓存后会找不到。
        </p>
        <Link href="/tickets" className="btn-primary mt-5">
          返回工单列表
        </Link>
      </div>
    );
  }

  const rows: [string, string][] = [
    ["提交人", ticket.name],
    ["办公区", ticket.area],
    ["设备类型", `${deviceIcon(ticket.device)} ${ticket.device}`],
    ["提交时间", new Date(ticket.created_at).toLocaleString("zh-CN", { hour12: false })],
    ["数据来源", dataSourceLabel()],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/tickets" className="text-xs text-slate-400 hover:text-slate-600">
            ← 返回工单列表
          </Link>
          <h1 className="mt-1.5 flex items-center gap-3 text-xl font-semibold text-slate-900">
            工单 {ticket.id.slice(0, 8)}
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${statusStyle(ticket.status)}`}>
              {ticket.status}
            </span>
          </h1>
        </div>
        <button type="button" className="btn-ghost" onClick={changeStatus} disabled={busy === "status"}>
          {busy === "status" ? "处理中…" : ticket.status === "已完成" ? "重新打开" : `改为「${nextStatus(ticket.status)}」`}
        </button>
      </div>

      <div className="card p-6">
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-slate-400">{label}</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 border-t border-slate-100 pt-5">
          <p className="text-xs text-slate-400">故障描述</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{ticket.description}</p>
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-br from-brand-50 to-white px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              AI 自助排查建议
              <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-normal text-brand-700 ring-1 ring-brand-100">
                /api/suggest
              </span>
            </h2>
            <p className="mt-1 text-xs text-slate-500">照着做一遍，多数小毛病不用等人上门。</p>
          </div>
          <button type="button" className="btn-ghost" onClick={regenerate} disabled={busy === "suggest"}>
            {busy === "suggest" ? "正在生成…" : "重新生成"}
          </button>
        </div>

        <div className="px-6 py-5">
          {ticket.suggestions.length > 0 ? (
            <ol className="space-y-3">
              {ticket.suggestions.map((tip, index) => (
                <li key={index} className="flex gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <span className="text-sm leading-relaxed text-slate-700">{tip}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-500">这条工单还没有建议，点右上角「重新生成」试试。</p>
          )}
          {note && <p className="mt-3 text-xs text-slate-400">{note}</p>}
        </div>
      </section>

      <div className="card border-dashed p-5 text-xs leading-relaxed text-slate-500">
        处理流程：待处理 → 处理中 → 已完成。改完状态后回到列表页刷新即可看到最新进度；
        如果配置了 Supabase，状态会同步写回数据库的 tickets 表。
      </div>
    </div>
  );
}
