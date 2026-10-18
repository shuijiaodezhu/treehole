-- ============================================================
-- 信箱的"回信通知" —— 补一个当初设计了、但一直没接上的东西
--
-- 现状（我查过代码）：
--   components/mailbox.tsx / admin-mailbox.tsx 发信时**完全没有写通知** ✗
--   notifications 表里虽然定义了 `mailbox` 这个 kind ✓（说明当初设计过 ✓）
--   但从来没有任何地方往里写 → 对面永远收不到提醒 ✗
--
-- 做法：用触发器（不能在前端写 ✗ 因为"给别人写通知"会被 RLS 拦着）
--   复用仓库里已有的唯一写通知入口 push_notification() ✓
--   （supabase-notifications.sql 里定义的那个 ✓ security definer ✓）
--
-- 用法：Supabase → SQL Editor → 整段粘贴 → Run（幂等，可重复跑）
-- ============================================================

-- ============================================================
-- ① 触发器函数
--
-- winter_letters 的结构：
--   thread_user_id = 信箱主人（这封信属于谁的信箱）
--   sender_id      = 写信/回信的人
--
-- 通知规则（只发"对面"）：
--   · 站主回信 → thread_user_id = 用户、sender_id = 站主
--       → **通知用户**「信箱里有新的回信」✓  ← 这就是你问的那件事
--   · 用户自己写信 → thread_user_id = sender_id = 用户
--       → 不发通知（自己不需要通知自己）✓
-- ============================================================
create or replace function public.notify_winter_letter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 只有"别人写进这个信箱"才通知主人
  if new.sender_id is distinct from new.thread_user_id then
    perform public.push_notification(
      new.thread_user_id,                     -- 通知谁：信箱主人
      'mailbox',                              -- 种类：信箱
      '信箱里有新的回信',
      left(new.content, 60),                  -- 正文摘要（最多 60 字）
      '/me',                                  -- 点进去的站内路径
      new.sender_id                           -- 谁回的
    );
  end if;
  return new;
end;
$$;

comment on function public.notify_winter_letter() is
  '信箱里出现"别人写的信/回信"时，给信箱主人发一条通知。';

-- ============================================================
-- ② 挂上触发器（先删再建，幂等）
-- ============================================================
drop trigger if exists winter_letter_notify on public.winter_letters;

create trigger winter_letter_notify
  after insert on public.winter_letters
  for each row
  execute function public.notify_winter_letter();

-- ============================================================
-- ③ 验证
-- ============================================================
-- 先看看 push_notification 这个函数在不在（不在就先跑 supabase-notifications.sql）
-- select proname from pg_proc where proname in ('push_notification', 'notify_winter_letter');
--
-- 看触发器挂上没有
-- select tgname, tgenabled from pg_trigger where tgrelid = 'public.winter_letters'::regclass;
--
-- 看最近的信箱通知
-- select kind, title, body, created_at from public.notifications
--  where kind = 'mailbox' order by created_at desc limit 10;

-- ============================================================
-- ④ 回滚（想撤掉就单独跑这一句）
-- ============================================================
-- drop trigger if exists winter_letter_notify on public.winter_letters;
-- drop function if exists public.notify_winter_letter();
