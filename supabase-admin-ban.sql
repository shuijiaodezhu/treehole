-- 站内「停用账号」——不用再去 Supabase 后台手动 Ban
--
-- 之前的状态：举报页写着"停用账号"，但站主只能打开 Supabase 后台、
-- 进 Authentication 找到那个人、手动 Ban —— 而《举报处理流程》写的是
-- "在后台手动做"，等于承认没有工具。
--
-- 这个文件给一个**真**的封禁：改 auth.users.banned_until。
-- 这是 Supabase 自己在网关层执行的限制 —— 被封的人**登录不上、
-- 拿着 token 也调不动接口**，不是前端藏个按钮那种假封禁。
--
-- 为什么必须用函数：auth.users 只有 service_role / postgres 能改，
-- 前端那个 publishable key 是改不了的。所以做成 security definer 函数，
-- 里面**自己检查调用者是不是站主**，然后才动手。
--
-- ⚠️ 依赖：封禁时会通过 push_notification 给对方留一条通知，
--    所以**先跑 supabase-notifications.sql** 再跑这一份。
--    （没先跑的话，封禁会报「function public.push_notification does not exist」；
--      解封不受影响，因为它不发通知。）
--
-- 幂等：create or replace，重复跑没事。

create or replace function public.admin_set_ban(
  p_target uuid,
  p_days   int,                 -- 0 或 null = 解除封禁
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  until_ts timestamptz;
begin
  -- 第一道门：只有站主能调
  if auth.uid() is null or auth.uid() <> 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid then
    raise exception '只有站主能做这个操作';
  end if;

  if p_target is null then
    raise exception '缺少要处理的用户';
  end if;

  -- 第二道门：不能封自己（否则没人能解封了）
  if p_target = auth.uid() then
    raise exception '不能停用你自己的账号';
  end if;

  until_ts := case
    when p_days is null or p_days <= 0 then null
    else now() + (p_days || ' days')::interval
  end;

  update auth.users
     set banned_until = until_ts
   where id = p_target;

  if not found then
    raise exception '没有找到这个用户';
  end if;

  -- 给对方留一条通知，说明发生了什么（解封时不发）
  if until_ts is not null then
    perform public.push_notification(
      p_target,
      'moderation',
      '你的账号已被停用',
      coalesce(p_reason, '违反了《社区公约》。') || ' ' ||
        '解封时间：' || to_char(until_ts, 'YYYY-MM-DD HH24:MI') ||
        '。有疑问可以在《申诉机制》里找到联系方式。',
      '/p/appeal',
      null
    );
  end if;
end;
$$;

-- 只允许登录用户调用；函数体里还会再检查一次身份
revoke all on function public.admin_set_ban(uuid, int, text) from public;
grant execute on function public.admin_set_ban(uuid, int, text) to authenticated;


notify pgrst, 'reload schema';


-- ============================================================
-- 核查（只读）
-- ============================================================
-- 现在有谁被封着
-- select id, email, banned_until from auth.users where banned_until is not null;
--
-- 函数在不在
-- select proname, prosecdef from pg_proc where proname = 'admin_set_ban';
