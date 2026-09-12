//! 领域服务层：编排网络层取数与数据处理层映射，并做业务 code 校验。
pub mod ncm;

pub use ncm::NcmService;
