-- ============================================================
-- 拉黑/屏蔽 + 朋友圈可见范围 + 好友分组
-- 在 Supabase → SQL Editor 里整段执行（幂等，可重复跑）
-- ============================================================

-- ============================================================
-- 一、拉黑 / 屏蔽（完整拉黑）
--   互相看不到对方的帖子、评论、朋友圈、活动；
--   被拉黑的人也不能给你发好友申请 / 私信。
-- ============================================================

create table if not exists public.blocks (
  id         uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocker_idx on public.blocks (blocker_id);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

drop policy if exists "own blocks readable" on public.blocks;
create policy "own blocks readable"
  on public.blocks for select
  using (auth.uid() = blocker_id);

drop policy if exists "own blocks insertable" on public.blocks;
create policy "own blocks insertable"
  on public.blocks for insert
  with check (auth.uid() = blocker_id);

drop policy if exists "own blocks deletable" on public.blocks;
create policy "own blocks deletable"
  on public.blocks for delete
  using (auth.uid() = blocker_id);

-- 说明：被拉黑的一方看不到该记录（select 策略只允许 blocker 自己），
-- 所以"被拉黑"是静默的——对方不会收到通知，只是内容消失。

-- ------------------------------------------------------------
-- 双向黑名单：客户端需要知道"我拉黑了谁" + "谁拉黑了我" 才能双向过滤，
-- 但又不该把原始拉黑记录暴露给对方。
-- 用 security definer 函数只返回一个 uuid 数组，不暴露是谁拉黑了谁。
-- ------------------------------------------------------------
create or replace function public.get_blocked_ids()
returns uuid[]
language sql
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct x), '{}')
  from (
    select blocked_id as x from public.blocks where blocker_id = auth.uid()
    union
    select blocker_id as x from public.blocks where blocked_id = auth.uid()
  ) t;
$$;

revoke all on function public.get_blocked_ids() from public;
grant execute on function public.get_blocked_ids() to authenticated;

-- ============================================================
-- 二、好友分组（用于朋友圈"部分好友可见"）
-- ============================================================

create table if not exists public.friend_groups (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create index if not exists friend_groups_owner_idx on public.friend_groups (owner_id);

alter table public.friend_groups enable row level security;

drop policy if exists "own groups all" on public.friend_groups;
create policy "own groups all"
  on public.friend_groups for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create table if not exists public.friend_group_members (
  group_id  uuid not null references public.friend_groups (id) on delete cascade,
  member_id uuid not null references auth.users (id) on delete cascade,
  primary key (group_id, member_id)
);

alter table public.friend_group_members enable row level security;

drop policy if exists "own group members all" on public.friend_group_members;
create policy "own group members all"
  on public.friend_group_members for all
  using (
    exists (select 1 from public.friend_groups g where g.id = group_id and g.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.friend_groups g where g.id = group_id and g.owner_id = auth.uid())
  );

-- ============================================================
-- 三、朋友圈可见范围（四档）
--   public   → 所有好友可见
--   groups   → 指定的好友分组可见
--   friends  → 仅指定好友可见（用 friend_post_audience）
--   private  → 仅自己可见
-- ============================================================

alter table public.friend_posts
  add column if not exists visibility text not null default 'public';

do $$
begin
  alter table public.friend_posts
    add constraint friend_posts_visibility_check
    check (visibility in ('public', 'groups', 'friends', 'private'));
exception
  when duplicate_object then null;
end $$;

-- 指定"部分好友可见"时，名单存在这里
create table if not exists public.friend_post_audience (
  post_id   uuid not null references public.friend_posts (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  primary key (post_id, friend_id)
);

alter table public.friend_post_audience enable row level security;

drop policy if exists "audience readable by post author" on public.friend_post_audience;
create policy "audience readable by post author"
  on public.friend_post_audience for select
  using (
    exists (select 1 from public.friend_posts p where p.id = post_id and p.author_id = auth.uid())
  );

drop policy if exists "audience writable by post author" on public.friend_post_audience;
create policy "audience writable by post author"
  on public.friend_post_audience for all
  using (
    exists (select 1 from public.friend_posts p where p.id = post_id and p.author_id = auth.uid())
  )
  with check (
    exists (select 1 from public.friend_posts p where p.id = post_id and p.author_id = auth.uid())
  );

-- ============================================================
-- 四、确认结果
-- ============================================================

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('blocks', 'friend_groups', 'friend_group_members', 'friend_post_audience')
order by tablename, cmd;

select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'friend_posts'
order by ordinal_position;
