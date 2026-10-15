-- 让站主能处理「朋友圈动态」的举报
--
-- 背景：举报机制原本只覆盖院子帖子与聚会活动，朋友圈**连举报入口都没有**，
-- 而《举报处理流程》里却写着"朋友圈也可以举报"—— 承诺了做不到的事。
-- 这个文件补上数据库这一半，代码那一半（入口 + 后台处理）同一次提交里改了。
--
-- 为什么需要这条策略：`friend_posts` 原本只允许作者本人读写，
-- 站主即使看得到举报，**也读不到被举报的内容、更删不掉**。
--
-- 幂等：先 drop 再建，重复跑没事。

drop policy if exists "admin manages friend_posts" on public.friend_posts;
create policy "admin manages friend_posts"
  on public.friend_posts for all
  to authenticated
  using (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid)
  with check (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid);

notify pgrst, 'reload schema';


-- ============================================================
-- 核查（只读）
-- ============================================================
-- select policyname, cmd, qual from pg_policies
-- where schemaname = 'public' and tablename = 'friend_posts';
--
-- 待处理的朋友圈举报
-- select id, reporter_id, target_id, reason, created_at from public.reports
-- where target_type = 'friend_post' and status = 'pending' order by created_at desc;
