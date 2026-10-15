-- 存储清理审计（**前两段只读，最后一段的删除是注释掉的**）
--
-- 解决什么：用户删了动态/帖子，对象存储里的图还留着。
-- 免费版只有 1GB，删一阵子就会满，而且满了之后的上传错误很含糊。
--
-- 图片 URL 的规则（决定了怎么对上）：上传时存的是
--   {项目地址}/storage/v1/object/public/media/{uid}/{时间戳}-{随机6位}.{扩展名}
-- 而数据库里存的就是这个完整 URL（friend_posts.image_urls、world_posts.image_urls、
-- profiles.avatar_url 三处），所以能直接用字符串对上，不用解析路径。
--
-- 顺序：先跑第一段看总量 → 再跑第二段看孤儿 → 第三段（删除）注释着，
-- 建议先挑一两条确认确实是废弃的，再整体执行。


-- ============================================================
-- 【第一段】各桶的用量概览（只读）
-- ============================================================
select
  bucket_id                              as "桶",
  count(*)                               as "文件数",
  pg_size_pretty(sum((metadata->>'size')::bigint)) as "合计大小",
  min(created_at)::date                  as "最早",
  max(created_at)::date                  as "最新"
from storage.objects
group by bucket_id
order by sum((metadata->>'size')::bigint) desc nulls last;


-- ============================================================
-- 【第二段】media 桶里的「孤儿图」：没有任何一张表引用它（只读）
--
-- 判断依据是把三处引用集合起来做比对。落到这里的结果，理论上都可以删，
-- 但**建议先看两条**：
--   · 是不是很久以前上传的（那多半是删掉的内容留下的）
--   · 复制 name 去 Storage 界面看一眼，确认确实不在任何地方显示
-- ============================================================
with objects as (
  select
    name,
    (metadata->>'size')::bigint as size,
    created_at
  from storage.objects
  where bucket_id = 'media'
),
referenced as (
  select unnest(image_urls) as url from public.friend_posts where image_urls is not null
  union
  select unnest(image_urls) as url from public.world_posts  where image_urls is not null
  union
  select avatar_url from public.profiles where avatar_url is not null
)
select
  o.name                          as "文件路径",
  pg_size_pretty(o.size)          as "大小",
  o.created_at                    as "上传时间"
from objects o
where not exists (
  select 1 from referenced r
  where r.url = 'https://cdmytrvpskkdwjsenidt.supabase.co/storage/v1/object/public/media/' || o.name
)
order by o.created_at desc;


-- ============================================================
-- 【第三段】反过来查：数据库里引用了、但存储里已经没有的图（只读）
--
-- 这是"坏图"——页面上会显示破图。数量少的话多半是当年删存储时漏了引用，
-- 可以顺手把那些引用清掉（那属于改数据，我没写，需要的话跟我说）。
-- ============================================================
with objects as (
  select 'https://cdmytrvpskkdwjsenidt.supabase.co/storage/v1/object/public/media/' || name as url
  from storage.objects
  where bucket_id = 'media'
),
referenced as (
  select '朋友圈' as src, id, unnest(image_urls) as url
    from public.friend_posts where image_urls is not null
  union all
  select '院子', id, unnest(image_urls)
    from public.world_posts where image_urls is not null
  union all
  select '头像', id, avatar_url
    from public.profiles where avatar_url is not null
)
select
  r.src    as "来源",
  r.id     as "记录 id",
  r.url    as "失效的地址"
from referenced r
where not exists (select 1 from objects o where o.url = r.url)
order by r.src;


-- ============================================================
-- 【第四段】真的删（**默认注释掉**）
--
-- 三段都看过了、确实要清，再取消注释执行。
-- 先只删最老的一批（这里限制 100 条）看看效果，别一把梭。
--
-- ⚠️ 只删 storage.objects 的**元数据行**，文件本体可能还占着空间。
--    要连文件一起清，用 Supabase → Storage → 界面上选文件夹删除更干净；
--    或者写个脚本调 Storage API 按路径 remove()。
--    这一段的价值是"先把列表缩小"，让你知道该删哪些。
-- ============================================================
-- delete from storage.objects
-- where bucket_id = 'media'
--   and name in (
--     with objects as (
--       select name from storage.objects where bucket_id = 'media'
--     ),
--     referenced as (
--       select unnest(image_urls) as url from public.friend_posts where image_urls is not null
--       union select unnest(image_urls) from public.world_posts where image_urls is not null
--       union select avatar_url from public.profiles where avatar_url is not null
--     )
--     select o.name from objects o
--     where not exists (
--       select 1 from referenced r
--       where r.url = 'https://cdmytrvpskkdwjsenidt.supabase.co/storage/v1/object/public/media/' || o.name
--     )
--     order by o.name
--     limit 100
--   );


-- ============================================================
-- 【第五段】vault（储物箱）桶
--
-- 储物箱的元数据在 public.user_files（列是 path，不是 URL），
-- 而且桶是私有的、每人 10MB 上限，一般不会失控。
-- 想清的话对照这张表即可：
-- ============================================================
-- select o.name, pg_size_pretty((o.metadata->>'size')::bigint) as 大小, o.created_at
-- from storage.objects o
-- where o.bucket_id = 'vault'
--   and not exists (select 1 from public.user_files f where f.path = o.name)
-- order by o.created_at desc;
