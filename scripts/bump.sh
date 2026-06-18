#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?usage: ./scripts/bump.sh <version>}"

# 去掉 v 前缀（兼容 ./bump.sh v0.2.0 和 ./bump.sh 0.2.0）
VERSION="${VERSION#v}"

[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
  echo "错误: 版本号格式无效，需要 x.y.z 格式，例如 0.2.0"
  exit 1
}

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# package.json
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$ROOT/package.json"

# src-tauri/Cargo.toml
sed -i "s/^version = \"[^\"]*\"/version = \"$VERSION\"/" "$ROOT/src-tauri/Cargo.toml"

# src-tauri/tauri.conf.json
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$ROOT/src-tauri/tauri.conf.json"

echo "版本已更新为 v$VERSION"
