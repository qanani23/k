#[cfg(test)]
mod tests {
    use crate::models::VersionManifest;
    use std::collections::HashMap;

    #[test]
    fn test_emergency_disable_true() {
        let manifest = VersionManifest {
            latest_version: "1.0.0".to_string(),
            min_supported_version: "0.9.0".to_string(),
            release_notes: "Test release".to_string(),
            download_url: "https://example.com/download".to_string(),
            checksums: None,
            emergency_disable: Some(true),
        };

        assert!(manifest.is_emergency_disabled());
    }

    #[test]
    fn test_emergency_disable_false() {
        let manifest = VersionManifest {
            latest_version: "1.0.0".to_string(),
            min_supported_version: "0.9.0".to_string(),
            release_notes: "Test release".to_string(),
            download_url: "https://example.com/download".to_string(),
            checksums: None,
            emergency_disable: Some(false),
        };

        assert!(!manifest.is_emergency_disabled());
    }

    #[test]
    fn test_emergency_disable_missing() {
        let manifest = VersionManifest {
            latest_version: "1.0.0".to_string(),
            min_supported_version: "0.9.0".to_string(),
            release_notes: "Test release".to_string(),
            download_url: "https://example.com/download".to_string(),
            checksums: None,
            emergency_disable: None,
        };

        // When emergency_disable is missing, it should default to false
        assert!(!manifest.is_emergency_disabled());
    }

    #[test]
    fn test_emergency_disable_malformed_json() {
        // Test that we can parse JSON with missing emergencyDisable field
        let json = r#"{
            "latestVersion": "1.0.0",
            "minSupportedVersion": "0.9.0",
            "releaseNotes": "Test release",
            "downloadUrl": "https://example.com/download"
        }"#;

        let manifest: Result<VersionManifest, _> = serde_json::from_str(json);
        assert!(manifest.is_ok());

        let manifest = manifest.unwrap();
        assert!(!manifest.is_emergency_disabled());
    }

    #[test]
    fn test_emergency_disable_with_checksums() {
        let mut checksums = HashMap::new();
        checksums.insert("windows".to_string(), "abc123".to_string());
        checksums.insert("macos".to_string(), "def456".to_string());

        let manifest = VersionManifest {
            latest_version: "1.0.0".to_string(),
            min_supported_version: "0.9.0".to_string(),
            release_notes: "Test release".to_string(),
            download_url: "https://example.com/download".to_string(),
            checksums: Some(checksums),
            emergency_disable: Some(true),
        };

        assert!(manifest.is_emergency_disabled());
    }

    #[test]
    fn test_version_manifest_serialization() {
        let manifest = VersionManifest {
            latest_version: "1.0.0".to_string(),
            min_supported_version: "0.9.0".to_string(),
            release_notes: "Test release".to_string(),
            download_url: "https://example.com/download".to_string(),
            checksums: None,
            emergency_disable: Some(true),
        };

        let json = serde_json::to_string(&manifest).unwrap();
        assert!(json.contains("emergencyDisable"));
        assert!(json.contains("true"));
    }

    #[test]
    fn test_version_manifest_deserialization() {
        let json = r#"{
            "latestVersion": "1.0.0",
            "minSupportedVersion": "0.9.0",
            "releaseNotes": "Test release",
            "downloadUrl": "https://example.com/download",
            "emergencyDisable": true
        }"#;

        let manifest: VersionManifest = serde_json::from_str(json).unwrap();
        assert_eq!(manifest.latest_version, "1.0.0");
        assert_eq!(manifest.min_supported_version, "0.9.0");
        assert!(manifest.is_emergency_disabled());
    }
}
