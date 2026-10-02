# 0005: Local reading continuity

Status: Accepted

Recorded: 2026-10-03.

## Context

Readers need to follow a document link and return to the passage, including after edits or reloads, without modifying source documents.

## Decision drivers

Use browser Back/Forward, preserve source immutability, keep state bounded and disposable, and isolate workspace preferences.

## Options considered

1. Fragment-only navigation: minimal but loses the precise reading position. Replaced for continuity.
2. Browser history entries plus versioned local workspace state: integrates existing navigation and requires no server writes. Selected.
3. Server-side navigation database: portable across browser profiles but introduces storage and privacy scope. Rejected for this local reader.

## Decision

Store version 1 records keyed by workspace: position, last document, panel/sort preferences, at most 100 history entries, 30 recents, 30 pins and eight trail markers. Retain at most ten workspace records. Validate paths against current file membership and clamp numbers/strings before restoring.

Position restoration tries heading plus relative offset, then saved text snippet plus offset, then absolute scroll. Missing content falls back quietly with a notice; missing documents use README or the first available file. Browser history state carries current-entry positions. Trail records are separate return points, not a replacement for Back/Forward.

Peek uses an inert sanitized template, extracts one heading section and removes resource-loading elements before display. It does not execute diagrams in the preview or introduce an alternative HTML trust path. Find marks eligible text nodes, excluding diagram internals and controls, and removes only its own marks.

## Consequences

No source or server navigation writes. Browser-local data is not synchronized or a backup. Heading/snippet matches are approximate after edits; a repeated snippet can restore to a different matching occurrence. Storage may be unavailable, in which case the session remains usable without persistence. The existing diagram sandbox is unchanged.

## Revisit when

Multiple reading panes, durable cross-browser state or more precise passage identifiers become requirements.

## Sources

[Model](../../web/continuity-model.js), [navigation](../../web/continuity.js), [tools](../../web/reading-tools.js), [tests](../../tests/continuity.test.js).
