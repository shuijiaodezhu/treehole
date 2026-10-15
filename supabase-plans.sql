-- ============================================================
-- 计划书：计划 / 目标 / 待办任务（每人私密）
-- 在 Supabase → SQL Editor 里整段执行（幂等，可重复跑）
-- ============================================================

create table if not exists public.user_plans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- plan = 计划，goal = 目标，task = 待办任务
  kind       text not null check (kind in ('plan', 'goal', 'task')),
  title      text not null,
  note       text,
  due_date   date,                                   -- 可选：截止/期望日期
  done       boolean not null default false,         -- 任务勾选、计划完成、目标达成
  progress   int not null default 0 check (progress between 0 and 100), -- 仅目标用
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_plans_user_kind_idx
  on public.user_plans (user_id, kind, done, created_at desc);

alter table public.user_plans enable row level security;

-- 只能读自己的
drop policy if exists "own plans readable" on public.user_plans;
create policy "own plans readable"
  on public.user_plans for select
  to authenticated
  using (auth.uid() = user_id);

-- 只能写自己的
drop policy if exists "own plans insertable" on public.user_plans;
create policy "own plans insertable"
  on public.user_plans for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 只能改自己的
drop policy if exists "own plans updatable" on public.user_plans;
create policy "own plans updatable"
  on public.user_plans for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 只能删自己的
drop policy if exists "own plans deletable" on public.user_plans;
create policy "own plans deletable"
  on public.user_plans for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.user_plans to authenticated;

-- 刷新 PostgREST schema 缓存
notify pgrst, 'reload schema';

-- ============================================================
-- 确认：应返回 4 条策略
-- ============================================================
select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'user_plans'
order by cmd;
