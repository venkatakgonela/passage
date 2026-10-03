# Architecture decisions

| Record | Status | Recorded |
| --- | --- | --- |
| [0001: Folder authority](0001-folder-authority.md) | Accepted | 2026-10-02 |
| [0002: Raster image boundary](0002-raster-image-boundary.md) | Accepted | 2026-10-02 |
| [0003: Isolated diagram rendering](0003-isolated-diagrams.md) | Accepted | 2026-10-02 |
| [0004: Bounded document metadata](0004-bounded-catalog.md) | Accepted | 2026-10-03 |
| [0005: Local reading continuity](0005-reader-continuity.md) | Accepted | 2026-10-03 |
| [0006: Reader-owned review records](0006-review-storage.md) | Accepted | 2026-10-03 |
| [0007: Heading-aligned comparison](0007-heading-aligned-compare.md) | Accepted | 2026-10-03 |

## Pending decisions

| Question | Options | Trigger |
| --- | --- | --- |
| Stronger filesystem isolation | Descriptor-based traversal versus current resolved-path checks | Hostile local mutation enters the threat model |
| Vendor refresh | Retain versions versus upgrade with compatibility fixtures | Applicable advisory or separately approved maintenance |
