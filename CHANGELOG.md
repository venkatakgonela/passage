# Changelog

## Unreleased

- Reject GET requests explicitly marked cross-site while retaining Host and Origin protection.
- Add regression coverage for static suffix filtering, nosniff responses and settings-save rollback.

## 0.1.0 — 2026-10-02

- Established modular server and browser code with a dependency-free local test command and synthetic examples.
- Restricted directory browsing and registration to resolved home plus startup-authorized roots; persisted settings cannot authorize outside roots on later launches.
- Enforced exact Host/Origin checks across methods, document path/symlink/skipped-folder policy, narrow static serving and byte/result limits.
- Isolated reader settings from displayed roots and namespaced browser preferences; initial selection prefers README, then the first file.
- Protected tree construction from prototype-shaped directory names and kept search highlighting separate from HTML escaping.
- Documented existing rendering limitations without redesigning or adding rendering features.
