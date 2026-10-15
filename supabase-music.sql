-- 听音乐模块：上传音频 + 一起听 + 在场人数 + 匿名/公开聊天
--
-- 三张东西：
--   1. storage 里的 music 桶（公开读；登录用户只能往自己 uid 目录里传）
--   2. public.music_tracks —— 曲目（谁传的、标题、地址、大小）
--   3. public.music_messages —— 每个曲目下的聊天
--
-- 「几个人在听」**不用表**：用 Realtime Presence（见 app/music 里的实现），
-- 谁在房间里谁就 track 一下自己，人数是实时算出来的，不进数据库。
--
-- 关于匿名聊天（和院子的匿名帖是同一套做法，所以口径一致）：
--   界面上可以选匿名，别人看到的是「匿名用户 XXXXXXXX」；
--   但 sender_id **照常记录** —— 不然本人删不掉自己的话、站主也没法处理举报。
--   也就是说：**匿名是界面层面的，不是加密的**。这一点在代码注释和公约里都要写清。
--
-- 幂等：桶/表/索引 if not exists，策略先 drop 再建，重复跑没事。
--
-- ⚠️ 整段一起跑（触发器/策略依赖上面的表）。


-- ============================================================
-- 一、music 桶
-- ============================================================
insert into storage.buckets (id, name, public)
values ('music', 'music', true)
on conflict (id) do update set public = true;

-- 只能往自己 uid 命名的目录里传
drop policy if exists "music upload own folder" on storage.objects;
create policy "music upload own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'music'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 任何人可读（桶本身是 public，配合这条 select 策略）
drop policy if exists "music public read" on storage.objects;
create policy "music public read"
  on storage.objects for select
  using (bucket_id = 'music');

-- 本人可删自己目录里的
drop policy if exists "music delete own" on storage.objects;
create policy "music delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'music'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================
-- 二、曲目表
-- ============================================================
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

-- 站主可清理任何一首
drop policy if exists "admin manages music tracks" on public.music_tracks;
create policy "admin manages music tracks"
  on public.music_tracks for all
  to authenticated
  using (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid)
  with check (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid);

grant select, insert, delete on public.music_tracks to authenticated;


-- ============================================================
-- 三、每个曲目下的聊天
-- ============================================================
create table if not exists public.music_messages (
  id           uuid primary key default gen_random_uuid(),
  track_id     uuid not null references public.music_tracks (id) on delete cascade,
  sender_id    uuid not null references auth.users (id) on delete cascade,
  is_anonymous boolean not null default false,
  anonymous_id text,                      -- 匿名时显示成「匿名用户 XXXXXXXX」
  content      text not null,
  created_at   timestamptz not null default now()
);

create index if not exists music_messages_track_idx
  on public.music_messages (track_id, created_at);

alter table public.music_messages enable row level security;

drop policy if exists "music chat readable" on public.music_messages;
create policy "music chat readable"
  on public.music_messages for select
  to authenticated
  using (true);

-- 只能用**自己**的身份写（匿名与否都不影响这一条，sender_id 永远是本人）
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


-- ============================================================
-- 四、加入 Realtime 发布
--
-- 聊天要"一发就到"，所以 music_messages 必须在发布里；
-- 曲目列表也一起（别人传了新歌，列表当场多一首）。
-- ============================================================
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


-- ============================================================
-- 核查（只读）
-- ============================================================
-- 桶与策略（music 应有 3 条策略）
-- select policyname, cmd from pg_policies
-- where schemaname = 'storage' and tablename = 'objects' and policyname like 'music%';
--
-- 两张表与策略
-- select tablename, policyname, cmd from pg_policies
-- where schemaname = 'public' and tablename in ('music_tracks', 'music_messages')
-- order by tablename, policyname;
--
-- 发布（应有 music_messages 与 music_tracks 两行）
-- select tablename from pg_publication_tables
-- where pubname = 'supabase_realtime' and tablename like 'music%';
--
-- 现在有多少首、多大
-- select count(*) as 首数, pg_size_pretty(sum(size_bytes)) as 合计 from public.music_tracks;
