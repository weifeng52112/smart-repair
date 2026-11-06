import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * 有没有配齐两个密钥，决定数据走 Supabase 还是走浏览器本地。
 * 没配的时候不是报错，而是自动退回到 localStorage，保证"先把页面跑起来"。
 */
export const hasSupabase = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!hasSupabase) {
    throw new Error("Supabase 环境变量未配置");
  }
  if (!client) {
    client = createClient(url as string, anonKey as string);
  }
  return client;
}
