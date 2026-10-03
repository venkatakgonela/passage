# 0009: User-scoped settings outside source roots

Status: Accepted

Recorded: 2026-10-03 during implementation.

## Context

Checkout-local defaults prevented registering the checkout itself without weakening the source-write boundary. Review records remain beside workspace settings as in [0006](0006-review-storage.md); this decision changes the default location, not that storage contract.

## Decision drivers

Read-only displayed sources, predictable configuration, reversible migration, no added dependencies and no silent overwrite.

## Options considered

1. Allow settings inside a displayed root: removes the registration error but breaks the boundary. Rejected.
2. Require every user to supply an external settings path: safe but leaves the default broken for checkout reading. Retained as an override only.
3. User-scoped default with non-destructive legacy copying: selected; different checkouts now share default state.

## Decision

Use absolute `XDG_CONFIG_HOME/passage`, otherwise resolved home `.config/passage`. `READER_SETTINGS` still chooses the roots filename and bypasses migration. Reviews remain adjacent. Reject any registered root enclosing the resolved settings directory.

Before default startup, copy regular, non-symlink legacy `.state/roots.json` and `reviews-*.json` only when the destination name is absent. Stream into a private same-directory temporary file, flush/fsync, then hard-link without replacement. Keep originals. Mark completion with `.legacy-migrated`; after completion later legacy additions are ignored. A copy failure leaves completed destinations intact, no marker, and aborts startup; retry skips completed files. Explicit overrides neither copy nor mark migration. Do not interpret or repair legacy JSON during copying: existing loading/validation remains responsible for it.

Use the existing modal/focus lifecycle for in-page destructive confirmations, initially focus Cancel, wrap Tab, preserve native Escape cancellation, and restore the invoking control. Use text-only action-local status for errors.

## Consequences

The checkout is registrable with the new default. Home itself may no longer be registrable because it encloses configuration; use narrower document roots or an override elsewhere. Existing explicit settings paths keep their behavior. Multiple checkouts share defaults; independent instances need separate overrides. Originals, review backups and the marker are local unencrypted state, not versioned product files. Copying is atomic per file, not a transaction over the entire set; one server process remains supported. Filesystems without hard links fail migration rather than silently downgrade safety. No protection against a hostile local filesystem actor or guarantee of directory durability after power loss is claimed.

## Revisit when

Portable installations, multi-process coordination or non-hard-link filesystems become supported requirements.

## Sources

[Settings implementation](../../server/settings.py), [folder boundary](../../server/policy.py), [settings regressions](../../tests/test_settings.py), [dialog interactions](../../tests/dialog-browser.mjs).
