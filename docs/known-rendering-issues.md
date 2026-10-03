# Known rendering issues

## Current disposition

Currency amounts now remain literal: inline math cannot start with whitespace or a digit, end with whitespace, or close before a digit. Display math and protected code are unchanged. MathML layout remains browser-dependent, and inline equations retain the existing scroll hints. Narrow screenshots show the existing sidebar overlay obscuring part of the document; this task does not redesign it.

The original observations below are retained as the baseline. The current real-browser matrix checks every example at 1440, 1024 and 390px in light and dark.

Ordinary diagram labels containing “image”, “click”, “href”, URL text and “Code style checks” pass both the input filter and renderer. The architecture fixture also verifies hostile label content remains inert and ER cardinality/attribute blocks render. Unterminated quotes/groups are refused. The filter is not a full grammar; unusual unquoted edge-label separators remain a documented limit. Root metadata now says Workspace; excess short-diagram space and stale-render cancellation remain in the backlog.

| Baseline case | Current result |
| --- | --- |
| Raw sequence/ER/flow diagrams | Fixed for supported syntax: sandboxed diagrams, fit/zoom/pan/source/fullscreen. Deliberate invalid/config fixtures show errors and source. |
| Wide tables | Contained scroll with visible hint and keyboard focus; no page overflow. |
| Long code | Separate language/copy/wrap toolbar, reachable scrollable lines; no overlaid copy button. |
| Long URL/heading and deep lists | Wrapping and bounded layout; browser viewport checks pass. |
| Large local image | PNG/JPEG render in stable reserved frames. SVG remains excluded, with readable alt failure rather than an unexplained blank. |
| Footnotes/callouts/front matter | Minimal documented grammar implemented with escaped metadata and plain-text notes; complex YAML/nested footnote Markdown remain unsupported. |
| Heading targets | Scroll clearance and native Back/Forward verified; bounded history, trail and session positions are now implemented. |
| Narrow panels | Keyboard drawers with close/Escape and focus return; intentional overlay, not an inaccessible clipped panel. |
| Print | A4/Letter fit with repeated table headers; 12-column table text remains only 6pt and tall/wide diagram labels can be very small. Known readability limitation, not clipped content or a completed typography solution. |

Fixed 420px image frames trade whitespace for stability and retain readable error text. Browser tests exercise delayed metadata and theme changes. Diagram source caps are not a hard execution timeout. Remote/data images retain their earlier network treatment; no new server proxy exists.

## Original baseline

Status: observed, intentionally unfixed. Reproduce with [synthetic stress cases](../examples/stress.md), 17px text, light theme and viewport height 1000px at widths 1440, 1024 and 390px. Browser: Chromium-family version 154 on macOS. Both the unchanged baseline and modular reader produced the same measured widths below.

| Case / section | Observation | Widths | Future correction criterion |
| --- | --- | --- | --- |
| Wide sequence, wide relationships, tall flow | Mermaid source is displayed as code, not diagrams | All | Diagrams render and remain fully accessible |
| Wide table | 12 columns require a 1561px content region inside 779/633/341px wrappers; horizontal scrolling works, but most columns start off-screen | All | Preserve access to all columns and clear scrolling affordance |
| Long code | 200-character lines scroll within code content; no wrap control; copy button appears on hover | All | Keep all text/copy controls accessible, including narrow/touch layouts |
| Long strings / URL | Unbroken URL extends outside article, across the desktop TOC area and off-screen | All | Long strings cannot push content outside readable bounds |
| 70-character heading | Unbroken heading suffix exceeds article width and clips at narrow viewport; TOC label also overflows | All, most visible at 390 | Heading and TOC remain readable without page-wide overflow |
| Deep list | Twelve levels of indentation consume narrow reading width; lower items extend beyond visible content | 390 | Deep content remains reachable without hidden text |
| Large image | Relative SVG reference becomes placeholder text rather than displaying the image | All | Local image is displayed safely in later rendering work |
| Unsupported syntax | Footnotes appear as literal reference/body syntax; callout marker is plain blockquote text | All | Dedicated rendering only when explicitly implemented |
| Task front matter | `status: ready` is ordinary Markdown content, not metadata UI | All | Dedicated metadata rendering is future scope |
| Heading targets | Clicking scrolls without changing the document URL or retaining a return position | All | Navigation continuity is future scope |
| Narrow sidebar | Sidebar overlays document rather than reserving reading width when open | 390 | Overlay behaviour and obscured content need deliberate design |

The inline-code path wraps at hyphens in this fixture; no separate clipping defect was observed there. Code and table horizontal scrolling should not be confused with inaccessible clipping. The outer document scroller nevertheless expands to 3133px at desktop/tablet and 3117px at narrow width due to long strings/headings, versus visible widths 1115/699/375px. These measurements are a reproducible baseline, not a passing overflow criterion.

Screenshots are kept outside the product tree. Fixture links and section names here suffice to reproduce the observations; no private evidence location is required.
