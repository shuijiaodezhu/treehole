-- ============================================================
-- 已读位置存到数据库（解决「多端不同步 / 幻影红点」）
--
-- 为什么需要它：
--   现在"我读到哪儿了"是记在**浏览器本机**的
--   → 手机上读完了，电脑上还是红点 ✗（换设备各算各的）
--   → 换浏览器 / 清了数据，红点又冒出来 ✗
--   记到数据库里，任何设备都读同一份 ✓
--
-- 怎么用：
--   ① 整段粘到 Supabase → SQL Editor → Run（就是上次跑 world_feed 那个地方）
--   ② 跑完把结果截给我（成功 / 报错原文都行）
--   ③ 前端我已经写成"**表不存在也能正常工作**"：跑之前走本机，跑之后自动多端同步
--
-- 安全（和 world_feed 一样守住的）：
--   · 开启行级安全（RLS）✓ 每个人只能读写自己的行 ✓
--   · 只存"我读到哪一刻" ✓ 不存消息内容 ✓
-- ============================================================

create table if not exists public.conversation_reads (
  user_id         uuid        not null references auth.users (id) on delete cascade,
  conversation_id uuid        not null references public.conversations (id) on delete cascade,
  read_at         timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (user_id, conversation_id)
);

comment on table public.conversation_reads is '每个用户在每个会话里"读到哪一刻"（用于多端同步未读）';

-- 查"我在这些会话的已读位置"要快
create index if not exists conversation_reads_user_idx
  on public.conversation_reads (user_id);

-- ── 行级安全：只能碰自己的行 ──
alter table public.conversation_reads enable row level security;

drop policy if exists "read own conversation reads" on public.conversation_reads;
create policy "read own conversation reads"
  on public.conversation_reads for select
  using (auth.uid() = user_id);

drop policy if exists "insert own conversation reads" on public.conversation_reads;
create policy "insert own conversation reads"
  on public.conversation_reads for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own conversation reads" on public.conversation_reads;
create policy "update own conversation reads"
  on public.conversation_reads for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own conversation reads" on public.conversation_reads;
create policy "delete own conversation reads"
  on public.conversation_reads for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 自测（跑完上面之后，把下面两句也跑一下，结果发我）
-- ============================================================

-- ① 表建好了吗、能不能查（应该返回 0 行，不报错）
select count(*) as 我的已读记录数 from public.conversation_reads where user_id = auth.uid();

-- ② 策略在不在（应该有 4 行）
select policyname, cmd from pg_policies where tablename = 'conversation_reads';
