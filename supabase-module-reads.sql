-- ============================================================
-- 各模块的"上次看到这里"也存到数据库（多端同步 · 第二部分）
--
-- 第一部分做了「私信已读」（conversation_reads ✓ 你已经跑过 ✓）
-- 这一部分做**院子 / 小屋 / 朋友圈**这些模块的已读位置：
--   现在它们记在**浏览器本机** → 手机上点了，电脑上还是有红点 ✗
--
-- 怎么用：
--   ① 整段粘到 Supabase → SQL Editor → Run（和上次同一个地方）
--   ② 把最后两句自测的结果截给我
--   ③ 前端我已经写成"**表不存在也能正常工作**"：跑之前走本机，跑之后自动多端同步
--
-- 安全：开启 RLS ✓ 每个人只能读写自己的行 ✓ 只存"读到哪一刻" ✓ 不存任何内容 ✓
-- ============================================================

create table if not exists public.module_reads (
  user_id     uuid        not null references auth.users (id) on delete cascade,
  module      text        not null,
  read_at     timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, module)
);

comment on table public.module_reads is '各模块（world/friends/moments/...）每个用户"读到哪一刻"，用于多端同步未读';

create index if not exists module_reads_user_idx on public.module_reads (user_id);

alter table public.module_reads enable row level security;

drop policy if exists "read own module reads" on public.module_reads;
create policy "read own module reads"
  on public.module_reads for select
  using (auth.uid() = user_id);

drop policy if exists "insert own module reads" on public.module_reads;
create policy "insert own module reads"
  on public.module_reads for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own module reads" on public.module_reads;
create policy "update own module reads"
  on public.module_reads for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own module reads" on public.module_reads;
create policy "delete own module reads"
  on public.module_reads for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 自测（跑完上面之后，把下面两句也跑一下）
-- ============================================================

-- ① 能查吗（应返回 0，不报错）
select count(*) as 我的模块已读记录 from public.module_reads where user_id = auth.uid();

-- ② 策略在不在（应有 4 行）
select policyname, cmd from pg_policies where tablename = 'module_reads';
