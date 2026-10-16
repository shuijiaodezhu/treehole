-- 《你的来信》一次性补跑 · 第 1 通知与状态
-- 用法：整份复制 → Supabase → SQL Editor → Run
-- 幂等，可重复跑；请按 1 → 2 → 3 的顺序执行（第 3 份依赖第 1 份的 push_notification）

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

-- 若这张表是早期版本建的（列不全），在这里补齐缺的列（幂等）
alter table public.notifications add column if not exists id         uuid default gen_random_uuid();
alter table public.notifications add column if not exists user_id    uuid;
alter table public.notifications add column if not exists kind       text;
alter table public.notifications add column if not exists title      text;
alter table public.notifications add column if not exists body       text;
alter table public.notifications add column if not exists link       text;
alter table public.notifications add column if not exists actor_id   uuid;
alter table public.notifications add column if not exists read_at    timestamptz;
alter table public.notifications add column if not exists created_at timestamptz default now();
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
