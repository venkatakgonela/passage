# Changelog

## Fill-first reading

- New, unset and reset appearance preferences fill the reading area by default, in normal and Focus modes. Saved explicit Fill off/on choices remain respected.
- Maximum line length (60–140, default 80) is shown only when Fill window is off. One shared 1800px cap bounds the centred reading container on ultrawide screens.
- Added responsive default/persistence/reset checks and refreshed clean-guide screenshots; other reading and security behavior is unchanged.

## Shared reading edge and visual polish

- Centred 1400px reading container with one left edge, measured prose and intrinsic short/wide technical blocks; heading anchors no longer indent heading text.
- Reading width 60–140/default 80, remembered Fill window, live appearance values and nonmodal anchored keyboard controls with focus restoration.
- Safe narrow-screen menu strip, compact hidden-on-narrow hint, icon Peek, full-title tree tooltips and 280px default panel.
- Added geometry/persistence/dismissal browser checks and refreshed synthetic guide screenshots. Existing sandbox and read-only boundaries are unchanged.

- Replace stacked toolbars with a full-height section rail, compact resizable Files/Search/Lists/Notes panel, in-document action header and tabbed page tools.
- Add remembered rail labels, a dismissible shortcut hint, keyboard menus and roving tree focus; use drawers below 1024px and an outline drawer below 1280px.
- Make Focus return the window to reading, with a non-shifting revealable header and Escape exit; centre 68-character text with wider technical blocks.
- Show equation helper text only for overflowing display math. Generate clean synthetic screenshots from isolated browser contexts.
- Expose folder registration eligibility through the existing guarded browse response and disable invalid Add actions with an explanation.

- Keep currency amounts literal while rendering properly delimited inline and display math.
- Move default reader settings outside the checkout, retaining legacy files in a non-overwriting one-time migration; preserve explicit settings overrides.
- Replace native alert/confirmation boxes with keyboard-accessible in-page confirmations and action-local errors.
- Pin truncated-search ordering and non-corruption reset refusal with adversarial tests; refresh full-window synthetic screenshots.

## Unreleased

## 0.1.0 — release preparation (not published)

- Restore sorted search through 5,000 files with scanned/total counts and explicit byte/hit truncation.
- Add guarded corrupt-review recovery that retains original settings bytes.
- Add lazy sanitized math, footnotes/backlinks, callouts, metadata/details panels, heading/reference copy and inert HTML download.
- Add command discovery, error recovery, synthetic demo images and local publication checks. No release tag or hosted publication is created.

- Add bounded scoped phrase/case/whole-word search with retained results and explicit truncation.
- Add workflow document chains, full-rendering heading-aligned Compare and narrow stacked panes.
- Add ordered reading lists and anchored local review notes with selected-note Markdown export.
- Persist bounded review settings with exact-origin writes, revision conflicts and atomic replacement; sources stay immutable.
- Serialize the title cache and pin title truncation, bad-entry skipping and filename-only catalog reads.

- Preserve ER cardinality/attribute policy checks and reject unterminated diagram strings/groups.
- Add bounded metadata/title APIs, natural/modified sorting, labelled workspace tree, resizable panels and folder breadcrumbs.
- Add quick open, position history, link-return trail, section Peek, document find, workspace recents/pins/session restore and visible-tab refresh.
- Keep source documents read-only; operating-system editor/file-manager actions remain unavailable.

- Accept ordinary diagram labels containing directive-like words and URL text while still refusing configuration, link/resource and style statements.
- Pin image structure, exact PNG/JPEG MIME types and metadata JSON with focused regression tests; verify accepted and hostile labels in the browser.

- Add the calm editorial visual system, light/dark/auto, serif/sans, reading measure, focus and appearance reset.
- Render locally vendored Mermaid lazily with isolated output and zoom/pan/source/fullscreen controls.
- Serve bounded PNG/JPEG workspace images with alt failures and keyboard enlargement; SVG remains excluded.
- Contain tables/code, wrap long text, preserve native heading history and provide narrow keyboard drawers.
- Add real-browser overflow/interaction/contrast checks and A4/Letter print evidence; very wide tables remain small in print.

- Reject GET requests explicitly marked cross-site while retaining Host and Origin protection.
- Add regression coverage for static suffix filtering, nosniff responses and settings-save rollback.

## 0.1.0 — 2026-10-02

- Established modular server and browser code with a dependency-free local test command and synthetic examples.
- Restricted directory browsing and registration to resolved home plus startup-authorized roots; persisted settings cannot authorize outside roots on later launches.
- Enforced exact Host/Origin checks across methods, document path/symlink/skipped-folder policy, narrow static serving and byte/result limits.
- Isolated reader settings from displayed roots and namespaced browser preferences; initial selection prefers README, then the first file.
- Protected tree construction from prototype-shaped directory names and kept search highlighting separate from HTML escaping.
- Documented existing rendering limitations without redesigning or adding rendering features.
