-- ============================================================
-- 让「图片」也能收藏
--
-- 问题：user_favorites.target_id 是 uuid，而图片的标识是 URL（不是 uuid），
--      所以单张图无法收藏。
-- 改法：把 target_id 改成 text（uuid 字符串本身就是合法 text，已有收藏不受影响）。
-- 在 Supabase → SQL Editor 里执行（幂等，可重复跑）。
-- ============================================================

alter table public.user_favorites
  alter column target_id type text using target_id::text;

-- 图片收藏约定：
--   kind      = 'image'
--   target_id = 图片的完整 URL
--   content   = 收藏时那条动态的正文（作为上下文，可空）
--   title     = 空
alter table public.user_favorites
  add column if not exists source_url text;   -- 可选：图片来源页面（帖子/动态）的地址

notify pgrst, 'reload schema';

-- ============================================================
-- 确认：target_id 应为 text
-- ============================================================
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'user_favorites'
order by ordinal_position;
