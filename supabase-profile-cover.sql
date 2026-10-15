-- ============================================================
-- 个人主页背景图
-- 在 Supabase → SQL Editor 里执行（幂等，可重复跑）
-- ============================================================

alter table public.profiles
  add column if not exists cover_url text;

notify pgrst, 'reload schema';

-- 确认
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'cover_url';
