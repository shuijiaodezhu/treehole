-- ============================================================
-- 派对（play）过期活动自动清理
--
-- ⚠️ 上一版 supabase-party-and-images.sql 找的是 world_categories ✗ 错了
--    「派对」不是院子的分区，它是独立的 play 模块 → 表是 **play_activities**
--    上一版里那个函数留着无害（找不到"派对"分区就返回 0），可以用这版替代
--
-- 用法：Supabase → SQL Editor → 整段粘贴 → Run（幂等）
-- ============================================================

-- ============================================================
-- ① 清理函数
--   p_days：几天算过期（默认 7 ✓ 你确认的）
--   清理方式：**真删除**（你说的是"过期就要删除" ✓）
--     顺带把报名记录一起删（play_signups 有外键，不删会报错）
--   安全阀：天数 < 1 一律按 1 天（防止手滑传 0 把派对清空）
-- ============================================================
create or replace function public.purge_expired_play_activities(
  p_days int default 7
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_count int;
begin
  if p_days is null or p_days < 1 then
    p_days := 1;
  end if;

  -- 先取出要清的 id（后面删报名、删活动都要用）
  select array_agg(id) into v_ids
    from public.play_activities
   where created_at < now() - (p_days || ' days')::interval;

  if v_ids is null or array_length(v_ids, 1) = 0 then
    return 0;
  end if;

  -- 先删报名（外键依赖）
  delete from public.play_signups where activity_id = any(v_ids);

  -- 再删活动本身
  delete from public.play_activities where id = any(v_ids);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.purge_expired_play_activities(int) is
  '删除派对里超过 N 天（默认 7）的活动，并清掉它们的报名记录。返回删除条数。';

-- 只允许登录用户触发（匿名没必要，也防刷）
revoke all on function public.purge_expired_play_activities(int) from public;
grant execute on function public.purge_expired_play_activities(int) to authenticated;

-- ============================================================
-- ② 让它自动跑（可选）
--    Supabase 免费版也支持 pg_cron：Database → Extensions 里开启后，
--    取消下面注释即可每天凌晨 4 点自动清理一次
-- ============================================================
-- create extension if not exists pg_cron;
-- select cron.schedule(
--   'purge-expired-play-activities',
--   '0 4 * * *',
--   $$select public.purge_expired_play_activities(7)$$
-- );

-- ============================================================
-- ③ 验证
-- ============================================================
-- 看看现在有多少超过 7 天的活动（不删，只数）
-- select count(*) from public.play_activities
--  where created_at < now() - interval '7 days';
--
-- 真的清一次（会返回删了几条）
-- select public.purge_expired_play_activities(7);

-- ============================================================
-- ④ 如果你不想真删（想留档）—— 跑这一段替代 ①
--    给活动加一个隐藏标记，清理函数改成打标记而不是删
--    （需要前端把 hidden 的活动过滤掉，我可以接上）
-- ============================================================
-- alter table public.play_activities add column if not exists hidden boolean not null default false;
-- create or replace function public.purge_expired_play_activities(p_days int default 7)
-- returns int language plpgsql security definer set search_path = public as $f$
-- declare v_count int;
-- begin
--   if p_days is null or p_days < 1 then p_days := 1; end if;
--   update public.play_activities set hidden = true
--    where hidden = false
--      and created_at < now() - (p_days || ' days')::interval;
--   get diagnostics v_count = row_count;
--   return v_count;
-- end; $f$;
