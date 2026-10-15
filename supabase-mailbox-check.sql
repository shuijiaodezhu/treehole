-- 好友私聊（conversations + messages）的隐私核查
--
-- 注意：冬日信箱**已经独立成表**，不看这两张表了——它自己的 RLS 见
-- supabase-winter-mailbox.sql（那个文件末尾也带了核查语句）。
-- 这个脚本现在只用来核对好友私聊的隔离，属于可选检查。
--
-- 背景：信箱直接复用 conversations + messages 两张表，
-- 所以「只有你和站主看得到」这件事**不是靠前端过滤**，而是靠这两张表的 RLS 策略。
-- 前端只按 conversation_id 查询，那只是查询条件，不是安全边界。
--
-- 这个脚本是**只读**的，不改任何东西。在 Supabase → SQL Editor 里跑一下，
-- 你应该能看到 messages / conversations 上各有几条策略。
-- 如果那两栏是空的，就说明表上没有策略 → 那时把下面「可选」那段也跑一遍。

-- ① 看现在有哪些策略（把结果里每行都读一遍，确认带 auth.uid() 的参与人判断）
select
  tablename,
  policyname,
  cmd          as 适用操作,
  qual         as using_条件,
  with_check   as with_check_条件
from pg_policies
where schemaname = 'public'
  and tablename in ('messages', 'conversations')
order by tablename, cmd, policyname;


-- ② 确认两张表都开了 RLS（relrowsecurity 必须是 true）
select
  c.relname                                             as 表名,
  c.relrowsecurity                                      as 开启了RLS,
  count(p.policyname)                                   as 策略条数
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p
       on p.schemaname = 'public' and p.tablename = c.relname
where n.nspname = 'public'
  and c.relname in ('messages', 'conversations')
group by c.relname, c.relrowsecurity;


-- ============================================================
-- 可选：如果 ① 的结果是空的（表上没有策略），再跑下面这段
-- 它保证：只有会话的双方能读，且只能以自己的身份往自己参与的会话里发
-- ============================================================
-- alter table public.conversations enable row level security;
-- alter table public.messages      enable row level security;
--
-- drop policy if exists "conversations readable by participants" on public.conversations;
-- create policy "conversations readable by participants"
--   on public.conversations for select
--   using (user1_id = auth.uid() or user2_id = auth.uid());
--
-- drop policy if exists "conversations insert by self" on public.conversations;
-- create policy "conversations insert by self"
--   on public.conversations for insert
--   with check (user1_id = auth.uid() or user2_id = auth.uid());
--
-- drop policy if exists "messages readable by participants" on public.messages;
-- create policy "messages readable by participants"
--   on public.messages for select
--   using (exists (
--     select 1 from public.conversations c
--     where c.id = messages.conversation_id
--       and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
--   ));
--
-- drop policy if exists "messages insert by participants" on public.messages;
-- create policy "messages insert by participants"
--   on public.messages for insert
--   with check (
--     sender_id = auth.uid()
--     and exists (
--       select 1 from public.conversations c
--       where c.id = messages.conversation_id
--         and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
--     )
--   );
--
-- notify pgrst, 'reload schema';
