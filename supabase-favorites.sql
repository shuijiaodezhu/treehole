-- ============================================================
-- 「我的收藏」数据表
-- 在 Supabase → SQL Editor 里执行（可重复执行）
-- ============================================================

create table if not exists public.user_favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- 收藏对象的类型：帖子 / 活动 / 朋友圈 / 视频 / 图片
  kind        text not null check (kind in ('world_post', 'play_activity', 'moment', 'video', 'image')),
  target_id   uuid not null,
  -- 收藏时的内容快照：原内容被删掉后，收藏页仍能显示"当时收藏了什么"
  title       text,
  content     text,
  author_name text,
  created_at  timestamptz not null default now(),
  -- 同一个东西只能收藏一次
  unique (user_id, kind, target_id)
);

create index if not exists user_favorites_user_created_idx
  on public.user_favorites (user_id, created_at desc);

create index if not exists user_favorites_user_kind_idx
  on public.user_favorites (user_id, kind);

-- ---------- 行级安全：每个人只能看/改自己的收藏 ----------
alter table public.user_favorites enable row level security;

drop policy if exists "own favorites readable" on public.user_favorites;
create policy "own favorites readable"
  on public.user_favorites for select
  using (auth.uid() = user_id);

drop policy if exists "own favorites insertable" on public.user_favorites;
create policy "own favorites insertable"
  on public.user_favorites for insert
  with check (auth.uid() = user_id);

drop policy if exists "own favorites deletable" on public.user_favorites;
create policy "own favorites deletable"
  on public.user_favorites for delete
  using (auth.uid() = user_id);

-- 确认结果
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'user_favorites'
order by ordinal_position;
