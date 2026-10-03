# 0006: Reader-owned review records

Status: Accepted

Recorded: 2026-10-03, during implementation.

## Context

Reading lists and notes need durable local storage without editing displayed documents.

## Decision drivers

Root confinement, bounded data, recoverable save failures, concurrent browser windows and no new dependency.

## Options considered

1. Browser storage: simplest and already used for navigation, but tied to one browser profile and not reader-owned settings. Not selected for review records.
2. Fixed per-root JSON settings with revisions and atomic replacement: small, inspectable and sufficient for bounded local records. Selected.
3. SQLite: stronger multi-process transactions and partial updates, but adds schema/migration complexity for small replacement records. Revisit if concurrent server processes become supported.

## Decision

Store versioned records in fixed `reviews-<root-id>.json` files beside workspace settings, outside displayed roots. The server derives the filename, never the client. Limit each root to 20 lists, 200 total references, 200 notes and 256 KiB. Names are at most 100 characters, note text 4,000, paths 500, headings 200 and snippets 300. Reject unknown fields, unsafe relative paths and unregistered roots. Missing files remain valid references; symlinks do not.

One process lock serializes validation, revision checks and replacement. A stale revision receives 409. Write a same-directory temporary file, flush and fsync it, then replace; failed saves leave the previous file intact. State is read from disk, not optimistically published in memory. This does not coordinate multiple server processes or guarantee directory durability after power loss.

Writes require exact allowed Host, matching Origin and, when present, same-origin Fetch Metadata. Missing Fetch Metadata remains compatible with non-browser local clients; Origin is mandatory. Notes export as inert text in a dialog/clipboard, not a server-selected destination.

## Consequences

Source documents remain read-only. Review settings are private, local, unencrypted and not a backup. Whole-record updates can conflict; the user must reopen after a conflict, never silently overwrite. Missing references are retained. A path replaced with an unsafe symlink is refused rather than followed. No synchronization or account model is introduced.

## Revisit when

Multiple server processes, collaborative editing, larger collections or portable backups become requirements.

## Sources

[Storage](../../server/reviews.py), [HTTP boundary](../../server/http.py).
