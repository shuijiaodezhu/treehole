-- ============================================================
-- 首屏请求合并：把 boot-sync 的 9 个请求合并成 1 个
--
-- 现状：打开首页 → 并发打 9 个 Supabase 请求
--   分类 / 我的资料 / 好友 / 会话 / 最近消息 / 未读数 / 会话已读 / 模块已读 / 帖子
--   每个往返约 230ms，9 个并发也要等最慢的那个 + 每条都有自己的 HTTP 开销
--
-- 合并后：1 个 RPC 一次返回全部 ✓
--   · **security invoker** → RLS 照常生效 ✓ 不会越权读到别人的东西 ✓
--   · 前端**保留原来的并行查询作兜底** ✓ 函数没建/报错就自动退回 ✓
--     最坏情况只是"没变快" ✓ 绝不会"打不开" ✓
--
-- 用法：Supabase → SQL Editor → 整段粘贴 → Run（幂等）
-- ============================================================

create or replace function public.app_boot()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  -- 没登录 → 返回空对象，前端会退回原来的查询 ✓
  if v_uid is null then
    return '{}'::jsonb;
  end if;

  select jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(to_jsonb(c))
        from (
          select id, name, icon, parent_id, sort_order
            from public.categories
           where status = 'approved'
           order by sort_order
        ) c
    ), '[]'::jsonb),

    'me', (
      select to_jsonb(p)
        from (
          select id, username, nickname, avatar_url, signature, location
            from public.profiles
           where id = v_uid
        ) p
    ),

    'friendships', coalesce((
      select jsonb_agg(to_jsonb(f))
        from (
          select id, requester_id, addressee_id
            from public.friendships
           where status = 'accepted'
             and (requester_id = v_uid or addressee_id = v_uid)
        ) f
    ), '[]'::jsonb),

    'conversations', coalesce((
      select jsonb_agg(to_jsonb(c))
        from (
          select *
            from public.conversations
           order by last_message_at desc nulls last
           limit 50
        ) c
    ), '[]'::jsonb),

    'messages', coalesce((
      select jsonb_agg(to_jsonb(m))
        from (
          select id, conversation_id, sender_id, content, created_at
            from public.messages
           order by created_at desc
           limit 60
        ) m
    ), '[]'::jsonb),

    'unread', (
      select count(*)
        from public.notifications
       where user_id = v_uid
         and read_at is null
    ),

    'conv_reads', coalesce((
      select jsonb_agg(to_jsonb(r))
        from (
          select conversation_id, read_at
            from public.conversation_reads
           where user_id = v_uid
        ) r
    ), '[]'::jsonb),

    'module_reads', coalesce((
      select jsonb_agg(to_jsonb(r))
        from (
          select module, read_at
            from public.module_reads
           where user_id = v_uid
        ) r
    ), '[]'::jsonb),

    'posts', coalesce((
      select jsonb_agg(to_jsonb(p))
        from (
          select id, author_id, is_anonymous, content, category_id, created_at, image_urls
            from public.world_posts
           where status = 'published'
             and is_hidden = false
             and category_id is null
           order by created_at desc
           limit 20
        ) p
    ), '[]'::jsonb)
  ) into v_out;

  return v_out;
end;
$$;

comment on function public.app_boot() is
  '首屏一次性取回：分类/我的资料/好友/会话/消息/未读数/已读标记/帖子。9 次往返合并成 1 次。';

-- 只给登录用户调用
revoke all on function public.app_boot() from public;
grant execute on function public.app_boot() to authenticated;

-- ============================================================
-- 验证
-- ============================================================
-- 登录状态下跑这句，应该看到 9 个 key（未登录会返回 {}）
-- select jsonb_object_keys(public.app_boot());
--
-- 看体积（正常几百 KB 以内）
-- select pg_size_pretty(length(public.app_boot()::text)::bigint);

-- ============================================================
-- 回滚
-- ============================================================
-- drop function if exists public.app_boot();
