//! 服务层：领域服务，浅包基础设施（infra），承载「取数 + 归一 + 校验」。
//! 服务不感知 IPC；cmd 薄壳直接调服务层。

pub mod cache_service;
pub mod history_service;
pub mod ncm_service;
