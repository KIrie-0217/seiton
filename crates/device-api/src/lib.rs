//! Device abstraction shared by every connection method.
//!
//! A [`DeviceSource`] hides whether files come from an SD card (mass
//! storage), MTP/PTP or a vendor SDK. Differences between them are expressed
//! as [`SourceCaps`] instead of branching on the transport. Sources are
//! read-only by design: seiton never writes to the camera or card.
//!
//! See `docs/architecture.md` §4–5.

mod path;
mod source;
mod walk;

#[cfg(any(test, feature = "fake"))]
pub mod fake;

pub use bytes::Bytes;
pub use path::{PathError, VPath};
pub use source::{
    DeviceEvent, DeviceId, DeviceInfo, DeviceSource, Entry, EntryKind, ObjRef, Result, SourceCaps,
    SourceError, Transport,
};
pub use walk::walk;
