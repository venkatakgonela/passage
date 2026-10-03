# 0010: Section rail and reading-first shell

Status: Accepted

Recorded: 2026-10-03 during implementation.

## Context

Stacked equally weighted controls and a tall navigation header competed with the document. Focus hid sidebars but left action rows. Search and file filtering appeared as two adjacent inputs with different meanings.

## Decision drivers

Reading space, discoverability, keyboard access, existing behavior preservation, responsive geometry, no new dependencies and unchanged read-only/sandbox boundaries.

## Options considered

1. Compact global toolbar with two panes: familiar but still spends a permanent row on actions and keeps review sections separate. Not selected.
2. Full-height rail with a reusable section panel and an in-document header: selected. It releases vertical space but requires shortcut hints, labelled expansion and a small-screen drawer.
3. Hide all actions behind a palette: clean but poor discoverability and pointer access. Rejected.

## Decision

Use a 44px rail with optional remembered labels, a 240–280px resizable section panel, and page actions inside the scrollable reading area. Files has one name/title filter; content Search is a separate section. Lists and Notes reuse existing record logic in nonmodal panel views. Compare and operations needing isolation retain modal dialogs. The right panel offers Outline/Notes/Lists; one view instance moves between hosts rather than duplicating editable records.

Below 1024px the rail becomes a floating 44px section control and drawer; below 1280px the right panel is a drawer. Text defaults to 68ch, clamped to 60–75; technical blocks use available width up to 1100px. Menus support arrows/Home/End, and file rows use roving focus. A remembered first-run hint explains Quick open and Commands. Native tooltips and accessible names identify icon controls.

Focus hides side chrome and reveals the page header on top-edge pointer movement, upward scrolling or header keyboard focus. A reserved header slot maintains normal document geometry; focus uses an overlay and discoverable Escape exit. Folder eligibility is returned by the same policy that handles registration, not a client-side authorization approximation.

## Consequences

Old appearance measures outside 60–75 are clamped on load; old panel widths are clamped to the new range when applied. Source documents, root authority, review revisions and diagram sandbox remain unchanged. Compact single-line titles can ellipsize; full paths remain in tooltips. Native tooltips are not a substitute for a broad assistive-technology audit. Multiple server processes and cross-device synchronization remain unsupported. No frontend framework, build step or vendor update is introduced.

## Revisit when

Observed user difficulty finding commands, a broader keyboard/screen-reader audit, or additional sections show that the rail or shared-view model is insufficient.

## Sources

[Shell](../../web/shell.js), [styles](../../web/shell.css), [browser interaction tests](../../tests/chrome-browser.mjs), [folder eligibility tests](../../tests/test_shell.py), [existing continuity decision](0005-reader-continuity.md).
