# 0003: Isolated diagram rendering

Status: Accepted

Recorded: 2026-10-02, after a synthetic compatibility check.

## Context

Markdown diagrams must render offline, support zoom and print, and not execute document-provided scripts or configuration. Mermaid's sandbox output uses an iframe with dimensions and permissions that need application-level control.

## Decision drivers

Keep the strictest usable isolation; avoid a bundler/runtime installer; load only when needed; preserve readable source/error paths; maintain theme consistency and bounded inputs.

## Options considered

1. Mermaid sandbox output wrapped in a stricter opaque-origin frame: retains isolation, but requires viewBox-based sizing and parent-owned controls. Selected after sizing/offline/PDF checks.
2. Strict mode, HTML labels off, no document configuration: simpler inline SVG sizing and approved as a fallback, but less separation from the parent document. Not needed in the selected approach.
3. Loose/antiscript: more embedded interactions but weakens the document boundary. Rejected.

## Decision

Vendor Mermaid 12.1.0 with original licence and verified archive integrity plus extracted-file hash. Lazy-load the standalone script for Mermaid fences only. Initialize sandbox mode, disable HTML labels and reject front matter/directives, custom style declarations, links and image/resource directives. Only flowchart/graph, sequence and ER syntax families are enabled in this baseline. Limit source to 50,000 characters, 500 lines and 300 configured edges.

Read the generated sandbox envelope off-DOM, obtain its SVG viewBox, and display it in a replacement iframe with empty sandbox permissions and `default-src 'none'; style-src 'unsafe-inline'`. No popup, navigation, script or same-origin permission is granted. Zoom, fit, reset, drag/keyboard pan, source/copy and fullscreen controls belong to the parent. Render errors are text, with original source, not executable error markup.

Use local theme colours, render sequentially and discard stale document completions. Frames reserve geometry, then fit within the reading viewport; fit includes a height bound so tall diagrams do not create unlimited initial height. Zoom and fullscreen recover detail. Printing resets fit; extremely large diagrams can be legible only when enlarged on screen.

## Consequences

The 5.49 MB uncompressed script is absent from prose-only requests but costs a local transfer/parse on the first diagram document. There is no server compression. Rendering itself still runs in the parent JavaScript execution context before output isolation; source caps are not a hard execution timeout and do not prove resistance to every pathological graph. Future worker/process isolation is separate work, not implied by the output iframe.

No document click handlers or external resources are allowed. The source panel is intentionally raw source; the default rendered view is not. Unsupported diagram families and prohibited directives show explicit errors. Parent-side controls remain keyboard-operable while the output frame itself is not a keyboard trap.

## Revisit when

A supported diagram cannot size/print in sandbox, a renderer advisory affects the pinned version, a new diagram family is requested, or CPU isolation becomes part of the threat model.

## Sources

[Renderer](../../web/diagrams.js), [input tests](../../tests/reading.test.js), [browser matrix](../../tests/browser.mjs), [dependency integrity](../../THIRD-PARTY-NOTICES.md). Upstream schema: `https://github.com/mermaid-js/mermaid/blob/mermaid%4012.1.0/packages/mermaid/src/schemas/config.schema.yaml`.
