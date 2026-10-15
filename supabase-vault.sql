-- ============================================================
-- 储物箱：号主私有文件存储（≤10MB，按类别归档）
-- 在 Supabase → SQL Editor 里整段执行（幂等，可重复跑）
-- ============================================================

-- ============================================================
-- 一、私有桶（public = false：只能通过签名链接访问）
-- ============================================================

insert into storage.buckets (id, name, public)
values ('vault', 'vault', false)
on conflict (id) do update set public = false;

-- 只能往自己 uid 目录里传
drop policy if exists "vault insert own folder" on storage.objects;
create policy "vault insert own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'vault'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 只能读自己目录里的（私有桶靠这条 + 签名链接）
drop policy if exists "vault read own folder" on storage.objects;
create policy "vault read own folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'vault'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 只能删自己目录里的
drop policy if exists "vault delete own folder" on storage.objects;
create policy "vault delete own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'vault'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- 二、文件元数据表（列表、分类、大小都从这里读）
-- ============================================================

create table if not exists public.user_files (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,                 -- 原始文件名
  path       text not null,                 -- 桶内路径
  size       bigint not null default 0,     -- 字节
  mime       text,                          -- MIME 类型
  category   text not null default 'other', -- image/video/audio/doc/archive/other
  created_at timestamptz not null default now(),
  unique (path)
);

create index if not exists user_files_user_idx on public.user_files (user_id, created_at desc);
create index if not exists user_files_category_idx on public.user_files (user_id, category);

alter table public.user_files enable row level security;

-- 只能读自己的
drop policy if exists "own files readable" on public.user_files;
create policy "own files readable"
  on public.user_files for select
  to authenticated
  using (auth.uid() = user_id);

-- 只能写自己的
drop policy if exists "own files insertable" on public.user_files;
create policy "own files insertable"
  on public.user_files for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 只能删自己的
drop policy if exists "own files deletable" on public.user_files;
create policy "own files deletable"
  on public.user_files for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, delete on public.user_files to authenticated;

-- 刷新 PostgREST schema 缓存
notify pgrst, 'reload schema';

-- ============================================================
-- 三、确认结果
-- ============================================================

-- 桶（应返回 vault / false）
select id, name, public from storage.buckets where id = 'vault';

-- 策略（vault 应 3 条，user_files 应 3 条）
select tablename, policyname, cmd
from pg_policies
where (schemaname = 'storage' and tablename = 'objects' and policyname like 'vault%')
   or (schemaname = 'public' and tablename = 'user_files')
order by tablename, policyname;
