-- 会话的「最后一条消息时间」
--
-- 解决什么：好友列表要按「最近聊过」排序。之前是在前端把最近 400 条消息拉回来、
-- 自己算每个会话的最新一条 —— 好友一多、消息一多，就可能算漏，
-- 那个好友会掉到「没有记录」那一档去。现在让数据库记住这件事，O(1) 取用，永远准。
--
-- 幂等：字段和索引都是 if not exists，触发器先 drop 再建，重复跑不会报错。
-- 跑完选区的「Success. No rows returned」是正常的。
--
-- 注意：**不跑这段也不会坏**。前端会先试着读 last_message_at，
-- 读不到（字段不存在）就自动退回原来的算法，只是又受 400 条的限制而已。


-- ① 字段
alter table public.conversations
  add column if not exists last_message_at timestamptz;

-- ② 回填历史：每个会话取现有消息里最新的一条
update public.conversations c
   set last_message_at = m.max_at
  from (
    select conversation_id, max(created_at) as max_at
    from public.messages
    group by conversation_id
  ) m
 where m.conversation_id = c.id
   and (c.last_message_at is null or c.last_message_at < m.max_at);

-- ③ 排序用的索引（desc + nulls last 和界面上的排序一致）
create index if not exists conversations_last_message_idx
  on public.conversations (last_message_at desc nulls last);


-- ④ 触发器：以后每来一条消息就顺手更新时间
--
-- 用 security definer 的原因：这条触发器要去 update conversations，
-- 而发消息的人未必有 conversations 的 update 权限（RLS 会静默过滤成 0 行，
-- 不报错但也不生效）。以表主的身份跑就没这个问题。
create or replace function public.touch_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    -- greatest 会忽略 null，所以 last_message_at 还是空的时候也能正确取到新值
    update public.conversations
       set last_message_at = greatest(last_message_at, new.created_at)
     where id = new.conversation_id;
    return new;
  else
    -- 删消息时重算，免得留下一个已经不存在的「最后时间」
    update public.conversations c
       set last_message_at = (
         select max(created_at) from public.messages where conversation_id = c.id
       )
     where c.id = old.conversation_id;
    return old;
  end if;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert or delete on public.messages
  for each row execute function public.touch_conversation_last_message();


-- 让 PostgREST 立刻认识新字段
notify pgrst, 'reload schema';


-- ============================================================
-- 核查（只读）
-- ============================================================
-- 看看回填对不对：两边应该一致
-- select c.id, c.last_message_at,
--        (select max(created_at) from public.messages m where m.conversation_id = c.id) as 实际最新
-- from public.conversations c
-- order by c.last_message_at desc nulls last
-- limit 20;
