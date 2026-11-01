//! NCM 评论 IPC 命令（薄壳）：参数透传 → service。

use super::command;
use crate::model::entity::CommentPage;

command!(ncm_comment_playlist(state, id: i64, limit: Option<i64>, offset: Option<i64>) -> CommentPage => comment_playlist);
command!(ncm_comment_music(state, id: i64, limit: Option<i64>, offset: Option<i64>) -> CommentPage => comment_music);
