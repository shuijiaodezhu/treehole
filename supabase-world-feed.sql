-- ============================================================
-- 院子：把"一页要的数据"用一个函数一次拿回来
--
-- 为什么做这个：
--   Supabase 每次往返约 **150ms**（跨境）
--   而院子一页原来要分 4 次问：帖子 → 点赞 → 评论 → 资料
--   → 一次性拿到手，等于把 4×150ms 变成 1×150ms
--
-- 安全说明（重要）：
--   security **invoker** —— 用的是**调用者**的权限
--   → 数据库的行级安全（RLS）照旧生效 ✓ 别人看不到不该看的 ✓
--   ✗ 千万不要改成 security definer（那会绕过 RLS ✗ 是个大漏洞）
--
-- 怎么用：
--   ① 整段粘到 Supabase → SQL Editor → Run
--   ② 再跑最后那段"自测"，看有没有报错、有没有数据
--   ③ 然后把结果告诉我 ✓ 我去改前端来调它
-- ============================================================

create or replace function public.world_feed(
  p_category_id uuid default null,
  p_limit int default 30
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with picked as (
    select
      p.id, p.author_id, p.is_anonymous, p.anonymous_id,
      p.content, p.category_id, p.created_at, p.image_urls
    from public.world_posts p
    where p.status = 'published'
      and coalesce(p.is_hidden, false) = false
      -- 与前端保持一致：不传分类时看"没有分类"的大厅帖
      and (
        (p_category_id is null and p.category_id is null)
        or p.category_id = p_category_id
      )
    order by p.created_at desc
    limit greatest(1, least(coalesce(p_limit, 30), 50))
  ),
  likes as (
    select l.post_id,
           count(*)::int as like_count,
           bool_or(l.user_id = auth.uid()) as mine
    from public.world_likes l
    where l.post_id in (select id from picked)
    group by l.post_id
  ),
  cmts as (
    select
      c.id, c.post_id, c.author_id, c.content, c.created_at,
      c.is_anonymous, c.anonymous_id, c.parent_id
    from public.world_comments c
    where c.post_id in (select id from picked)
    order by c.created_at asc
  ),
  authors as (
    select distinct author_id as id
    from picked
    where coalesce(is_anonymous, false) = false and author_id is not null
    union
    select distinct author_id
    from cmts
    where coalesce(is_anonymous, false) = false and author_id is not null
  ),
  profs as (
    select pr.id, pr.username, pr.nickname, pr.avatar_url, pr.signature
    from public.profiles pr
    where pr.id in (select id from authors)
  ),
  post_rows as (
    select
      pk.id,
      pk.author_id,
      pk.is_anonymous,
      pk.anonymous_id,
      pk.content,
      pk.category_id,
      pk.created_at,
      pk.image_urls,
      coalesce(lk.like_count, 0) as like_count,
      coalesce(lk.mine, false) as liked_by_me,
      coalesce((
        select jsonb_agg(to_jsonb(c) order by c.created_at)
        from cmts c
        where c.post_id = pk.id
      ), '[]'::jsonb) as comments
    from picked pk
    left join likes lk on lk.post_id = pk.id
    order by pk.created_at desc
  )
  select jsonb_build_object(
    'posts', coalesce((select jsonb_agg(to_jsonb(r)) from post_rows r), '[]'::jsonb),
    'profiles', coalesce((select jsonb_agg(to_jsonb(p)) from profs p), '[]'::jsonb)
  );
$$;

-- 明确授权给登录用户（默认 PUBLIC 本来也能执行，这里写清楚更放心）
grant execute on function public.world_feed(uuid, int) to authenticated;
grant execute on function public.world_feed(uuid, int) to anon;

-- ============================================================
-- 自测（跑完上面那段之后，把下面这两句也跑一下）
-- ============================================================

-- ① 能不能调用、有没有报错：
select public.world_feed() is not null as ok;

-- ② 看看实际内容（帖子数 / 资料数）：
select
  jsonb_array_length(public.world_feed()->'posts')    as 帖子数,
  jsonb_array_length(public.world_feed()->'profiles') as 资料数;
