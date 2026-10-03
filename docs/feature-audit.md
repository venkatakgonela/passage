# Verified feature audit

Fill-first update: new/unset/reset preferences fill the reading container, normal and Focus alike; saved explicit off remains off. Maximum line length appears only with Fill off. One centred 1800px cap replaces the earlier 1400px cap. [Default and persistence checks](../tests/fill-browser.mjs) supplement existing alignment/keyboard/rendering coverage. Earlier entries below describe historical defaults.

Visual polish: implemented shared left edge in a centred 1400px container; 80-character nominal default, 60–140 range and persisted/resettable Fill window; intrinsic short/wide block selection; margin heading anchors; no-scrim anchored Appearance with grouped controls and focus restoration; bottom menu clearance on narrow screens; icon Peek and full-title tooltips. The panel defaults to 280px. [Geometry and keyboard checks](../tests/polish-browser.mjs) cover desktop/focus/panel combinations and 390/768px clearance. The older entries below are historical; [decision 0011](decisions/0011-shared-reading-edge.md) supersedes the earlier measure and Appearance choices.

Reading-shell update: full-height section rail with remembered labels; compact Files/content Search and reusable Lists/Notes panels; in-document page actions and tabbed outline; small-screen section drawers; 68ch default text and wide technical blocks; Focus overlay and Escape exit. Menus and tree have explicit keyboard navigation. Folder eligibility is displayed before Add. Clean synthetic screenshot contexts replace reused hostile-fixture images. See [shell decision](decisions/0010-reading-shell.md) for compatibility and remaining audit limits.

Settings/currency update: user-scoped defaults with non-destructive one-time legacy copying and explicit override; settings-enclosing roots remain refused. Folder and corrupt-review actions use in-page confirmation/status with keyboard cancellation and restored focus. Currency-safe delimiters preserve prose; numeric-leading inline equations require a nonnumeric prefix or display math. Unit and browser regressions cover these changes. Full-window synthetic screenshots show existing chrome; narrow navigation remains an overlapping drawer, not a redesign.

Release-preparation update: sorted search covers up to 5,000 files with scanned/total notices; corrupt review state has explicit backup/reset. Native sanitized math, minimal footnotes/callouts/metadata/details, reference copy, inert HTML export, commands and recovery states are implemented. Diagram graphics in export use explicit source placeholders. No publication or tag is implied. Older audit paragraphs below describe their historical delivery scope.

Search/review update: scoped search, phrase/case/whole-word matching, retained results, bounded Chain metadata, full-rendered heading-aligned Compare, ordered lists and anchored notes are implemented. Review data writes only to bounded reader-owned settings with conflict and rollback checks. Export is selected-note text, not whole documents. See [usage and limits](../README.md) and [threat-to-test mapping](ARCHITECTURE.md).

Orientation update: labelled workspace tree, natural/modified sorting, bounded title metadata, filter/reveal/collapse, remembered panel widths, breadcrumbs, reader menus, quick open, position history/trail, section Peek, document find, recents/pins/session restore and visible-tab refresh are implemented. The original baseline table below remains historical.

## Reading update

The table below records the original baseline. Current additions: sandboxed local Mermaid for flowchart/sequence/ER; PNG/JPEG image routes; table/code containment and wrap controls; native heading Back/Forward; serif/sans/measure/focus/reset preferences; keyboard drawers; revised light/dark tokens. `web/diagrams.js`, `web/media.js`, `web/appearance.js`, `server/images.py` and `tests/browser.mjs` provide implementation and verification. Unsupported syntax and SVG remain explicitly deferred. The original baseline is retained for comparison, not presented as the current feature list.

Status: implemented baseline, inspected and browser-checked on 2026-10-02. “Present” is not a claim of complete accessibility or polished rendering.

| Area | Present | Partial / absent | Implementation |
| --- | --- | --- | --- |
| Workspace | Dropdown, add picker, remove without deleting, persisted roots | No explicit root-node UI; picker scope deliberately tightened | [workspace](../web/workspace.js), [policy](../server/policy.py) |
| Tree | Collapsible folders, folders before files, guide lines, hover/current styles, ancestor reveal | Alphabetical, not natural sort; no width/sort controls | [tree](../web/tree.js), [styles](../web/styles.css) |
| Search | Case-insensitive content/path matching, snippets, counts, 60-hit cap, stale-response sequence guard | Replaces tree; no scopes or saved queries | [search](../web/search.js), [HTTP](../server/http.py) |
| Header | Breadcrumb, words/time, H1 title with path fallback | No clickable breadcrumbs, sticky section or modification time | [rendering](../web/rendering.js) |
| Typography | Serif base at 17px, size range 13–24, theme modes | No reading-width controls/reset/focus mode | [theme](../web/theme.js), [styles](../web/styles.css) |
| Navigation | Relative Markdown links, fragments, h1–h4 IDs, h2/h3 TOC and scroll-spy, slash/b/Escape | Heading clicks do not update URL; fragment follow uses fixed delay; no position restore | [navigation](../web/navigation.js), [paths](../web/paths.js) |
| Rendering | GFM table scroll wrappers, code highlighting/copy, disabled checkboxes, print CSS | Relative images become placeholders; remote/data images remain; diagrams are raw code; no dedicated footnotes/callouts/front matter | [rendering](../web/rendering.js) |
| Safety | Loopback, Host/Origin guards, bounded Markdown reads, symlink/skip rules, sanitization boundary | Not a malicious-local-process sandbox; vendor versions retained | [architecture](ARCHITECTURE.md) |

Corrections to earlier expectations: folders-first ordering, guide lines and hover/current styling were already present. Title fallback and Escape already worked. Image replacement was limited to local references. The directory picker was not actually confined to home. Those observations informed the baseline; they are not newly added UI features.

Deliberate changes: bounded directory authority, exact request guards, consistent symlink/skip policy, byte/result limits, restricted static assets, reader-owned settings placement, namespaced storage and README-first selection. Prototype-shaped tree names now use a null-prototype map; search highlighting escapes text after splitting matches. No new rendering feature is included.
