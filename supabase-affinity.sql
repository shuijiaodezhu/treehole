-- 好感度（互动值）
--
-- 设计取舍：
--   · **有向**：from_id → to_id，是「我对你的好感」，不是共同值
--   · **只增不减**：没有抖音火花那种「断了就消失」，不构成负担
--   · **每日上限**：私信最多 +20/天，点赞最多 +10/天
--     —— 不设上限就会被刷，设了才像「日常来往」
--   · **默认只有自己看得到**：想给对方看，要自己去设置里开
--     （profiles.affinity_public，默认 false）
--
-- 幂等：字段/表/索引都是 if not exists，策略与触发器先 drop 再建，重复跑不会报错。
--
-- ⚠️ 这个文件**必须整段一起跑**（触发器依赖上面的函数与字段）。
--
-- ⚠️ 顺序有讲究，别随手调换：
--   第 1 段加 profiles.affinity_public，**必须在第 3 段的策略之前** ——
--   策略里的 exists(... p.affinity_public ...) 在创建时就会被解析校验，
--   列还不存在的话整批直接中断。（我自己第一版就写反了，记在这儿。）


-- ============================================================
-- 一、先加 profiles 上的开关：要不要让对方看到我对他的好感度
-- ============================================================
alter table public.profiles
  add column if not exists affinity_public boolean not null default false;


-- ============================================================
-- 二、表
-- ============================================================
create table if not exists public.affinity (
  from_id     uuid not null references auth.users (id) on delete cascade,
  to_id       uuid not null references auth.users (id) on delete cascade,
  score       int  not null default 0,
  -- 今天已经加了多少、以及是哪一天：用来做每日上限（跨天自动重置）
  today_score int  not null default 0,
  today       date not null default ((now() at time zone 'utc')::date),
  updated_at  timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);

create index if not exists affinity_to_idx on public.affinity (to_id, score desc);

alter table public.affinity enable row level security;

grant select on public.affinity to authenticated;


-- ============================================================
-- 三、策略：自己能看「我对别人的」；别人的「对我的」只有他公开了才看得到
--
-- 不给 insert/update/delete 策略：好感度只由下面的触发器维护，
-- 客户端一个字都改不了（否则分数就没意义了）。
-- ============================================================
drop policy if exists "affinity readable by self or if published" on public.affinity;
create policy "affinity readable by self or if published"
  on public.affinity for select
  using (
    from_id = auth.uid()
    or (
      to_id = auth.uid()
      and exists (
        select 1 from public.profiles p
        where p.id = affinity.from_id and p.affinity_public is true
      )
    )
  );


-- ============================================================
-- 四、加分函数（带每日上限）
--
-- security definer：写 affinity 需要权限，而发消息的人没有那张表的写权限。
-- 表还没建时也只会在这里报错，不会影响别的功能（应用侧读到 404 会安静地不显示）。
-- ============================================================
create or replace function public.add_affinity(
  p_from uuid,
  p_to   uuid,
  p_points int,
  p_daily_cap int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  today_utc date := (now() at time zone 'utc')::date;
  cur_today int;
begin
  if p_from is null or p_to is null or p_from = p_to then
    return;
  end if;

  insert into public.affinity (from_id, to_id, score, today_score, today, updated_at)
  values (p_from, p_to, 0, 0, today_utc, now())
  on conflict (from_id, to_id) do nothing;

  select case when today = today_utc then today_score else 0 end
    into cur_today
    from public.affinity
   where from_id = p_from and to_id = p_to;

  -- 到上限就不加了（但也不扣、不清零 —— 只增不减）
  if cur_today >= p_daily_cap then
    return;
  end if;

  update public.affinity
     set score       = score + p_points,
         today_score = cur_today + p_points,
         today       = today_utc,
         updated_at  = now()
   where from_id = p_from and to_id = p_to;
end;
$$;


-- ============================================================
-- 五、触发器
--
-- 只在这两处埋点：私信、给别人的朋友圈点赞。
-- 想再加来源（评论、收藏……）照着加一个触发器即可，**不用动应用代码**。
--
-- 两个 create trigger 都套了「表在不在」的判断：
-- 万一哪张表在你的库里名字不同，也只跳过这一段，不会让整批中断
-- （上一版 SQL 就是因为在文件中段报错，导致后面的内容全没生效）。
-- ============================================================

-- 5.1 私信：+1，每天最多 +20
create or replace function public.affinity_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  other uuid;
begin
  select case when user1_id = new.sender_id then user2_id else user1_id end
    into other
    from public.conversations
   where id = new.conversation_id;

  perform public.add_affinity(new.sender_id, other, 1, 20);
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.messages') is null then
    raise notice '跳过：没有 messages 表';
    return;
  end if;
  drop trigger if exists affinity_on_message on public.messages;
  create trigger affinity_on_message
    after insert on public.messages
    for each row execute function public.affinity_from_message();
end $$;

-- 5.2 给别人的朋友圈点赞：+2，每天最多 +10
create or replace function public.affinity_from_friend_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
begin
  select author_id into owner from public.friend_posts where id = new.post_id;
  if owner is null then
    return new;
  end if;
  perform public.add_affinity(new.user_id, owner, 2, 10);
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.friend_likes') is null then
    raise notice '跳过：没有 friend_likes 表（点赞不加分，其余照常）';
    return;
  end if;
  drop trigger if exists affinity_on_friend_like on public.friend_likes;
  create trigger affinity_on_friend_like
    after insert on public.friend_likes
    for each row execute function public.affinity_from_friend_like();
end $$;


-- 让 PostgREST 立刻认识新字段/新表
notify pgrst, 'reload schema';


-- ============================================================
-- 核查（只读，跑完可以逐条执行确认）
-- ============================================================
-- 1) 开关加上没有 —— 应返回一行 boolean
-- select column_name, data_type, column_default from information_schema.columns
-- where table_schema = 'public' and table_name = 'profiles' and column_name = 'affinity_public';

-- 2) 表与策略 —— 应返回 1 行策略（cmd = SELECT）
-- select tablename, policyname, cmd from pg_policies
-- where schemaname = 'public' and tablename = 'affinity';

-- 3) 触发器 —— 应返回 2 行
-- select tgname, tgrelid::regclass as 表 from pg_trigger where tgname like 'affinity%';

-- 4) 当前分数（站主视角能看到全部；客户端受 RLS 限制）
-- select a.from_id, a.to_id, a.score, a.today, a.today_score,
--        (select nickname from public.profiles where id = a.from_id) as 谁,
--        (select nickname from public.profiles where id = a.to_id)   as 对谁
-- from public.affinity a order by a.score desc limit 20;
