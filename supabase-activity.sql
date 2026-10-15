-- ============================================================
-- 站主后台统计所需的数据结构
-- 在 Supabase → SQL Editor 里整段执行（幂等，可重复跑）
-- ============================================================

-- ============================================================
-- 一、每日活跃：每个用户每天一行（用于算日活 / 周活 / 月活与趋势）
-- ============================================================

create table if not exists public.user_activity (
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

create index if not exists user_activity_day_idx on public.user_activity (day desc);

alter table public.user_activity enable row level security;

-- 本人写自己那一行
drop policy if exists "own activity insertable" on public.user_activity;
create policy "own activity insertable"
  on public.user_activity for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 本人读自己的
drop policy if exists "own activity readable" on public.user_activity;
create policy "own activity readable"
  on public.user_activity for select
  to authenticated
  using (auth.uid() = user_id);

-- 站主读全部（后台统计用）
drop policy if exists "admin reads all activity" on public.user_activity;
create policy "admin reads all activity"
  on public.user_activity for select
  to authenticated
  using (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid);

grant select, insert on public.user_activity to authenticated;

-- ============================================================
-- 二、最后活跃时间（"最近 N 分钟在线"与日活兜底）
-- ============================================================

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

create index if not exists profiles_last_seen_idx on public.profiles (last_seen_at desc);

-- 强制 PostgREST 刷新 schema 缓存（新表常常需要这一下，否则前端仍报
-- Could not find the table 'public.user_activity' in the schema cache）
notify pgrst, 'reload schema';

-- ============================================================
-- 三、确认结果
-- ============================================================

-- 1) user_activity 结构与策略（应看到 3 条策略）
select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'user_activity'
order by policyname;

-- 2) profiles 是否已有 last_seen_at
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'last_seen_at';

-- 3) 授权
select table_name, privilege_type, grantee
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'user_activity'
order by privilege_type;
