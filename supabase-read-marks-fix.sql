-- ============================================================
-- 修「已读位置永远不更新」：conversation_reads / module_reads 缺唯一约束
--
-- 现象（用户查出来的）：
--   同一个 conversation_id 在表里有**两行** ✗（应该只有一行）
--   → 说明表上没有 unique (user_id, conversation_id) ✗
--   → 前端写的 upsert(onConflict: 'user_id,conversation_id') 每次都失败 ✗
--   → 所以「我读到哪一刻」永远停在旧值 ✓
--   → 表现：重装 App / 换设备后，角标显示的还是很久以前的未读数 ✗
--
-- 修法：先去重（每组只留 read_at 最新的那行），再加唯一约束 ✓
-- 用法：Supabase → SQL Editor → 整段粘贴 → Run（幂等）
-- ============================================================

-- ============================================================
-- ① conversation_reads：去重
-- ============================================================
delete from public.conversation_reads a
using public.conversation_reads b
where a.user_id = b.user_id
  and a.conversation_id = b.conversation_id
  and a.read_at < b.read_at;

-- 如果时间完全相同的重复行，上面的语句删不掉（a.read_at < b.read_at 不成立）
-- 再用 ctid 兜底删一次：
delete from public.conversation_reads a
using public.conversation_reads b
where a.user_id = b.user_id
  and a.conversation_id = b.conversation_id
  and a.read_at = b.read_at
  and a.ctid > b.ctid;

-- ② conversation_reads：加唯一约束
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'conversation_reads_user_conv_key'
       and conrelid = 'public.conversation_reads'::regclass
  ) then
    alter table public.conversation_reads
      add constraint conversation_reads_user_conv_key
      unique (user_id, conversation_id);
  end if;
end
$$;

-- ============================================================
-- ③ module_reads：同样处理（院子/小屋/朋友圈的已读位置）
-- ============================================================
delete from public.module_reads a
using public.module_reads b
where a.user_id = b.user_id
  and a.module = b.module
  and a.read_at < b.read_at;

delete from public.module_reads a
using public.module_reads b
where a.user_id = b.user_id
  and a.module = b.module
  and a.read_at = b.read_at
  and a.ctid > b.ctid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'module_reads_user_module_key'
       and conrelid = 'public.module_reads'::regclass
  ) then
    alter table public.module_reads
      add constraint module_reads_user_module_key
      unique (user_id, module);
  end if;
end
$$;

-- ============================================================
-- ④ 验证
-- ============================================================
-- 应该看到：每个 conversation_id 只有**一行** ✓
-- select conversation_id, read_at from public.conversation_reads
--  order by read_at desc limit 20;
--
-- 唯一约束加上了吗
-- select conname, contype from pg_constraint
--  where conrelid in ('public.conversation_reads'::regclass, 'public.module_reads'::regclass);

-- ============================================================
-- ⑤ 历史数据说明
-- ============================================================
-- 去重会**删掉旧的那一行** ✓ 保留最新的 ✓ 不影响任何界面 ✓
-- （两张表只是"我读到哪"的位置标记，历史位置没有保留价值）
