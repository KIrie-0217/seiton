//! Virtual, device-relative paths.

use std::fmt;

/// Errors produced when parsing a [`VPath`].
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum PathError {
    #[error("path component `..` is not allowed: {0}")]
    ParentComponent(String),
    #[error("path component contains a forbidden character: {0}")]
    ForbiddenChar(String),
    #[error("invalid file name: {0:?}")]
    InvalidName(String),
}

/// A path inside a device, relative to its root.
///
/// Components are separated by `/`, there is no leading separator and the
/// empty path is the root. Parsing accepts `/` and `\` as separators and
/// rejects `..` and characters that could escape the root (`:` and NUL), so a
/// `VPath` can be safely joined onto a local directory.
#[derive(Debug, Clone, Default, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct VPath(String);

impl VPath {
    /// The device root.
    pub fn root() -> Self {
        Self(String::new())
    }

    /// Parses a path, normalizing separators and dropping empty / `.` parts.
    pub fn parse(s: &str) -> Result<Self, PathError> {
        let mut parts: Vec<&str> = Vec::new();
        for part in s.split(['/', '\\']) {
            match part {
                "" | "." => {}
                ".." => return Err(PathError::ParentComponent(s.to_owned())),
                p if p.contains([':', '\0']) => {
                    return Err(PathError::ForbiddenChar(s.to_owned()));
                }
                p => parts.push(p),
            }
        }
        Ok(Self(parts.join("/")))
    }

    /// Appends a single file or directory name.
    pub fn join(&self, name: &str) -> Result<Self, PathError> {
        if name.is_empty() || name == "." || name.contains(['/', '\\']) {
            return Err(PathError::InvalidName(name.to_owned()));
        }
        let child = Self::parse(name)?;
        if self.0.is_empty() {
            Ok(child)
        } else {
            Ok(Self(format!("{}/{}", self.0, child.0)))
        }
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn is_root(&self) -> bool {
        self.0.is_empty()
    }

    /// Iterates over the components from the root.
    pub fn components(&self) -> impl Iterator<Item = &str> {
        self.0.split('/').filter(|c| !c.is_empty())
    }

    /// Number of components (the root has depth 0).
    pub fn depth(&self) -> usize {
        self.components().count()
    }

    /// The parent directory, or `None` for the root.
    pub fn parent(&self) -> Option<Self> {
        if self.0.is_empty() {
            return None;
        }
        Some(match self.0.rfind('/') {
            Some(i) => Self(self.0[..i].to_owned()),
            None => Self::root(),
        })
    }

    /// Ancestors from the parent up to (but excluding) the root.
    pub fn ancestors(&self) -> impl Iterator<Item = Self> {
        std::iter::successors(self.parent(), Self::parent).take_while(|p| !p.is_root())
    }

    /// The last component.
    pub fn file_name(&self) -> Option<&str> {
        self.0.rsplit('/').next().filter(|n| !n.is_empty())
    }

    /// The file name without its final extension (`IMG_0001.CR3` -> `IMG_0001`).
    pub fn file_stem(&self) -> Option<&str> {
        let name = self.file_name()?;
        Some(match split_ext(name) {
            Some((stem, _)) => stem,
            None => name,
        })
    }

    /// The final extension without the dot (`IMG_0001.CR3` -> `CR3`).
    pub fn extension(&self) -> Option<&str> {
        split_ext(self.file_name()?).map(|(_, ext)| ext)
    }
}

fn split_ext(name: &str) -> Option<(&str, &str)> {
    match name.rfind('.') {
        // A leading dot (".hidden") is part of the name, not an extension.
        Some(0) | None => None,
        Some(i) if i + 1 == name.len() => None,
        Some(i) => Some((&name[..i], &name[i + 1..])),
    }
}

impl fmt::Display for VPath {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "/{}", self.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_normalizes_separators_and_dots() {
        let p = VPath::parse("\\DCIM//100CANON/./IMG_0001.CR3").unwrap();
        assert_eq!(p.as_str(), "DCIM/100CANON/IMG_0001.CR3");
        assert_eq!(p.depth(), 3);
        assert_eq!(p.to_string(), "/DCIM/100CANON/IMG_0001.CR3");
    }

    #[test]
    fn parse_rejects_escaping_components() {
        assert!(matches!(
            VPath::parse("DCIM/../x"),
            Err(PathError::ParentComponent(_))
        ));
        assert!(matches!(
            VPath::parse("C:/Windows"),
            Err(PathError::ForbiddenChar(_))
        ));
        assert!(matches!(
            VPath::parse("a\0b"),
            Err(PathError::ForbiddenChar(_))
        ));
    }

    #[test]
    fn root_properties() {
        let root = VPath::parse("/").unwrap();
        assert!(root.is_root());
        assert_eq!(root.parent(), None);
        assert_eq!(root.file_name(), None);
        assert_eq!(root.depth(), 0);
    }

    #[test]
    fn join_and_parent() {
        let dir = VPath::root()
            .join("DCIM")
            .unwrap()
            .join("100CANON")
            .unwrap();
        assert_eq!(dir.as_str(), "DCIM/100CANON");
        assert_eq!(dir.parent().unwrap().as_str(), "DCIM");
        assert!(dir.parent().unwrap().parent().unwrap().is_root());
        assert!(dir.join("a/b").is_err());
        assert!(dir.join("..").is_err());
        assert!(dir.join("").is_err());
    }

    #[test]
    fn ancestors_exclude_root() {
        let p = VPath::parse("DCIM/100CANON/IMG_0001.JPG").unwrap();
        let names: Vec<_> = p.ancestors().map(|a| a.as_str().to_owned()).collect();
        assert_eq!(names, ["DCIM/100CANON", "DCIM"]);
    }

    #[test]
    fn stem_and_extension() {
        let p = VPath::parse("DCIM/100CANON/IMG_0001.CR3").unwrap();
        assert_eq!(p.file_stem(), Some("IMG_0001"));
        assert_eq!(p.extension(), Some("CR3"));

        let hidden = VPath::parse(".hidden").unwrap();
        assert_eq!(hidden.file_stem(), Some(".hidden"));
        assert_eq!(hidden.extension(), None);

        let multi = VPath::parse("a.tar.gz").unwrap();
        assert_eq!(multi.file_stem(), Some("a.tar"));
        assert_eq!(multi.extension(), Some("gz"));

        assert_eq!(VPath::parse("trailing.").unwrap().extension(), None);
    }
}
