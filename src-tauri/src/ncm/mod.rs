pub mod commands;

use std::sync::Mutex;

pub struct NcmState {
    pub inner: Mutex<NcmInner>,
}

pub struct NcmInner {
    pub client: ncm_api_rs::ApiClient,
    pub cookie: String,
}

impl NcmState {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(NcmInner {
                client: ncm_api_rs::create_client(None),
                cookie: String::new(),
            }),
        }
    }
}
