-- 《你的来信》一次性补跑 · 第 3 停用与音乐
-- 用法：整份复制 → Supabase → SQL Editor → Run
-- 幂等，可重复跑；请按 1 → 2 → 3 的顺序执行（第 3 份依赖第 1 份的 push_notification）

-- 第 7 段 · 站内停用账号（依赖第 1 段）
-- 来源：supabase-admin-ban.sql
-- ============================================================
create or replace function public.admin_set_ban(
  p_target uuid,
  p_days   int,                 -- 0 或 null = 解除封禁
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  until_ts timestamptz;
begin
  if auth.uid() is null or auth.uid() <> 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid then
    raise exception '只有站主能做这个操作';
  end if;
  if p_target is null then
    raise exception '缺少要处理的用户';
  end if;
  if p_target = auth.uid() then
    raise exception '不能停用你自己的账号';
  end if;
  until_ts := case
    when p_days is null or p_days <= 0 then null
    else now() + (p_days || ' days')::interval
  end;
  update auth.users
     set banned_until = until_ts
   where id = p_target;
  if not found then
    raise exception '没有找到这个用户';
  end if;
  if until_ts is not null then
    perform public.push_notification(
      p_target,
      'moderation',
      '你的账号已被停用',
      coalesce(p_reason, '违反了《社区公约》。') || ' ' ||
        '解封时间：' || to_char(until_ts, 'YYYY-MM-DD HH24:MI') ||
        '。有疑问可以在《申诉机制》里找到联系方式。',
      '/p/appeal',
      null
    );
  end if;
end;
$$;
revoke all on function public.admin_set_ban(uuid, int, text) from public;
grant execute on function public.admin_set_ban(uuid, int, text) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================
-- 第 8 段 · 朋友圈与冬日信箱加入 Realtime 发布
-- 来源：supabase-realtime-more.sql
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array['friend_posts', 'winter_letters']
  loop
    if to_regclass('public.' || t) is null then
      raise notice '跳过 %：表不存在', t;
      continue;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
      raise notice '已加入发布：%', t;
    else
      raise notice '本来就在发布里：%', t;
    end if;
  end loop;
end $$;
notify pgrst, 'reload schema';

-- ============================================================
-- 第 9 段 · 听音乐（桶 + 两张表 + 发布）
-- 来源：supabase-music.sql
-- ============================================================
insert into storage.buckets (id, name, public)
values ('music', 'music', true)
on conflict (id) do update set public = true;
drop policy if exists "music upload own folder" on storage.objects;
create policy "music upload own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'music'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "music public read" on storage.objects;
create policy "music public read"
  on storage.objects for select
  using (bucket_id = 'music');
drop policy if exists "music delete own" on storage.objects;
create policy "music delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'music'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create table if not exists public.music_tracks (
  id           uuid primary key default gen_random_uuid(),
  uploader_id  uuid not null references auth.users (id) on delete cascade,
  title        text not null,
  artist       text,                      -- 可留空
  url          text not null,             -- 桶里的公开地址
  size_bytes   bigint not null default 0,
  duration_sec int,                       -- 前端读到时长后回填，可为空
  created_at   timestamptz not null default now()
);

-- 若这张表是早期版本建的，补齐缺的列（幂等）
alter table public.music_tracks add column if not exists id           uuid default gen_random_uuid();
alter table public.music_tracks add column if not exists uploader_id  uuid;
alter table public.music_tracks add column if not exists title        text;
alter table public.music_tracks add column if not exists artist       text;
alter table public.music_tracks add column if not exists url          text;
alter table public.music_tracks add column if not exists size_bytes   bigint default 0;
alter table public.music_tracks add column if not exists duration_sec int;
alter table public.music_tracks add column if not exists created_at   timestamptz default now();
create index if not exists music_tracks_created_idx
  on public.music_tracks (created_at desc);
alter table public.music_tracks enable row level security;
drop policy if exists "music tracks readable" on public.music_tracks;
create policy "music tracks readable"
  on public.music_tracks for select
  to authenticated
  using (true);
drop policy if exists "music tracks insert own" on public.music_tracks;
create policy "music tracks insert own"
  on public.music_tracks for insert
  to authenticated
  with check (auth.uid() = uploader_id);
drop policy if exists "music tracks delete own" on public.music_tracks;
create policy "music tracks delete own"
  on public.music_tracks for delete
  to authenticated
  using (auth.uid() = uploader_id);
drop policy if exists "admin manages music tracks" on public.music_tracks;
create policy "admin manages music tracks"
  on public.music_tracks for all
  to authenticated
  using (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid)
  with check (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid);
grant select, insert, delete on public.music_tracks to authenticated;
create table if not exists public.music_messages (
  id           uuid primary key default gen_random_uuid(),
  track_id     uuid not null references public.music_tracks (id) on delete cascade,
  sender_id    uuid not null references auth.users (id) on delete cascade,
  is_anonymous boolean not null default false,
  anonymous_id text,                      -- 匿名时显示成「匿名用户 XXXXXXXX」
  content      text not null,
  created_at   timestamptz not null default now()
);

-- 若这张表是早期版本建的，补齐缺的列（幂等）
alter table public.music_messages add column if not exists id           uuid default gen_random_uuid();
alter table public.music_messages add column if not exists track_id     uuid;
alter table public.music_messages add column if not exists sender_id    uuid;
alter table public.music_messages add column if not exists is_anonymous boolean default false;
alter table public.music_messages add column if not exists anonymous_id text;
alter table public.music_messages add column if not exists content      text;
alter table public.music_messages add column if not exists created_at   timestamptz default now();
create index if not exists music_messages_track_idx
  on public.music_messages (track_id, created_at);
alter table public.music_messages enable row level security;
drop policy if exists "music chat readable" on public.music_messages;
create policy "music chat readable"
  on public.music_messages for select
  to authenticated
  using (true);
drop policy if exists "music chat insert own" on public.music_messages;
create policy "music chat insert own"
  on public.music_messages for insert
  to authenticated
  with check (auth.uid() = sender_id);
drop policy if exists "music chat delete own" on public.music_messages;
create policy "music chat delete own"
  on public.music_messages for delete
  to authenticated
  using (auth.uid() = sender_id);
drop policy if exists "admin manages music chat" on public.music_messages;
create policy "admin manages music chat"
  on public.music_messages for all
  to authenticated
  using (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid)
  with check (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid);
grant select, insert, delete on public.music_messages to authenticated;
do $$
declare
  t text;
begin
  foreach t in array array['music_tracks', 'music_messages']
  loop
    if to_regclass('public.' || t) is null then
      raise notice '跳过 %：表不存在', t;
      continue;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
      raise notice '已加入发布：%', t;
    else
      raise notice '本来就在发布里：%', t;
    end if;
  end loop;
end $$;
notify pgrst, 'reload schema';
