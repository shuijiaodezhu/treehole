-- ============================================================
-- 拉黑相关表的【表级授权】补齐
-- 背景：blocks 等表已建好，但 PostgREST 看不到它们（前端查询报 404），
--      原因是缺少表级 GRANT。这份必须执行，否则拉黑功能不工作。
-- 幂等，可重复执行。
-- ============================================================

-- 拉黑表：只能自己读写自己的记录（行级由 RLS 策略限制）
grant select, insert, delete on public.blocks to authenticated;

-- 好友分组
grant select, insert, update, delete on public.friend_groups to authenticated;
grant select, insert, delete on public.friend_group_members to authenticated;

-- 朋友圈"部分好友可见"名单
grant select, insert, delete on public.friend_post_audience to authenticated;

-- 双向黑名单函数：只给登录用户
revoke all on function public.get_blocked_ids() from public;
grant execute on function public.get_blocked_ids() to authenticated;

-- 强制 PostgREST 刷新 schema 缓存（关键：新表常常需要这一下才会生效）
notify pgrst, 'reload schema';

-- ============================================================
-- 确认结果
-- ============================================================

-- 1) 四张表对 authenticated 的授权（应看到多行 select/insert/...）
select table_name, privilege_type, grantee
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('blocks', 'friend_groups', 'friend_group_members', 'friend_post_audience')
order by table_name, privilege_type;

-- 2) 四张表的 RLS 策略（应看到 own blocks readable / insertable / deletable 等）
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('blocks', 'friend_groups', 'friend_group_members', 'friend_post_audience')
order by tablename, cmd;
