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
  sql          text;
begin
  -- 作者字段的值（不同表的字段名不一样，用 TG_ARGV 传进来）
  execute format('select ($1).%I', author_col) into me using NEW;

  if me is null then
    return NEW;
  end if;

  -- 上一条的时间
  sql := format('select max(created_at) from public.%I where %I = $1', TG_TABLE_NAME, author_col);
  execute sql into last_at using me;

  if last_at is not null and now() - last_at < make_interval(secs => min_gap_sec) then
    raise exception '发送太频繁了，请稍等几秒再试' using errcode = 'check_violation';
  end if;

  -- 窗口内的条数
  sql := format(
    'select count(*) from public.%I where %I = $1 and created_at > now() - make_interval(secs => $2)',
    TG_TABLE_NAME, author_col
  );
  execute sql into cnt using me, win_sec;

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


notify pgrst, 'reload schema';


-- ============================================================
-- 核查（可选，只读）
-- ============================================================
-- select tablename, policyname, cmd from pg_policies
-- where schemaname = 'public' and tablename = 'login_logs';
--
-- select tgname, tgrelid::regclass from pg_trigger
-- where tgname like 'rate_limit%';
