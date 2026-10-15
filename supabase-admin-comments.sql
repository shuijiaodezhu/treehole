-- 评论举报：让《举报处理流程》里"评论也可以举报"重新成立
--
-- 这次不是改文案，是把功能补齐（上一次是先把文案改准成"暂时不能"）：
--   · 数据库：world_comments 加管理员策略（读 + 删）
--   · 页面：院子里的每条评论多一个「举报」（可撤回）
--   · 后台：多一块「评论举报」，可以忽略或删除这条评论
--
-- 幂等：先 drop 再建。

drop policy if exists "admin manages world_comments" on public.world_comments;
create policy "admin manages world_comments"
  on public.world_comments for all
  to authenticated
  using (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid)
  with check (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid);

notify pgrst, 'reload schema';


-- ============================================================
-- 核查（只读）
-- ============================================================
-- select policyname, cmd from pg_policies
-- where schemaname = 'public' and tablename = 'world_comments';
--
-- 待处理的评论举报
-- select id, reporter_id, target_id, reason, created_at from public.reports
-- where target_type = 'world_comment' and status = 'pending' order by created_at desc;
