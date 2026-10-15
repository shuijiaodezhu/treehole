-- 《你的来信》一次性补跑
--
-- 用法：整份复制 → Supabase → SQL Editor → Run（一次跑完）
-- 每段都是幂等的（create ... if not exists / drop ... if exists / create or replace），
-- 重复跑不会报错，也不会重复建东西。
-- 顺序有讲究：第 1 段建了 public.push_notification，第 7 段要用它。

-- ============================================================
-- 第 1 段 · 通知系统（建表 + 触发器 + 加入 Realtime 发布）
-- 来源：supabase-notifications.sql
-- ============================================================
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,  -- 收件人
  kind       text not null,          -- mention / report / moderation / mailbox / friend
  title      text not null,
  body       text,
  link       text,                   -- 点进去的站内路径
  actor_id   uuid references auth.users (id) on delete set null,  -- 谁引起的（匿名场合留空）
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (user_id) where read_at is null;
alter table public.notifications enable row level security;
drop policy if exists "own notifications readable" on public.notifications;
create policy "own notifications readable"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);
drop policy if exists "own notifications updatable" on public.notifications;
create policy "own notifications updatable"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "own notifications deletable" on public.notifications;
create policy "own notifications deletable"
  on public.notifications for delete
  to authenticated
  using (auth.uid() = user_id);
grant select, update, delete on public.notifications to authenticated;
create or replace function public.push_notification(
  p_user  uuid,
  p_kind  text,
  p_title text,
  p_body  text default null,
  p_link  text default null,
  p_actor uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null then
    return;
  end if;
  if p_actor is not null and p_actor = p_user then
    return;
  end if;
  insert into public.notifications (user_id, kind, title, body, link, actor_id)
  values (p_user, p_kind, left(p_title, 120), left(coalesce(p_body, ''), 300), p_link, p_actor);
end;
$$;
create or replace function public.notify_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  token  text;
  target uuid;
  who    uuid;
begin
  who := case when coalesce(new.is_anonymous, false) then null else new.author_id end;
  for token in
    select distinct lower(m[1])
      from regexp_matches(new.content, '@([^[:space:]@]{1,20})', 'g') as m
  loop
    select id into target
      from public.profiles
     where lower(coalesce(username, '')) = token
        or lower(coalesce(nickname, '')) = token
     limit 1;
    if target is not null then
      perform public.push_notification(
        target,
        'mention',
        case when who is null then '有人在匿名内容里提到了你' else '有人提到了你' end,
        left(new.content, 120),
        case when TG_TABLE_NAME = 'world_posts' then '/world' else '/world' end,
        who
      );
    end if;
  end loop;
  return new;
end;
$$;
do $$
begin
  if to_regclass('public.world_posts') is not null then
    drop trigger if exists notify_mentions_post on public.world_posts;
    create trigger notify_mentions_post
      after insert on public.world_posts
      for each row execute function public.notify_mentions();
  end if;
  if to_regclass('public.world_comments') is not null then
    drop trigger if exists notify_mentions_comment on public.world_comments;
    create trigger notify_mentions_comment
      after insert on public.world_comments
      for each row execute function public.notify_mentions();
  end if;
end $$;
create or replace function public.notify_report_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status in ('resolved', 'dismissed') then
    perform public.push_notification(
      new.reporter_id,
      'report',
      case when new.status = 'resolved' then '你举报的内容已处理' else '你举报的内容看过了' end,
      case when new.status = 'resolved'
           then '站主已按公约处理。谢谢你帮忙看着这里。'
           else '站主看过之后认为没有违反公约。如果你觉得不对，可以直接说。' end,
      '/p/reporting',
      null
    );
  end if;
  return new;
end;
$$;
do $$
begin
  if to_regclass('public.reports') is not null then
    drop trigger if exists notify_report_result on public.reports;
    create trigger notify_report_result
      after update on public.reports
      for each row execute function public.notify_report_result();
  end if;
end $$;
create or replace function public.notify_post_moderated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.status is distinct from old.status and new.status in ('removed', 'hidden'))
     or (new.is_hidden is distinct from old.is_hidden and new.is_hidden) then
    perform public.push_notification(
      new.author_id,
      'moderation',
      '你的一条帖子被处理了',
      left(new.content, 120),
      '/p/community',
      null
    );
  end if;
  return new;
end;
$$;
do $$
begin
  if to_regclass('public.world_posts') is not null then
    drop trigger if exists notify_post_moderated on public.world_posts;
    create trigger notify_post_moderated
      after update on public.world_posts
      for each row execute function public.notify_post_moderated();
  end if;
end $$;
create or replace function public.notify_moment_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid() is distinct from old.author_id then
    perform public.push_notification(
      old.author_id,
      'moderation',
      '你的一条朋友圈被删除了',
      left(old.content, 120),
      '/p/community',
      null
    );
  end if;
  return old;
end;
$$;
do $$
begin
  if to_regclass('public.friend_posts') is not null then
    drop trigger if exists notify_moment_removed on public.friend_posts;
    create trigger notify_moment_removed
      before delete on public.friend_posts
      for each row execute function public.notify_moment_removed();
  end if;
end $$;
create or replace function public.notify_mailbox_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sender_id is distinct from new.thread_user_id then
    perform public.push_notification(
      new.thread_user_id,
      'mailbox',
      '冬日信箱有回信了',
      left(new.content, 120),
      '/',
      null
    );
  end if;
  return new;
end;
$$;
do $$
begin
  if to_regclass('public.winter_letters') is not null then
    drop trigger if exists notify_mailbox_reply on public.winter_letters;
    create trigger notify_mailbox_reply
      after insert on public.winter_letters
      for each row execute function public.notify_mailbox_reply();
  end if;
end $$;
create or replace function public.notify_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' then
    perform public.push_notification(
      new.addressee_id, 'friend', '有人想加你好友',
      '去小屋看看吧，同意之后就能聊天了。', '/friends', new.requester_id);
  end if;
  return new;
end;
$$;
create or replace function public.notify_friend_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status is distinct from new.status then
    perform public.push_notification(
      new.requester_id, 'friend', '好友申请通过了',
      '现在可以聊天了。', '/friends', new.addressee_id);
  end if;
  return new;
end;
$$;
do $$
begin
  if to_regclass('public.friendships') is not null then
    drop trigger if exists notify_friend_request on public.friendships;
    create trigger notify_friend_request
      after insert on public.friendships
      for each row execute function public.notify_friend_request();
    drop trigger if exists notify_friend_accepted on public.friendships;
    create trigger notify_friend_accepted
      after update on public.friendships
      for each row execute function public.notify_friend_accepted();
  end if;
end $$;
do $$
begin
  if to_regclass('public.notifications') is null then
    raise notice '跳过：还没有 notifications 表';
    return;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
notify pgrst, 'reload schema';

-- ============================================================
-- 第 2 段 · 状态（三个字）
-- 来源：supabase-status.sql
-- ============================================================
alter table public.profiles
  add column if not exists status_text text;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_status_text_len'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_status_text_len
      check (status_text is null or char_length(status_text) <= 3);
  end if;
end $$;
notify pgrst, 'reload schema';

-- ============================================================
-- 第 3 段 · 展示页开关
-- 来源：supabase-profile-page.sql
-- ============================================================
alter table public.profiles
  add column if not exists show_posts_on_profile boolean not null default true;
notify pgrst, 'reload schema';

-- ============================================================
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
