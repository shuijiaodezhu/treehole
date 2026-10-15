-- ============================================================
-- 修复：site_pages 保存报
--   new row violates row-level security policy for table "site_pages"
--
-- 原因：表建好了，但后面那些「策略 / 授权 / 插入初稿」的语句没执行成功。
--       RLS 打开了却没有允许写入的策略 → 写入被拦下。
--       这也解释了为什么 7 条初稿一直没进数据库。
--
-- 在 Supabase → SQL Editor 里整段执行（幂等，可重复跑）。
-- ============================================================

-- ------------------------------------------------------------
-- 第一步：先看现状（把结果发我也行，能确认到底缺什么）
-- ------------------------------------------------------------

-- 1) RLS 是否打开（true = 必须有策略才放行）
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname = 'site_pages';

-- 2) 现有策略（预期应有 readable 与 admin writes 两条；若为空就是没建）
select policyname, cmd, roles, coalesce(qual, '(无 using)') as using_expr,
       coalesce(with_check, '(无 with_check)') as check_expr
from pg_policies
where schemaname = 'public' and tablename = 'site_pages'
order by policyname;

-- 3) 表级授权
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'site_pages'
order by grantee, privilege_type;

-- ------------------------------------------------------------
-- 第二步：补齐（全部幂等）
-- ------------------------------------------------------------

-- 表在不在（万一连表都没建）
create table if not exists public.site_pages (
  slug       text primary key,
  title      text not null,
  summary    text,
  body       text not null default '',
  sort_order int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.site_pages enable row level security;

-- 读：所有人（注册页要能点开协议）
drop policy if exists "site pages readable" on public.site_pages;
create policy "site pages readable"
  on public.site_pages for select
  to anon, authenticated
  using (true);

-- 写：站主。拆成三条，比 for all 更不容易踩坑
drop policy if exists "admin writes site pages" on public.site_pages;
drop policy if exists "admin inserts site pages" on public.site_pages;
drop policy if exists "admin updates site pages" on public.site_pages;
drop policy if exists "admin deletes site pages" on public.site_pages;

create policy "admin inserts site pages"
  on public.site_pages for insert
  to authenticated
  with check (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid);

create policy "admin updates site pages"
  on public.site_pages for update
  to authenticated
  using (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid)
  with check (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid);

create policy "admin deletes site pages"
  on public.site_pages for delete
  to authenticated
  using (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid);

-- 授权（没有这个会是 permission denied，而不是 RLS 报错，顺手补上）
grant usage on schema public to anon, authenticated;
grant select on public.site_pages to anon, authenticated;
grant insert, update, delete on public.site_pages to authenticated;

-- 顺带把之前那几张后台表的策略也补一遍（同一批可能都没跑成）
drop policy if exists "admin manages categories" on public.categories;
create policy "admin manages categories"
  on public.categories for all to authenticated
  using (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid)
  with check (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid);

drop policy if exists "admin manages reports" on public.reports;
create policy "admin manages reports"
  on public.reports for all to authenticated
  using (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid)
  with check (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid);

drop policy if exists "admin manages activities" on public.play_activities;
create policy "admin manages activities"
  on public.play_activities for all to authenticated
  using (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid)
  with check (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid);

drop policy if exists "admin manages world_posts" on public.world_posts;
create policy "admin manages world_posts"
  on public.world_posts for all to authenticated
  using (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid)
  with check (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid);

-- 让 PostgREST 立刻感知变化
notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 第三步：确认（site_pages 应看到 readable + insert + update + delete）
-- ------------------------------------------------------------
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('site_pages', 'categories', 'reports', 'play_activities', 'world_posts')
order by tablename, policyname;
