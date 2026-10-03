# 0007: Heading-aligned comparison

Status: Accepted

Recorded: 2026-10-03, before the comparison implementation.

## Context

Related documents often share section names but not section lengths. Plain proportional scrolling loses the relationship between sections.

## Decision drivers

Readable narrow screens, deterministic matching, existing safe rendering and keyboard operation.

## Options considered

1. Independent panes: least surprising but requires manual section navigation throughout. Retain manual navigation, but do not make this the default.
2. Exact normalized heading text, matching repeated headings by occurrence, with interpolation: transparent and dependency-free. Selected.
3. Semantic or fuzzy alignment: tolerates renamed headings but can silently pair unrelated sections. Not selected without evidence and explicit controls.

## Decision

Reuse the full sanitized renderer in two separately scrolling article containers. Match whitespace-normalized, case-insensitive heading text and occurrence. Interpolate between common headings when their order agrees; otherwise fall back to proportional progress. A shared section selector jumps both panes to an available match. On narrow screens stack the two scrollable panes rather than squeeze their columns. Exiting Compare restores the unchanged underlying reader.

## Consequences

This is a reading aid, not a text diff. Renamed and reordered sections may use proportional fallback; layout changes from loaded media require fresh geometry. Repeated headings are occurrence-based rather than semantic. Both panes retain diagram isolation, safe image routes and local table/code overflow. Notes and navigation history remain attached to the main reader.

## Revisit when

Users need explicit section pairing, text differences or editing rather than read-only comparison.

## Sources

[Rendering](../../web/rendering.js).
