-- 《你的来信》一次性补跑 · 第 2 好感度与举报
-- 用法：整份复制 → Supabase → SQL Editor → Run
-- 幂等，可重复跑；请按 1 → 2 → 3 的顺序执行（第 3 份依赖第 1 份的 push_notification）

-- 第 4 段 · 好感度 / 互动值
-- 来源：supabase-affinity.sql
-- ============================================================
alter table public.profiles
  add column if not exists affinity_public boolean not null default false;
create table if not exists public.affinity (
  from_id     uuid not null references auth.users (id) on delete cascade,
  to_id       uuid not null references auth.users (id) on delete cascade,
  score       int  not null default 0,
  today_score int  not null default 0,
  today       date not null default ((now() at time zone 'utc')::date),
  updated_at  timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);

-- 旧表缺列时补齐（主键与 check 不动，旧表一般已有）
alter table public.affinity add column if not exists from_id     uuid;
alter table public.affinity add column if not exists to_id       uuid;
alter table public.affinity add column if not exists score       int default 0;
alter table public.affinity add column if not exists today_score int default 0;
alter table public.affinity add column if not exists today       date;
alter table public.affinity add column if not exists updated_at  timestamptz default now();
create index if not exists affinity_to_idx on public.affinity (to_id, score desc);
alter table public.affinity enable row level security;
grant select on public.affinity to authenticated;
drop policy if exists "affinity readable by self or if published" on public.affinity;
create policy "affinity readable by self or if published"
  on public.affinity for select
  using (
    from_id = auth.uid()
    or (
      to_id = auth.uid()
      and exists (
        select 1 from public.profiles p
        where p.id = affinity.from_id and p.affinity_public is true
      )
    )
  );
create or replace function public.add_affinity(
  p_from uuid,
  p_to   uuid,
  p_points int,
  p_daily_cap int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  today_utc date := (now() at time zone 'utc')::date;
  cur_today int;
begin
  if p_from is null or p_to is null or p_from = p_to then
    return;
  end if;
  insert into public.affinity (from_id, to_id, score, today_score, today, updated_at)
  values (p_from, p_to, 0, 0, today_utc, now())
  on conflict (from_id, to_id) do nothing;
  select case when today = today_utc then today_score else 0 end
    into cur_today
    from public.affinity
   where from_id = p_from and to_id = p_to;
  if cur_today >= p_daily_cap then
    return;
  end if;
  update public.affinity
     set score       = score + p_points,
         today_score = cur_today + p_points,
         today       = today_utc,
         updated_at  = now()
   where from_id = p_from and to_id = p_to;
end;
$$;
create or replace function public.affinity_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  other uuid;
begin
  select case when user1_id = new.sender_id then user2_id else user1_id end
    into other
    from public.conversations
   where id = new.conversation_id;
  perform public.add_affinity(new.sender_id, other, 1, 20);
  return new;
end;
$$;
do $$
begin
  if to_regclass('public.messages') is null then
    raise notice '跳过：没有 messages 表';
    return;
  end if;
  drop trigger if exists affinity_on_message on public.messages;
  create trigger affinity_on_message
    after insert on public.messages
    for each row execute function public.affinity_from_message();
end $$;
create or replace function public.affinity_from_friend_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
begin
  select author_id into owner from public.friend_posts where id = new.post_id;
  if owner is null then
    return new;
  end if;
  perform public.add_affinity(new.user_id, owner, 2, 10);
  return new;
end;
$$;
do $$
begin
  if to_regclass('public.friend_likes') is null then
    raise notice '跳过：没有 friend_likes 表（点赞不加分，其余照常）';
    return;
  end if;
  drop trigger if exists affinity_on_friend_like on public.friend_likes;
  create trigger affinity_on_friend_like
    after insert on public.friend_likes
    for each row execute function public.affinity_from_friend_like();
end $$;
notify pgrst, 'reload schema';

-- ============================================================
-- 第 5 段 · 朋友圈举报（站主权限）
-- 来源：supabase-admin-moments.sql
-- ============================================================
drop policy if exists "admin manages friend_posts" on public.friend_posts;
create policy "admin manages friend_posts"
  on public.friend_posts for all
  to authenticated
  using (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid)
  with check (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid);
notify pgrst, 'reload schema';

-- ============================================================
-- 第 6 段 · 评论举报（站主权限）
-- 来源：supabase-admin-comments.sql
-- ============================================================
drop policy if exists "admin manages world_comments" on public.world_comments;
create policy "admin manages world_comments"
  on public.world_comments for all
  to authenticated
  using (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid)
  with check (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid);
notify pgrst, 'reload schema';

-- ============================================================
