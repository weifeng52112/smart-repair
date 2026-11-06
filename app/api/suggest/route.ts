import { NextResponse } from "next/server";
import { fallbackSuggestions } from "@/lib/suggest-fallback";

export const runtime = "nodejs";

/**
 * 接口契约（小A 与 小B 约定的"插座形状"）
 * -------------------------------------------------
 * POST /api/suggest
 * 请求体：{ "deviceType": "打印机", "description": "一直卡纸" }
 * 返回体：{ "suggestions": ["建议1", "建议2", "建议3"], "source": "ai" | "fallback", "note"?: string }
 * 无论成功失败，这个字段名都不变，前端只读 suggestions。
 */

type Body = { deviceType?: string; description?: string };

const SYSTEM_PROMPT = `你是一名企业 IT 运维工程师，正在给同事写自助排查建议。
要求：
1. 输出 3 条建议，每条一句话，不超过 40 个汉字，动词开头，可照做。
2. 顺序上从最安全、最容易操作的一步开始，逐步升级。
3. 不要编号，不要解释原理，不要写"请联系管理员"这类空话（最后一条可以是"若仍不行，保留现场并等待工程师"）。
4. 只输出 JSON，格式：{"suggestions": ["...", "...", "..."]}`;

async function askDeepSeek(deviceType: string, description: string): Promise<string[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("缺少 DEEPSEEK_API_KEY");

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0.4,
      max_tokens: 400,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `设备类型：${deviceType}\n故障描述：${description}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
    // 服务器端 25 秒兜底，避免页面一直转圈
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  const content: string = json?.choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(content) as { suggestions?: unknown };

  const list = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  const clean = list
    .map((item) => String(item).replace(/^\s*\d+[.、)]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);

  if (clean.length === 0) throw new Error("DeepSeek 返回内容为空");
  return clean;
}

export async function POST(request: Request) {
  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ suggestions: [], source: "fallback", note: "请求体不是合法 JSON" }, { status: 400 });
  }

  const deviceType = (body.deviceType ?? "").trim();
  const description = (body.description ?? "").trim();

  if (!deviceType || !description) {
    return NextResponse.json(
      { suggestions: [], source: "fallback", note: "deviceType 和 description 都不能为空" },
      { status: 400 }
    );
  }

  try {
    const suggestions = await askDeepSeek(deviceType, description);
    return NextResponse.json({ suggestions, source: "ai" });
  } catch (error) {
    // 关键：AI 不可用不拖垮业务，退回本地规则建议，并如实标注来源
    const note = error instanceof Error ? error.message : "未知错误";
    console.error("[api/suggest] 调用 DeepSeek 失败，已使用兜底建议：", note);
    return NextResponse.json({
      suggestions: fallbackSuggestions(deviceType, description),
      source: "fallback",
      note,
    });
  }
}
