-- 注销某个用户时，要删哪些东西（**给你照着执行的操作清单，不是自动脚本**）
--
-- 为什么是"清单"而不是一键脚本：真正的删除要动 11 张表 + 存储桶 + auth 用户，
-- 中间任何一步都想让你**看见**再执行。所以这里把顺序和语句都摆出来，
-- 你把 <UID> 换成那个人的 id，逐段跑。
--
-- 拿到 UID 的两个地方：
--   · 后台 →「注销申请」那一节里，那行灰底小字就是 uid（可以选中复制）
--   · 或 Supabase → Authentication → Users 里搜邮箱
--
-- ⚠️ 删之前建议先跑一次 scripts/backup.ps1（或至少确认你有可用的备份）。
-- ⚠️ 第一次做建议拿一个**测试账号**走一遍流程，确认没漏东西。

-- ============================================================
-- 第 0 步：先看清楚这个人留下了什么（只读，先跑这个）
--
-- 每一行是一个数量。心里有个数，删完再跑一次应该全部为 0。
-- ============================================================
with u as (select '<UID>'::uuid as id)
select '动态（朋友圈）' as "内容", count(*) as "条数" from public.friend_posts, u where author_id = u.id
union all select '动态配图', count(*) from public.friend_posts, u where author_id = u.id and image_urls is not null
union all select '帖子（院子）', count(*) from public.world_posts, u where author_id = u.id
union all select '评论/回复', count(*) from public.world_comments, u where author_id = u.id
union all select '私信', count(*) from public.messages, u where sender_id = u.id
union all select '会话', count(*) from public.conversations, u where user1_id = u.id or user2_id = u.id
union all select '冬日信箱', count(*) from public.winter_letters, u where thread_user_id = u.id or sender_id = u.id
union all select '收藏', count(*) from public.user_favorites, u where user_id = u.id
union all select '储物箱文件', count(*) from public.user_files, u where user_id = u.id
union all select '计划书', count(*) from public.user_plans, u where user_id = u.id
union all select '活跃记录', count(*) from public.user_activity, u where user_id = u.id
union all select '登录记录', count(*) from public.login_logs, u where user_id = u.id
union all select '注销申请', count(*) from public.deletion_requests, u where user_id = u.id
union all select '好友关系', count(*) from public.friendships, u where requester_id = u.id or addressee_id = u.id
union all select '拉黑', count(*) from public.blocks, u where blocker_id = u.id or blocked_id = u.id
union all select '分组', count(*) from public.friend_groups, u where owner_id = u.id
union all select '分组可见名单（他是观众）', count(*) from public.friend_post_audience, u where friend_id = u.id
union all select '举报（他报的）', count(*) from public.reports, u where reporter_id = u.id
order by "内容";


-- ============================================================
-- 第 1 步：删内容
--
-- 顺序有讲究：先删"引用别人的"（评论、回复），再删自己的主内容，
-- 最后断开关系。表名/列名如有对不上的（报 column does not exist），
-- 说明那张表的结构和我这里写的不一致，把报错发我，我改这一行。
-- ============================================================
-- begin;   -- 想稳妥就先 begin，确认无误再 commit

-- 1.1 评论与回复（引用别人的帖子，先删）
-- delete from public.world_comments      where author_id = '<UID>';

-- 1.2 朋友圈动态的可见名单（外键指向动态，必须先删）
-- delete from public.friend_post_audience
--  where post_id in (select id from public.friend_posts where author_id = '<UID>');

-- 1.3 朋友圈动态
-- delete from public.friend_posts        where author_id = '<UID>';

-- 1.4 院子里的帖子
-- delete from public.world_posts         where author_id = '<UID>';

-- 1.5 私信（先删消息，再删会话）
-- delete from public.messages
--  where conversation_id in (
--    select id from public.conversations where user1_id = '<UID>' or user2_id = '<UID>'
--  );
-- delete from public.conversations        where user1_id = '<UID>' or user2_id = '<UID>';

-- 1.6 冬日信箱（他和站主之间的往来）
-- delete from public.winter_letters       where thread_user_id = '<UID>' or sender_id = '<UID>';

-- 1.7 收藏
-- delete from public.user_favorites       where user_id = '<UID>';

-- 1.8 储物箱的元数据（文件本体在第 2 步删）
-- delete from public.user_files           where user_id = '<UID>';

-- 1.9 计划书
-- delete from public.user_plans           where user_id = '<UID>';

-- 1.10 活跃与登录记录
-- delete from public.user_activity        where user_id = '<UID>';
-- delete from public.login_logs           where user_id = '<UID>';

-- 1.11 注销申请本身（留一条"已处理"也行，看你要不要留痕）
-- delete from public.deletion_requests    where user_id = '<UID>';

-- 1.12 关系：拉黑 → 分组 → 分组名单 → 好友
-- delete from public.blocks               where blocker_id = '<UID>' or blocked_id = '<UID>';
-- delete from public.friend_group_members
--  where group_id in (select id from public.friend_groups where owner_id = '<UID>')
--     or member_id = '<UID>';          -- 他也在别人的分组里
-- delete from public.friend_groups        where owner_id = '<UID>';
-- delete from public.friendships          where requester_id = '<UID>' or addressee_id = '<UID>';

-- 1.13 举报（他报的；被举报的内容另说，别一起删了）
-- delete from public.reports              where reporter_id = '<UID>';

-- 1.14 资料
-- delete from public.profiles             where id = '<UID>';

-- commit;  -- 上面都对了再提交


-- ============================================================
-- 第 2 步：删存储里的文件（这一段在 SQL Editor 里跑不动）
--
-- 存储对象不能只用 SQL 删干净（还要清 storage 的元数据表），
-- 最稳的是用 Storage API。两种办法：
--
-- 办法一（推荐，不用装东西）：Supabase → Storage → 选 media 桶 →
--   进到那个 uid 命名的文件夹 → 全选删除。vault 桶同理。
--
-- 办法二：用 SQL 只删元数据（**文件本体可能残留**，一般别这么干）
-- delete from storage.objects where bucket_id in ('media','vault')
--   and (storage.foldername(name))[1] = '<UID>';
--
-- 上传路径规律（方便你在界面里找）：<uid>/<时间戳>-<随机6位>.<扩展名>
-- ============================================================


-- ============================================================
-- 第 3 步：删账号本身
--
-- 这一步**只能**在两个地方做（前端没有权限，也不该有）：
--   · Supabase → Authentication → Users → 找到那个人 → Delete user
--   · 或者用 service_role key 调 admin API
-- 删掉 auth 用户后，带 on delete cascade 的外键会自动清掉残留。
-- ============================================================


-- ============================================================
-- 第 4 步：复验（把第 0 步那句再跑一遍，应该全是 0）
--
-- 另外确认一下 auth 里也没了：
-- select id, email from auth.users where id = '<UID>';   -- 应返回 0 行
-- ============================================================
