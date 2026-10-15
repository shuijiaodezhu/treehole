-- Realtime 补票：把剩下几张「该实时」的表加进发布
--
-- 背景：supabase-realtime.sql 当初加的是
--   messages / friendships / world_posts / world_comments / play_activities
-- 之后又有了朋友圈和冬日信箱，但**没加进发布** ——
-- 结果就是"新动态 / 新回信"只能靠自己刷新才看得到。
--
-- notifications 不在这里：它在 supabase-notifications.sql 的第八段里
-- （那份是新表，跟表一起加最不容易漏）。
--
-- 幂等：先查 pg_publication_tables，没有才 alter publication，重复跑没事。

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
-- 核查（只读）—— 应该看到 7 张表
-- ============================================================
-- select tablename from pg_publication_tables
-- where pubname = 'supabase_realtime' and schemaname = 'public'
-- order by tablename;
--
-- 期望：friend_posts / friendships / messages / notifications /
--       play_activities / winter_letters / world_comments / world_posts
