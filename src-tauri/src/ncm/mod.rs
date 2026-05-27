pub mod server;

use std::sync::{Arc, Mutex};

pub struct NcmState {
    pub port: Arc<Mutex<Option<u16>>>,
}

impl NcmState {
    pub fn new() -> Self {
        Self {
            port: Arc::new(Mutex::new(None)),
        }
    }

    pub fn clone_port(&self) -> Arc<Mutex<Option<u16>>> {
        self.port.clone()
    }
}
