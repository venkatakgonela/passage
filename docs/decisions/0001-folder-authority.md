# 0001: Folder authority

Status: Accepted

Recorded: 2026-10-02, at implementation time.

## Context

The existing picker defaults to home but accepts explicit paths anywhere the process can read. Persisted registered roots could otherwise make past authority permanent. Folder names themselves can be private metadata. The reader must still add ordinary folders without introducing a new UI.

## Decision drivers

Limit unexpected filesystem exposure, retain the existing picker workflow, permit deliberate outside-home collections, avoid document writes, and enforce the same policy at listing and registration.

## Options considered

1. Unrestricted accessible directories: maximum compatibility and no navigation boundary, but exposes unnecessary directory metadata. Rejected because default-local does not mean harmless.
2. Resolved home plus startup-supplied roots: retains normal home navigation and enables intentional external collections. It still exposes broad home metadata and requires outside roots at each startup. Selected as the compatible bounded policy.
3. Startup roots only: tighter least authority and easier isolation, but prevents adding unrelated home folders through the existing picker. Not selected because it materially changes the ordinary workflow.

## Decision

Resolve allowed boundaries from home and explicit startup roots. Resolve every requested folder before checking containment. Filter hidden, skipped and symlink picker entries; reject direct hidden/skipped relative paths. Parent navigation stops at the allowed boundary. Root registration applies the same containment rules and rejects folders containing the reader's settings file. Persisted roots are filtered by the current launch's authority and never extend it.

Document paths have a stricter independent policy: relative `.md` only, no parent traversal, no symlink components and no skipped folders. HTTP mutations require exact same-origin headers. Merely hiding an entry in the UI is not a protection.

## Consequences

Outside-home folders previously reachable by arbitrary picker paths now return 403 unless explicitly supplied at startup. Restarting without that root removes its authority even if it remains in old settings. Parent navigation cannot leave an approved external root unless its parent is independently allowed. Symlinks, hidden picker descendants and folders holding settings are unavailable. The user can move settings outside a desired collection using the documented environment variable.

Benefits: finite authority, consistent API enforcement and no accidental settings writes into displayed collections. Costs: broad home enumeration remains possible; some previously accepted folder paths no longer work; filesystem checks are not atomic against malicious local races. Directory traversal cost is not globally bounded by returned-entry caps.

## Revisit when

Users need shared/untrusted local sessions, precise selected-folder-only authority, large-network-filesystem traversal, or protection against concurrent malicious symlink replacement.

## Sources

Implementation: [policy](../../server/policy.py), [handler](../../server/http.py). Verification: [server tests](../../tests/test_server.py), especially browse/registration boundaries, persistence filtering and source immutability. These are implementation-specific observations, not claims about an external operating-system sandbox.
