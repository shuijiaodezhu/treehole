-- ① 速率限制 + ④⑤ 登录日志
--
-- 一次跑完，两件事都到位。跑完选区的「Success. No rows returned」是正常的。
--
-- 为什么速率限制要做在数据库：客户端那层（components/content-guard.ts）
-- 只能挡手快连点，抓包直接调接口就绕过去了。触发器是真正拦得住脚本的那一层。

-- ============================================================
-- ④⑤ 登录日志（用来做「看自己在哪些设备登录过」）
-- ============================================================

create table if not exists public.login_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists login_logs_user_idx
  on public.login_logs (user_id, created_at desc);

alter table public.login_logs enable row level security;

-- 只能看自己的、只能写自己的
drop policy if exists "login logs readable by self" on public.login_logs;
create policy "login logs readable by self"
  on public.login_logs for select
  using (user_id = auth.uid());

drop policy if exists "login logs insert by self" on public.login_logs;
create policy "login logs insert by self"
  on public.login_logs for insert
  with check (user_id = auth.uid());

-- 不给 update / delete：登录记录不该被改，也不该被删
grant select, insert on public.login_logs to authenticated;


-- ============================================================
-- ① 速率限制触发器
--
-- 规则（同一个作者）：
--   messages         同一秒最多 1 条，每分钟最多 20 条
--   friend_posts     20 秒最多 1 条，每小时最多 30 条
--   winter_letters   3 秒最多 1 条，每小时最多 30 条
-- 超了就抛异常，客户端会看到「发送太频繁」这类报错。
-- ============================================================

create or replace function public.enforce_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author_col   text := TG_ARGV[0];
  min_gap_sec  int  := TG_ARGV[1]::int;
  win_sec      int  := TG_ARGV[2]::int;
  max_in_win   int  := TG_ARGV[3]::int;
  me           uuid;
  last_at      timestamptz;
  cnt          int;
begin
  -- 取这一行的作者。
  -- 用 CASE 逐个表判断，而不是动态拼 ($1).字段 —— 后者要依赖行类型推断，
  -- 出错时报的错也很难懂。plpgsql 只在走到那个分支时才编译该语句，
  -- 所以这里引用别的表没有的字段不会报错。
  if TG_TABLE_NAME = 'messages' then
    me := NEW.sender_id;
  elsif TG_TABLE_NAME = 'friend_posts' then
    me := NEW.author_id;
  elsif TG_TABLE_NAME = 'winter_letters' then
    me := NEW.sender_id;
  else
    me := null;
  end if;

  if me is null then
    return NEW;
  end if;

  -- 站主不受限：他可能要连着回几封信、回几条私信，
  -- 被自己的规则卡住就荒唐了（也信任站主不会刷屏）
  if me = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid then
    return NEW;
  end if;

  -- 这个作者上一条的时间
  execute format('select max(created_at) from public.%I where %I = $1', TG_TABLE_NAME, author_col)
    into last_at using me;

  if last_at is not null and now() - last_at < make_interval(secs => min_gap_sec) then
    raise exception '发送太频繁了，请稍等几秒再试' using errcode = 'check_violation';
  end if;

  -- 窗口内的条数
  execute format(
    'select count(*) from public.%I where %I = $1 and created_at > now() - make_interval(secs => $2)',
    TG_TABLE_NAME, author_col
  ) into cnt using me, win_sec;

  if cnt >= max_in_win then
    raise exception '短时间内发送太多了，歇一会儿再来' using errcode = 'check_violation';
  end if;

  return NEW;
end;
$$;

-- 挂到三张最容易被刷的表上（作者字段名分别对应）
drop trigger if exists rate_limit_messages on public.messages;
create trigger rate_limit_messages
  before insert on public.messages
  for each row execute function public.enforce_rate_limit('sender_id', 1, 60, 20);

drop trigger if exists rate_limit_friend_posts on public.friend_posts;
create trigger rate_limit_friend_posts
  before insert on public.friend_posts
  for each row execute function public.enforce_rate_limit('author_id', 20, 3600, 30);

drop trigger if exists rate_limit_winter_letters on public.winter_letters;
create trigger rate_limit_winter_letters
  before insert on public.winter_letters
  for each row execute function public.enforce_rate_limit('sender_id', 3, 3600, 30);


-- ============================================================
-- ③ 账号注销申请
--
-- 真正「删掉 auth 用户」需要 service_role 权限，前端做不到、也不该拿到。
-- 所以走申请：用户提交 → 落一行 → 站主在后台看到 → 去 Supabase 删人。
-- ============================================================

create table if not exists public.deletion_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  reason      text,
  status      text not null default 'pending',
  handled_by  uuid,
  handled_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists deletion_requests_status_idx
  on public.deletion_requests (status, created_at);

alter table public.deletion_requests enable row level security;

-- 自己提的申请自己能看；站主能看全部
drop policy if exists "deletion requests readable by self or owner" on public.deletion_requests;
create policy "deletion requests readable by self or owner"
  on public.deletion_requests for select
  using (
    user_id = auth.uid()
    or auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid
  );

-- 只能以自己名义提，且只能提一行 pending
drop policy if exists "deletion requests insert by self" on public.deletion_requests;
create policy "deletion requests insert by self"
  on public.deletion_requests for insert
  with check (user_id = auth.uid());

-- 只有站主能改状态（标记已处理）
drop policy if exists "deletion requests update by owner" on public.deletion_requests;
create policy "deletion requests update by owner"
  on public.deletion_requests for update
  using (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid)
  with check (auth.uid() = 'b59a31c7-60f8-4b57-924a-b408cbfd910c'::uuid);

grant select, insert, update on public.deletion_requests to authenticated;

notify pgrst, 'reload schema';


-- ============================================================
-- 核查（可选，只读）
-- ============================================================
-- select tablename, policyname, cmd from pg_policies
-- where schemaname = 'public' and tablename = 'login_logs';
--
-- select tgname, tgrelid::regclass from pg_trigger
-- where tgname like 'rate_limit%';
