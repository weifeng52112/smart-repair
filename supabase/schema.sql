-- ============================================================
-- 智能报修小助手 · 建表 SQL
-- 用法：Supabase 控制台 → SQL Editor → New query → 整段粘贴 → Run
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists tickets (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,
  area        text        not null check (area in ('A区', 'B区', 'C区')),
  device      text        not null check (device in ('电脑', '打印机', '投影仪')),
  description text        not null,
  status      text        not null default '待处理' check (status in ('待处理', '处理中', '已完成')),
  suggestions jsonb       not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists tickets_created_at_idx on tickets (created_at desc);

-- ------------------------------------------------------------
-- 行级权限（RLS）
-- 实训阶段：前端直接带 anon key 读写，所以放开 anon 的增查改。
-- 生产项目应该配合登录（auth）做按用户授权，别照抄这一段。
-- ------------------------------------------------------------
alter table tickets enable row level security;

drop policy if exists "anon can read tickets" on tickets;
create policy "anon can read tickets"
  on tickets for select
  to anon
  using (true);

drop policy if exists "anon can create tickets" on tickets;
create policy "anon can create tickets"
  on tickets for insert
  to anon
  with check (true);

drop policy if exists "anon can update ticket status" on tickets;
create policy "anon can update ticket status"
  on tickets for update
  to anon
  using (true)
  with check (true);

-- 验证：跑完这条应该能看到表结构和 0 行数据
-- select * from tickets order by created_at desc;
