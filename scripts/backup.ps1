# ⑦ 数据备份
#
# 用法（先设一次连接串，之后每次直接跑）：
#   $env:SUPABASE_DB_URL = "postgresql://postgres:<数据库密码>@db.cdmytrvpskkdwjsenidt.supabase.co:5432/postgres"
#   pwsh -File scripts/backup.ps1
#
# 数据库密码在 Supabase → Project Settings → Database → Connection string 里能看到
#（注意是**数据库密码**，不是那个 publishable key）。
#
# 前提：这台机器上装了 PostgreSQL 的客户端工具（要能执行 pg_dump）。
#   装法：winget install PostgreSQL.PostgreSQL.16
#   只装命令行工具也可以；装完新开一个终端让 PATH 生效。
#
# 定时跑（免费、不用服务器）：Windows 任务计划程序
#   1. 任务计划程序 → 创建基本任务 → 每天 / 每周
#   2. 操作 → 启动程序 → 程序：pwsh
#      参数：-NoProfile -File "C:\Users\Steve Tom\treehole\scripts\backup.ps1"
#   3. 触发器里勾上「如果错过计划则尽快启动」
#   记得在「常规」里勾「不管用户是否登录都运行」，并填好 SUPABASE_DB_URL
#   （系统级环境变量，或把这个脚本改成从文件读连接串）。

param(
    # 备份存到哪（默认仓库下的 backups/，已在 .gitignore 里）
    [string]$OutDir = (Join-Path $PSScriptRoot '..\backups'),
    # 保留多少份，超了删最旧的
    [int]$Keep = 14
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
    Write-Host '没找到 pg_dump。先装 PostgreSQL 客户端工具：' -ForegroundColor Yellow
    Write-Host '  winget install PostgreSQL.PostgreSQL.16' -ForegroundColor Yellow
    Write-Host '装完新开一个终端，再跑这个脚本。'
    Write-Host ''
    Write-Host '不装也可以，另两条路：'
    Write-Host '  · Supabase 自带每日备份：Dashboard → Database → Backups（可以直接从这里恢复）'
    Write-Host '  · 需要「任意时间点恢复」要 Pro 计划（PITR）'
    exit 1
}

$url = $env:SUPABASE_DB_URL
if ([string]::IsNullOrWhiteSpace($url)) {
    Write-Host '还没设连接串。先跑一次（把 <数据库密码> 换成真的）：' -ForegroundColor Yellow
    Write-Host '  $env:SUPABASE_DB_URL = "postgresql://postgres:<数据库密码>@db.cdmytrvpskkdwjsenidt.supabase.co:5432/postgres"'
    Write-Host '密码在 Supabase → Project Settings → Database 里。'
    exit 1
}

$OutDir = [System.IO.Path]::GetFullPath($OutDir)
if (-not (Test-Path -LiteralPath $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$file = Join-Path $OutDir "treehole-$stamp.sql"

Write-Host "开始备份 → $file"
# --no-owner / --no-privileges：恢复时不用纠结角色，换机器也能用
& pg_dump --no-owner --no-privileges --clean --if-exists --file="$file" $url

if ($LASTEXITCODE -ne 0) {
    Write-Host "备份失败（pg_dump 退出码 $LASTEXITCODE）" -ForegroundColor Red
    exit $LASTEXITCODE
}

$size = [math]::Round((Get-Item -LiteralPath $file).Length / 1KB, 1)
Write-Host "备份完成：$size KB" -ForegroundColor Green

# 只留最近 $Keep 份
$old = Get-ChildItem -LiteralPath $OutDir -Filter 'treehole-*.sql' |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $Keep
foreach ($f in $old) {
    Remove-Item -LiteralPath $f.FullName -Force
    Write-Host "清掉旧备份：$($f.Name)"
}
