-- RLS 全面体检（**只读脚本，不改任何东西**）
--
-- 为什么要查：早期那批表的策略是在 Supabase 后台手建的，仓库里没有定义，
-- 代码里也读不到。而 RLS 漏开**不会报错**——表只会静静地变成"谁都能读写"。
-- 这个脚本把每张表的状态摊开，尤其标出两种最危险的情况。
--
-- 怎么跑：整段粘进 SQL Editor，一次 Run。会返回好几个结果集，按顺序看。
-- 每个结果集前面都有小标题注释，对着看就行。


-- ============================================================
-- 【结果 1】总览：每张表的 RLS 状态 + 策略数  ← 最重要，先看这个
--
-- 判断列的含义：
--   🔴 危险       = RLS 没开。这张表对所有拿到前端 key 的人都是敞开的
--   🟠 要确认     = 开了 RLS 但没有策略。正常读写会全部失败（除非只由站主用后台改）
--   ✅ 正常       = 有策略
-- ============================================================
select
  c.relname                                        as "表名",
  c.relrowsecurity                                 as "RLS已开",
  count(p.policyname)                              as "策略条数",
  coalesce(string_agg(distinct p.cmd, ', '), '—')  as "覆盖操作",
  case
    when not c.relrowsecurity then '🔴 危险：RLS 没开'
    when count(p.policyname) = 0 then '🟠 要确认：开了 RLS 却没有策略'
    else '✅ 正常'
  end                                              as "判断"
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p
       on p.schemaname = n.nspname and p.tablename = c.relname
where n.nspname = 'public'
  and c.relkind = 'r'          -- 只看普通表（视图另在结果 4）
group by c.relname, c.relrowsecurity
order by
  (not c.relrowsecurity) desc,  -- 危险的在最前
  count(p.policyname) asc,      -- 其次是没有策略的
  c.relname;


-- ============================================================
-- 【结果 2】每张表的策略细节
--
-- 重点看 using / with_check 里**有没有 auth.uid()**：
--   · 写着 auth.uid() = user_id 之类的 → 只作用于本人，正常
--   · 只写 true → 等于没有限制（有 RLS 也是如此）
-- ============================================================
select
  tablename   as "表名",
  policyname  as "策略名",
  cmd         as "操作",
  roles       as "适用角色",
  qual        as "using_条件",
  with_check  as "with_check_条件"
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;


-- ============================================================
-- 【结果 3】anon / authenticated 对每张表被授予了什么
--
-- RLS 之外的另一半：如果某张表**没开 RLS**、又把权限授给了 anon，
-- 那就是真的全公开（前端那个 key 谁都能拿）。
-- 有 RLS 的话，授权只是"允许尝试"，能不能读到还要看策略。
-- ============================================================
select
  table_name                                        as "表名",
  grantee                                           as "角色",
  string_agg(distinct privilege_type, ', ')         as "权限"
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;


-- ============================================================
-- 【结果 4】视图（可能绕过 RLS）
--
-- 视图如果是 postgres 建的、又不是 security_invoker，它会以**属主身份**读底层表，
-- 也就是绕过 RLS。如果你的表被故意挡住了，但有个视图露在外面，等于白挡。
-- 这里只列出来给你确认；不确定的话把名单发我。
-- ============================================================
select
  c.relname                    as "视图",
  pg_get_userbyid(c.relowner)  as "属主"
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'v'
order by c.relname;


-- ============================================================
-- 【结果 5】security definer 函数
--
-- 这类函数以属主身份运行，会绕过 RLS。我用它是**故意**的
-- （限流触发器和 last_message_at 触发器必须能写别人的行），
-- 但如果你看到不认识的函数，值得问一句它是干嘛的。
-- ============================================================
select
  p.proname                    as "函数",
  pg_get_userbyid(p.proowner)  as "属主",
  p.prosecdef                  as "security_definer"
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef = true
order by p.proname;


-- ============================================================
-- 【结果 6】存储桶：谁是公开的
--
-- public = true 的桶，任何人拿着 URL 就能看图（头像一般就该这样）。
-- 但如果里面有不该外露的东西，就得注意。
-- ============================================================
select
  b.id        as "桶",
  b.name      as "名字",
  b.public    as "是否公开",
  count(p.policyname) as "对象策略条数"
from storage.buckets b
left join pg_policies p
       on p.schemaname = 'storage' and p.tablename = 'objects'
group by b.id, b.name, b.public
order by b.name;


-- ============================================================
-- 【结果 7】对象存储的策略细节
-- ============================================================
select
  policyname  as "策略名",
  cmd         as "操作",
  roles       as "适用角色",
  qual        as "using_条件"
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by cmd, policyname;
