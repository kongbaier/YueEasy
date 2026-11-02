//! NCM 用户域 IPC 命令（薄壳）：参数透传 → service。

use super::command;
use crate::model::entity::{CloudPage, UserDetail};

command!(ncm_user_detail(state, uid: i64) -> UserDetail => user_detail);
command!(ncm_user_cloud(state, limit: Option<i64>, offset: Option<i64>) -> CloudPage => user_cloud);
