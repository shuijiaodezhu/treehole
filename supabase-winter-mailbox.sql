-- 冬日信箱：独立的表
--
-- 为什么不用 conversations / messages：
--   那两张表是「好友私聊」的频道。拿它当信箱会有两个副作用——
--     · 用户的好友列表里会凭空多出一个和站主的会话，混在一起，影响使用体验
--     · 站主后台的收件箱会把所有好友私聊一并列出来，同样混乱
--   所以信箱自己一张表，和私聊完全分开。
--
-- 结构：一行 = 一封信。
--   thread_user_id  这封信属于谁的信箱（写信的人，不是站主）
--   sender_id       谁写的（写信的人本人，或站主）
--   content         正文
--
-- 隐私由 RLS 保证（不是靠前端过滤）：
--   · 只有 thread_user_id 本人和站主能读
--   · 只能以自己的身份写；用户写进自己的信箱，站主回进对方的信箱
--
-- 送信任一方看：跑完这段，选区的「Success. No rows returned」是正常的。

create table if not exists public.winter_letters (
  id             uuid primary key default gen_random_uuid(),
  thread_user_id uuid not null,
  sender_id      uuid not null,
  content        text not null,
  created_at     timestamptz not null default now()
);

-- 按信箱取信、按时间排
create index if not exists winter_letters_thread_idx
  on public.winter_letters (thread_user_id, created_at);

-- 站主后台按时间看最新来信
create index if not exists winter_letters_created_idx
  on public.winter_letters (created_at desc);

alter table public.winter_letters enable row level security;

-- ① 读：只有写信人本人和站主
drop policy if exists "winter letters readable by writer and owner" on public.winter_letters;
create policy "winter letters readable by writer and owner"
  on public.winter_letters
  for select
  using (
    thread_user_id = auth.uid()
    or auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid
  );

-- ② 写：只能以自己的身份写
--    用户 → 写进自己的信箱（thread_user_id = 自己）
--    站主 → 回进对方的信箱（thread_user_id = 对方，sender_id = 站主）
drop policy if exists "winter letters insert by self" on public.winter_letters;
create policy "winter letters insert by self"
  on public.winter_letters
  for insert
  with check (
    sender_id = auth.uid()
    and (
      thread_user_id = auth.uid()
      or auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid
    )
  );

-- 不给 update / delete 策略：信寄出去就改不了、删不了（信就是信）
-- 已读状态因此不放表里，各自在本地记，也就不存在「谁能改谁的信」的问题。

grant select, insert on public.winter_letters to authenticated;

-- 让 PostgREST 立刻认识这张表（否则前端会拿到 404 / PGRST205）
notify pgrst, 'reload schema';


-- ============================================================
-- 核查（可选，只读）：确认策略和 RLS 都在
-- ============================================================
-- select tablename, policyname, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public' and tablename = 'winter_letters';
--
-- select relname, relrowsecurity
-- from pg_class where relname = 'winter_letters';
