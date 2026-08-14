//! 领域服务层：浅包 netease 适配，承载「取数 + 归一 + 校验」。
pub mod ncm;

pub use ncm::NcmService;
