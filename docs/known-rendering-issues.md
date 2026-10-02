# Known rendering issues

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
