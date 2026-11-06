"use client";

import Link from "next/link";
import { useState } from "react";
import { AREAS, DEVICES, deviceIcon, type NewTicket, type Ticket } from "@/lib/types";
import { createTicket, dataSourceLabel } from "@/lib/store";

type Step = "idle" | "suggesting" | "saving" | "done";

export default function HomePage() {
  const [form, setForm] = useState<NewTicket>({
    name: "",
    area: "A区",
    device: "电脑",
    description: "",
  });
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Ticket | null>(null);
  const [suggestSource, setSuggestSource] = useState<"ai" | "fallback" | "">("");

  const busy = step === "suggesting" || step === "saving";

  function update<K extends keyof NewTicket>(key: K, value: NewTicket[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!form.name.trim()) return setError("请填写你的姓名，方便工程师找到你。");
    if (form.description.trim().length < 5) return setError("故障描述太短了，至少写 5 个字，AI 才能给出有效建议。");

    try {
      setStep("suggesting");
      let suggestions: string[] = [];
      let source: "ai" | "fallback" = "fallback";

      try {
        const res = await fetch("/api/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceType: form.device, description: form.description }),
        });
        const data = (await res.json()) as { suggestions?: string[]; source?: "ai" | "fallback" };
        suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
        source = data.source === "ai" ? "ai" : "fallback";
      } catch {
        suggestions = [];
      }

      setSuggestSource(source);
      setStep("saving");
      const ticket = await createTicket(form, suggestions);
      setCreated(ticket);
      setStep("done");
      setForm({ name: form.name, area: form.area, device: form.device, description: "" });
    } catch (err) {
      setStep("idle");
      setError(err instanceof Error ? err.message : "提交失败，请稍后重试。");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
      {/* 左：表单 */}
      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-br from-brand-50 to-white px-6 py-6">
          <h1 className="text-xl font-semibold text-slate-900">设备坏了？先填一张报修单</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            提交后系统会调用 AI，按「设备类型 + 故障描述」生成 3 条自助排查建议。先照着试试，修不好工程师再上门。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="name">
                你的姓名
              </label>
              <input
                id="name"
                className="field"
                placeholder="例如：张三"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                maxLength={20}
              />
            </div>
            <div>
              <label className="label" htmlFor="area">
                办公区
              </label>
              <select
                id="area"
                className="field"
                value={form.area}
                onChange={(e) => update("area", e.target.value)}
              >
                {AREAS.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className="label">设备类型</span>
            <div className="grid grid-cols-3 gap-2">
              {DEVICES.map((device) => {
                const active = form.device === device;
                return (
                  <button
                    key={device}
                    type="button"
                    onClick={() => update("device", device)}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-sm transition ${
                      active
                        ? "border-brand-500 bg-brand-50 font-semibold text-brand-700 ring-4 ring-brand-500/10"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-lg leading-none">{deviceIcon(device)}</span>
                    {device}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="label mb-1.5" htmlFor="description">
                故障描述
              </label>
              <span className="mb-1.5 text-xs text-slate-400">{form.description.length}/200</span>
            </div>
            <textarea
              id="description"
              className="field min-h-[120px] resize-y leading-relaxed"
              placeholder="越具体越有用：什么现象、什么时候开始的、报错原文是什么。例如「打印机每次进纸到一半就停住，面板闪红灯」。"
              value={form.description}
              onChange={(e) => update("description", e.target.value.slice(0, 200))}
            />
          </div>

          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-primary" disabled={busy}>
              {step === "suggesting" && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {step === "suggesting"
                ? "AI 正在生成排查建议…"
                : step === "saving"
                  ? "正在提交工单…"
                  : "提交报修单"}
            </button>
            <Link href="/tickets" className="btn-ghost">
              查看工单列表
            </Link>
            <span className="ml-auto text-xs text-slate-400">数据来源：{dataSourceLabel()}</span>
          </div>
        </form>
      </section>

      {/* 右：说明 / 结果 */}
      <aside className="space-y-4">
        {created ? (
          <div className="card border-emerald-200 p-6">
            <div className="flex items-center gap-2 text-emerald-700">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M5 13l4 4L19 7" />
              </svg>
              <h2 className="text-base font-semibold">工单已提交</h2>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              编号 <span className="font-mono text-xs text-slate-700">{created.id.slice(0, 8)}</span> · 状态
              待处理。先按下面的建议自己试一遍。
            </p>

            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
                <span className="rounded-md bg-white px-2 py-0.5 text-brand-700 ring-1 ring-brand-100">
                  AI 自助建议
                </span>
                <span className="text-slate-400">
                  {suggestSource === "ai" ? "DeepSeek 生成" : "本地规则兜底"}
                </span>
              </div>
              {created.suggestions.length > 0 ? (
                <ol className="space-y-2 text-sm leading-relaxed text-slate-700">
                  {created.suggestions.map((tip, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">
                        {index + 1}
                      </span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-slate-500">这次没拿到建议，可以直接去详情页重新生成。</p>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <Link href={`/tickets/${created.id}`} className="btn-primary flex-1">
                查看工单详情
              </Link>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setCreated(null);
                  setStep("idle");
                }}
              >
                再报一个
              </button>
            </div>
          </div>
        ) : (
          <div className="card p-6">
            <h2 className="text-base font-semibold text-slate-900">提交之后会发生什么</h2>
            <ol className="mt-4 space-y-3.5 text-sm leading-relaxed text-slate-600">
              {[
                ["保存工单", "姓名、办公区、设备、描述写进数据库，状态默认「待处理」。"],
                ["AI 生成建议", "服务端调用 /api/suggest，返回 3 条可照做的排查步骤。"],
                ["自己先试", "照着建议操作，多数小毛病在 5 分钟内能自己解决。"],
                ["工程师接手", "修不好就在列表里把状态改成「处理中」，等待上门。"],
              ].map(([title, desc], index) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-500">
                    {index + 1}
                  </span>
                  <span>
                    <span className="font-medium text-slate-800">{title}</span>
                    <span className="block text-slate-500">{desc}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="card border-dashed p-5">
          <p className="text-xs leading-relaxed text-slate-500">
            小提示：报修单提交后可以在<a className="mx-1 text-brand-600 underline" href="/tickets">工单列表</a>
            里随时改状态。描述里带上报错原文，AI 给出的建议会准得多。
          </p>
        </div>
      </aside>
    </div>
  );
}
