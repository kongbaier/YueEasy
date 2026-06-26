#!/usr/bin/env pwsh
param(
  [Parameter(Mandatory=$true)]
  [string]$Version
)

# 去掉 v 前缀
$Version = $Version -replace '^v', ''

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
  Write-Error "错误: 版本号格式无效，需要 x.y.z 格式，例如 0.2.0"
  exit 1
}

$Root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)

# 读取当前版本，用于确认提示
$pjCurrent = Get-Content "$Root\package.json" -Raw
$currentVersion = if ($pjCurrent -match '"version"\s*:\s*"([^"]*)"') { $matches[1] } else { $null }

if ($currentVersion) {
  Write-Host ""
  if ([version]$Version -lt [version]$currentVersion) {
    Write-Host "⚠️ 降级警告: v$currentVersion -> v$Version（新版本低于当前版本）" -ForegroundColor Yellow
    $confirm = Read-Host "确认降级？输入版本号 '$Version' 继续"
    if ($confirm -ne $Version) {
      Write-Host "已取消。"
      exit 0
    }
  } else {
    Write-Host "版本变更: v$currentVersion -> v$Version" -ForegroundColor Cyan
    $confirm = Read-Host "确认升级？输入 'y' 继续"
    if ($confirm -ne 'y') {
      Write-Host "已取消。"
      exit 0
    }
  }
}

# package.json
$pj = Get-Content "$Root\package.json" -Raw
$pj = $pj -replace '("version"\s*:\s*")[^"]*(")', ('${1}' + $Version + '${2}')
[System.IO.File]::WriteAllText("$Root\package.json", $pj, [System.Text.UTF8Encoding]::new($false))

# src-tauri/Cargo.toml（只匹配 [package] 下的 version，以 ^ 开头锚定）
$ct = Get-Content "$Root\src-tauri\Cargo.toml" -Raw
$ct = $ct -replace '(?m)^version\s*=\s*"[^"]*"', ('version = "' + $Version + '"')
[System.IO.File]::WriteAllText("$Root\src-tauri\Cargo.toml", $ct, [System.Text.UTF8Encoding]::new($false))

# src-tauri/tauri.conf.json
$tc = Get-Content "$Root\src-tauri\tauri.conf.json" -Raw
$tc = $tc -replace '("version"\s*:\s*")[^"]*(")', ('${1}' + $Version + '${2}')
[System.IO.File]::WriteAllText("$Root\src-tauri\tauri.conf.json", $tc, [System.Text.UTF8Encoding]::new($false))

Write-Host "版本已更新为 v$Version"
