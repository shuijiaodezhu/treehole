-- ============================================================
-- 两件事的数据库部分
--   ① 回复也能发图片（给世界评论加 image_urls）
--   ② 派对里过期的帖子自动清掉
--
-- 用法：Supabase → SQL Editor → 整段粘贴 → Run（可重复跑，幂等）
-- ============================================================

-- ============================================================
-- ① 世界评论（院子/派对的回复）支持图片
-- ============================================================
alter table public.world_comments
  add column if not exists image_urls text[];

comment on column public.world_comments.image_urls is
  '回复可以带图片（最多 3 张）。前端复用朋友圈那套 ImageWall 组件。';

-- 列级权限：现有 RLS 策略是按行的，加列不影响；
-- 但如果之前对 world_comments 做过列级 grant，这里补一下
grant select (image_urls) on public.world_comments to anon, authenticated;
grant insert (image_urls) on public.world_comments to authenticated;

-- ============================================================
-- ② 派对过期帖子清理
--
-- 背景：现在"派对"里的帖子**没有过期概念**（表里也没有 expires_at 字段）
-- 设计：**不加字段**，按 created_at 算 —— 超过 N 天的派对帖子视为过期
--   · 优点：不动已有数据、不用迁移
--   · 想改时长只要改调用时传的 p_days
--
-- 清理策略：**软删除**（status = 'expired'）而不是物理删除 ✗
--   · 软删除可逆、不会误删（万一时长设错了还能救）
--   · 帖子列表本来就按 status = 'published' 过滤 → 过期后自然不显示了
--   · 站主仍能在数据库里看到它们，需要时再真删
-- ============================================================
create or replace function public.purge_expired_party_posts(
  p_days int default 7,
  p_category_name text default '派对'
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  -- 安全阀：时长小于 1 天的一律按 1 天算（防止手滑传 0 把全部清空）
  if p_days is null or p_days < 1 then
    p_days := 1;
  end if;

  update public.world_posts p
     set status = 'expired'
    from public.world_categories c
   where p.category_id = c.id
     and c.name = p_category_name
     and p.status = 'published'
     and p.created_at < now() - (p_days || ' days')::interval;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.purge_expired_party_posts(int, text) is
  '把某个分区（默认"派对"）里超过 N 天（默认 7 天）的帖子软删除为 expired。返回受影响行数。';

-- 只允许登录用户调用（匿名也能触发清理没意义，还可能被刷）
revoke all on function public.purge_expired_party_posts(int, text) from public;
grant execute on function public.purge_expired_party_posts(int, text) to authenticated;

-- ============================================================
-- ③ （可选）让它自动跑：如果你开了 pg_cron，可以每天清一次
--     Supabase 免费版也支持 pg_cron（Database → Extensions 里开）
-- ============================================================
-- create extension if not exists pg_cron;
-- select cron.schedule(
--   'purge-expired-party-posts',
--   '0 4 * * *',                       -- 每天凌晨 4 点
--   $$select public.purge_expired_party_posts(7, '派对')$$
-- );

-- ============================================================
-- 验证（跑完这两句看结果）
-- ============================================================
-- 1) 字段加上了吗
-- select column_name, data_type from information_schema.columns
--  where table_name = 'world_comments' and column_name = 'image_urls';
--
-- 2) 函数在吗（会返回 0 行，说明还没有过期帖子）
-- select public.purge_expired_party_posts(7, '派对');
