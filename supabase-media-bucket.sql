-- ============================================================
-- 图片上传用的 Storage 桶
-- 在 Supabase → SQL Editor 里整段执行（幂等，可重复跑）
-- ============================================================

-- 1) 建一个公开读取的桶（图片要能在页面上直接显示）
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

-- 2) 登录用户只能往「自己 uid 命名的目录」里传
drop policy if exists "media upload own folder" on storage.objects;
create policy "media upload own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3) 任何人可读（桶本身 public，配合这条 select 策略）
drop policy if exists "media public read" on storage.objects;
create policy "media public read"
  on storage.objects for select
  using (bucket_id = 'media');

-- 4) 本人可删自己目录里的文件
drop policy if exists "media delete own" on storage.objects;
create policy "media delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- 确认结果
-- ============================================================

-- 桶是否建好（应返回 media / true）
select id, name, public from storage.buckets where id = 'media';

-- 策略是否就位（应返回 3 行）
select policyname, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
