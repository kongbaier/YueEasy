//! 系统默认音频输出设备变更监听（Windows WASAPI）。
//!
//! 睡眠唤醒 / 插拔耳机 / 切换默认输出设备时，`IMMNotificationClient::OnDefaultDeviceChanged`
//! 在 WASAPI 托管线程回调，这里只置位共享的 `device_changed` 标志；
//! 实际重建设备 + 重播由播放器的 watcher 完成（涉及异步网络 I/O，不能在此回调里做）。

use std::sync::atomic::AtomicBool;
use std::sync::Arc;

#[cfg(target_os = "windows")]
mod windows {
    use super::{Arc, AtomicBool};
    use std::sync::atomic::Ordering;
    use std::time::Duration;

    use windows::core::{implement, PCWSTR};
    use windows::Win32::Media::Audio::{
        eConsole, eRender, DEVICE_STATE, EDataFlow, ERole, IMMDeviceEnumerator,
        IMMNotificationClient, IMMNotificationClient_Impl, MMDeviceEnumerator,
    };
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
    };
    use windows::Win32::UI::Shell::PropertiesSystem::PROPERTYKEY;

    #[implement(IMMNotificationClient)]
    struct NotificationClient {
        on_default_changed: Arc<AtomicBool>,
    }

    impl IMMNotificationClient_Impl for NotificationClient_Impl {
        fn OnDefaultDeviceChanged(
            &self,
            flow: EDataFlow,
            role: ERole,
            _pwstr: &PCWSTR,
        ) -> windows::core::Result<()> {
            // 只关心「渲染（输出）+ 控制台（主音量）」默认设备变更。
            if flow == eRender && role == eConsole {
                self.on_default_changed.store(true, Ordering::SeqCst);
            }
            Ok(())
        }

        fn OnDeviceStateChanged(
            &self,
            _pwstr: &PCWSTR,
            _state: DEVICE_STATE,
        ) -> windows::core::Result<()> {
            Ok(())
        }

        fn OnDeviceAdded(&self, _pwstr: &PCWSTR) -> windows::core::Result<()> {
            Ok(())
        }

        fn OnDeviceRemoved(&self, _pwstr: &PCWSTR) -> windows::core::Result<()> {
            Ok(())
        }

        fn OnPropertyValueChanged(
            &self,
            _pwstr: &PCWSTR,
            _key: &PROPERTYKEY,
        ) -> windows::core::Result<()> {
            Ok(())
        }
    }

    pub(super) fn watch(device_changed: Arc<AtomicBool>) {
        std::thread::spawn(move || {
            unsafe {
                // WASAPI 通知回调来自 MTA 线程，需在本线程初始化 COM。
                let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            }

            let client: IMMNotificationClient =
                NotificationClient { on_default_changed: device_changed }.into();

            let enumerator: IMMDeviceEnumerator =
                match unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) } {
                    Ok(e) => e,
                    Err(_) => return,
                };

            if unsafe { enumerator.RegisterEndpointNotificationCallback(&client) }.is_err() {
                return;
            }

            // 保持 client / enumerator 存活，否则回调注销。
            loop {
                std::thread::sleep(Duration::from_secs(60));
            }
        });
    }
}

pub fn watch_default_device(device_changed: Arc<AtomicBool>) {
    #[cfg(target_os = "windows")]
    windows::watch(device_changed);

    #[cfg(not(target_os = "windows"))]
    let _ = device_changed;
}
