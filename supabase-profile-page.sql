-- 展示页：每个人一个，别人点你头像能进来
--
-- 只需要一个字段：要不要在展示页里列出我公开的帖子。
-- 其余内容（头像、昵称、签名、状态、加入时间）本来就是资料里的，
-- 展示页只是把它们排出来，不再单独复制一份。
--
-- 有意为之的几条规则（写在页面代码里，这里说明一下）：
--   · **匿名帖永远不出现在展示页** —— 否则等于把人揭穿
--   · 好感度那一行显示的是「**看的人**对 TA 的好感度」（各看各的），
--     不是摊开对方的隐私
--   · 默认 true：帖子本来就是发在院子里给大家看的
--
-- 幂等，重复跑没事。

alter table public.profiles
  add column if not exists show_posts_on_profile boolean not null default true;

notify pgrst, 'reload schema';


-- ============================================================
-- 核查（只读）
-- ============================================================
-- select column_name, data_type, column_default
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'profiles'
--   and column_name = 'show_posts_on_profile';
