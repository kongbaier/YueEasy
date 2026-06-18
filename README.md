<div align="center">
  <img src="src-tauri/icons/icon.png" alt="YueEasy" width="128">
  <h1>YueEasy（乐易）</h1>
  <p>基于 Tauri 2.0 的网易云音乐桌面客户端</p>
</div>

## 说明

1. 本项目基于 Tauri 2.0 开发，体积小，占用率低
2. 通过内嵌 [ncm-api-rs](https://github.com/SPlayer-Dev/ncm-api-rs) 访问网易云音乐 API，无需用户登录即可播放
3. 平台接口可能有访问频率限制，过于频繁的请求会触发验证码校验
4. 本项目仅供学习编程目的使用，未进行任何逆向工程
5. 本项目所有的音乐版权都归属网易云音乐

### 支持平台

| 平台       | 状态 |
| -------- | --- |
| Windows  | ✅   |
| macOS    | 未测试 |
| Linux    | 未测试 |

## 功能

- 🎵 音乐播放：完整访问网易云音乐曲库
- 🎤 逐字歌词：支持逐字高亮同步显示
- 🔍 搜索：支持歌曲、艺人搜索
- 📋 歌单：浏览和播放歌单
- 📅 每日推荐：个性化每日歌曲推荐
- 💬 评论查看：播放页面实时查看歌曲评论
- ⏯️ 播放队列：支持拖拽排序的播放队列
- 🪟 桌面原生：Windows Mica 透明背景效果

## 软件截图

<!--
截图请放到 screenshots/ 目录下，然后取消下方注释：

<div align="center">
  <p>播放页面</p>
  <img src="screenshots/player.png" alt="播放页面" style="width: 100%; max-width: 800px;">
</div>

<br>

<div align="center">
  <p>歌单</p>
  <img src="screenshots/playlist.png" alt="歌单" style="width: 100%; max-width: 800px;">
</div>

<br>

<div align="center">
  <p>搜索</p>
  <img src="screenshots/search.png" alt="搜索" style="width: 100%; max-width: 800px;">
</div>
-->

## 安装方式

可以在 [release](https://github.com/kongbai/yueeasy/releases) 目录下载 Windows 安装包，也可以通过源码编译安装。

## 编译

```bash
# 克隆项目
git clone https://github.com/kongbai/yueeasy.git
cd yueeasy

# 安装依赖
pnpm install

# 开发调试
pnpm tauri dev

# 打包构建
pnpm tauri build
```

## 技术栈

| 层 | 技术 |
|------|------|
| 桌面框架 | [Tauri v2](https://v2.tauri.app/) |
| 前端 | React 19 + TypeScript + Vite |
| 样式 | Tailwind CSS v4 |
| 状态管理 | Zustand |
| 路由 | React Router v7 |
| 后端 | Rust（Axum 内嵌服务器） |
| 数据库 | SQLite（rusqlite） |

## 参考

- 网易云音乐 API：[ncm-api-rs](https://github.com/SPlayer-Dev/ncm-api-rs)
- 桌面框架：[Tauri](https://v2.tauri.app/)
