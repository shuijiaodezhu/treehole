-- ============================================================
-- 站主后台操作失败（界面以为成功、刷新又出现）的诊断与加固
--
-- 背景：PostgREST 在 RLS 把行过滤掉时**不报错**，只影响 0 行。
-- 前端若只看 error，就会「删了但没删掉」。代码那边已改为校验影响行数，
-- 这份 SQL 负责把数据库侧的权限补对。
-- ============================================================

-- ------------------------------------------------------------
-- 第一步：先看现状（把你看到的结果发我，能精确定位是哪张表的问题）
-- ------------------------------------------------------------

-- 1) 这几张表开了 RLS 吗？有没有策略？
select tablename, policyname, cmd,
       coalesce(qual, '(无 using)')       as using_expr,
       coalesce(with_check, '(无 with_check)') as check_expr
from pg_policies
where schemaname = 'public'
  and tablename in ('categories', 'reports', 'play_activities', 'world_posts')
order by tablename, cmd;

-- 2) 是否开着 RLS（true = 必须有策略才放行）
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('categories', 'reports', 'play_activities', 'world_posts')
order by relname;

-- ------------------------------------------------------------
-- 第二步：加固 —— 让站主对这几张表有完整权限
-- （策略是「或」关系，新增不会破坏已有规则；幂等可重复跑）
-- ------------------------------------------------------------

-- 分区：审核通过（更新状态）与拒绝（删除申请）
drop policy if exists "admin manages categories" on public.categories;
create policy "admin manages categories"
  on public.categories for all
  to authenticated
  using (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid)
  with check (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid);

-- 举报：标记忽略 / 已处理
drop policy if exists "admin manages reports" on public.reports;
create policy "admin manages reports"
  on public.reports for all
  to authenticated
  using (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid)
  with check (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid);

-- 聚会活动：站主可下架
drop policy if exists "admin manages activities" on public.play_activities;
create policy "admin manages activities"
  on public.play_activities for all
  to authenticated
  using (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid)
  with check (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid);

-- 院子帖子：站主可隐藏 / 删除（举报处理里用到）
drop policy if exists "admin manages world_posts" on public.world_posts;
create policy "admin manages world_posts"
  on public.world_posts for all
  to authenticated
  using (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid)
  with check (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid);

-- 让 PostgREST 立刻感知策略变化
notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 第三步：确认（categories 应至少多出一条 admin manages categories）
-- ------------------------------------------------------------
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('categories', 'reports', 'play_activities', 'world_posts')
order by tablename, policyname;
