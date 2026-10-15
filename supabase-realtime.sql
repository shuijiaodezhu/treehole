-- 让「实时」真正生效
--
-- 代码里订阅了 postgres_changes 的表，必须先在数据库里加入 supabase_realtime 发布。
-- **不加也能用**：聊天页留了每 20 秒的兜底轮询，只是慢一点；
-- 加了之后才是「对方一发，你这边立刻出现」。
--
-- 幂等写法：已经在发布里的表不会重复加（直接 alter 会报 already member of publication）。
-- 跑完选区的「Success. No rows returned」是正常的。

do $$
declare
  t text;
begin
  foreach t in array array[
    'messages',         -- 私信（小屋聊天 + 角标）
    'friendships',      -- 好友申请角标
    'world_posts',      -- 院子新帖
    'world_comments',   -- 有人在院子回我
    'play_activities'   -- 聚会新活动
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
      raise notice '已加入 Realtime：%', t;
    else
      raise notice '已在 Realtime 里，跳过：%', t;
    end if;
  end loop;
end $$;


-- ============================================================
-- 核查（只读）：看看这几张表现在在不在发布里
-- ============================================================
-- select tablename from pg_publication_tables
-- where pubname = 'supabase_realtime' and schemaname = 'public'
-- order by tablename;
