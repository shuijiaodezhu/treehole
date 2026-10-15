-- 通知系统
--
-- 解决的是一整类问题：站内发生了跟你有关的事，**却没有任何地方告诉你**。
-- 一次补上这些来源：
--   · @ 提及        —— 帖子里提到你（匿名帖不暴露是谁提的）
--   · 举报结果      —— 你举报的东西站主处理了
--   · 内容被处理    —— 你的帖子/朋友圈被站主隐藏或删除
--   · 冬日信箱回信  —— 站主回你了（**不写是谁回的**，保持匿名）
--   · 好友申请/通过 —— 有人加你、你的申请通过了
--
-- 两条安全设计：
--   1. **不给客户端 insert 权限** —— 通知只由下面的触发器写，
--      否则任何人都能伪造一条"系统通知"发给别人
--   2. 所有触发器都是 security definer，并且会跳过"自己给自己发"
--
-- 幂等：表/索引 if not exists，函数 create or replace，触发器先 drop 再建。


-- ============================================================
-- 一、表
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

-- 只能读自己的
drop policy if exists "own notifications readable" on public.notifications;
create policy "own notifications readable"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

-- 只能标记自己的为已读
drop policy if exists "own notifications updatable" on public.notifications;
create policy "own notifications updatable"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 可以删掉自己的
drop policy if exists "own notifications deletable" on public.notifications;
create policy "own notifications deletable"
  on public.notifications for delete
  to authenticated
  using (auth.uid() = user_id);

-- 注意：**没有 insert 策略** —— 故意的，见文件头
grant select, update, delete on public.notifications to authenticated;


-- ============================================================
-- 二、写通知的唯一入口
-- ============================================================
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
  -- 不给自己发（比如自己编辑自己的帖子触发提及）
  if p_actor is not null and p_actor = p_user then
    return;
  end if;

  insert into public.notifications (user_id, kind, title, body, link, actor_id)
  values (p_user, p_kind, left(p_title, 120), left(coalesce(p_body, ''), 300), p_link, p_actor);
end;
$$;


-- ============================================================
-- 三、@ 提及
--
-- 从正文里抓 @xxx（用户名或昵称都认，大小写不敏感）。
-- 匿名帖：**不传 actor**，也就是不告诉被提及的人是谁提的。
-- ============================================================
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


-- ============================================================
-- 四、举报结果 → 通知举报人
-- ============================================================
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


-- ============================================================
-- 五、内容被处理 → 通知作者
-- ============================================================
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

-- 朋友圈：站主删除是**硬删**，所以只能挂在 before delete 上。
-- 自己删自己的不通知（auth.uid() 就是作者本人）。
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


-- ============================================================
-- 六、冬日信箱回信 → 通知写信的人
--
-- **不传 actor**：不能因为一条通知就暴露"回信的是谁"。
-- 信箱本来就是匿名的，这里保持一致。
-- ============================================================
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


-- ============================================================
-- 七、好友申请 / 通过
-- ============================================================
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


-- ============================================================
-- 八、加入 Realtime 发布 —— 让通知「一发就到」
--
-- 不加入发布的话，前端订阅也收不到任何东西（Realtime 只推送发布里的表），
-- 那就只能靠轮询，最坏要等几分钟。
--
-- 幂等：先查发布里有没有这张表，没有才加。
-- ============================================================
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
-- 核查（只读）
-- ============================================================
-- 表与策略（应有 3 条：select / update / delete，**没有 insert**）
-- select policyname, cmd from pg_policies
-- where schemaname = 'public' and tablename = 'notifications';
--
-- 触发器（应有 8 个）
-- select tgname, tgrelid::regclass from pg_trigger
-- where tgname like 'notify_%' order by tgname;
--
-- Realtime 发布里有没有它（应有 1 行）
-- select tablename from pg_publication_tables
-- where pubname = 'supabase_realtime' and tablename = 'notifications';
--
-- 最近的通知
-- select kind, title, created_at from public.notifications order by created_at desc limit 20;
