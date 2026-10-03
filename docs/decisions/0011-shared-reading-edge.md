# 0011: Shared reading edge and intrinsic block widths

Status: Accepted

Recorded: 2026-10-03 during implementation. Supersedes the width and Appearance decisions in [0010](0010-reading-shell.md); its other shell decisions remain in effect.

## Context

Independently centred text and technical blocks gave headings, prose and diagrams different starting positions. Closed panels left usable space empty. A modal Appearance sheet separated small reading adjustments from the page.

## Decision drivers

A stable shared starting edge, optional longer prose lines, usable short snippets, preserved reader position, narrow-screen clearance, keyboard access and unchanged document/sandbox boundaries.

## Options considered

1. Keep independently centred breakouts: simplest, and familiar in editorial layouts, but creates ragged starting positions. Rejected for technical reading.
2. Stretch all content across the available width: needs no intrinsic measurement, but makes short prose and tiny tables unnecessarily broad. Retained only as an explicit Fill window preference for prose.
3. One centred container with left-aligned, measured prose and intrinsic technical expansion: selected. Requires synchronous layout measurement and browser regression tests, but retains a consistent edge and uses available space where content needs it.
4. Keep modal Appearance: robust native focus isolation, but blocks the page for a small adjustment. Use an anchored nonmodal dialog with explicit dismissal and focus restoration instead; no dependency or custom overlay layer is required.

## Decision

The article container is at most 1400px, bounded by the reading area after side panels. All top-level blocks share its left edge. Prose defaults to 80 nominal characters (60–140), with a separate persisted Fill window boolean. Existing valid measures are preserved; out-of-range values clamp; missing values use 80. Reset restores measured mode and 80. The measure uses the existing half-font-size pixel estimate rather than counting actual proportional-font characters.

Code, tables, diagrams, images and display math expand to the container only when intrinsic content exceeds the selected prose width. Short blocks remain at prose width. Code/table/math measurement temporarily applies max-content to existing elements and restores their styles synchronously; diagrams use validated original viewBox dimensions and images use metadata. Resize and appearance/document events coalesce into animation frames. Layout changes preserve the reader anchor. Heading anchors sit outside text flow in the left margin.

Appearance remains a labelled dialog element but opens nonmodally next to the initiating rail/header control, clamped inside the viewport. Escape, Close and outside pointer dismissal restore the initiating control. Native radio/range/select/checkbox controls provide keyboard adjustments; global shortcuts do not intercept keys inside the panel. No scrim or modal focus trap is applied. Below 1024px, a reserved 68px bottom strip keeps the section control outside the scrolling document; the single-column document and panel drawers remain.

## Consequences

Wider selected lines can be harder to read; 80 is a default, not a prohibition on user choice. Intrinsic measurements force layout and cost more on documents with many technical blocks. A resize can change block heights; anchor restoration is approximate when content itself changes. Fixed image frame heights and diagram height caps remain intentional limitations. Native tooltips and one-browser keyboard checks do not constitute a screen-reader audit. Outside dismissal consumes the initial pointer-down to preserve return focus; activate the destination again if needed. No runtime dependency, server authority, document write path or Mermaid sandbox setting changes.

## Revisit when

Large-document profiling identifies excessive measurement costs, wider assistive-technology testing finds nonmodal focus issues, or user feedback shows the nominal-character estimate is misleading.

## Sources

[Layout implementation](../../web/reading-layout.js), [appearance normalization](../../web/appearance.js), [popover behavior](../../web/appearance-popover.js), [layout and keyboard checks](../../tests/polish-browser.mjs), [appearance unit checks](../../tests/reading.test.js).
