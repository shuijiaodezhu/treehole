-- 状态（挂在头像旁边的三个字）
--
-- 想做什么：像 QQ/微信那种「在线 - 5G」，但更安静 —— 自己选或自己写三个字，
-- 比如「学习中」「摸鱼中」「睡觉中」，只在小屋的聊天抬头、头像旁边显示。
--
-- 几条刻意的限制：
--   · **默认空**：不设置就什么都不显示（不占位、不显示"未设置"）
--   · **最多三个字**：多了在小地方看着脏（这里是数据库层的兜底，前端也限）
--   · 只在小屋聊天区的头像旁出现，**不在动态、帖子、广场上到处挂**
--
-- 幂等：字段与约束都存在性判断，重复跑不会报错。


-- 一、字段（默认 null = 不开启）
alter table public.profiles
  add column if not exists status_text text;


-- 二、长度约束
--
-- 用 do 块判断，避免重复跑时报「constraint already exists」。
-- 三个字是按"字"算的（char_length），不是字节 —— 中文一个字算一个。
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_status_text_len'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_status_text_len
      check (status_text is null or char_length(status_text) <= 3);
  end if;
end $$;


notify pgrst, 'reload schema';


-- ============================================================
-- 核查（只读）
-- ============================================================
-- 字段与约束
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'profiles' and column_name = 'status_text';
--
-- select conname, pg_get_constraintdef(oid) from pg_constraint
-- where conname = 'profiles_status_text_len';
--
-- 现在有谁设置了状态
-- select nickname, status_text from public.profiles where status_text is not null;
