# Architecture

## Implemented: newcomer and release assets

The runtime remains Python standard library plus existing vanilla modules/vendor assets. Version 0.1.0 is package metadata and a tested overflow-menu label, not a published tag. The quick start, tutorial and full reference separate introduction from detailed limits. `tools/make-demo` explicitly drives a fresh Chrome context over copied synthetic examples, captures captioned stills and encodes a silent edited tour with installed ffmpeg. These are development-only assets; neither ffmpeg nor Node is needed to run the reader, and media generation is not in CI.

Documentation checks validate links, tutorial steps, version agreement and media signatures/size limits. The media generator asserts no page errors/outbound requests and performs full decodes; visual inspection still checks pixels for private text. The history scanner uses replacement decoding for non-UTF-8 media and retains textual checks without a new media exception. [Media instructions](media.md) record exact encoding commands; Existing source-write and sandbox boundaries are unchanged.

## Implemented: shared reading layout

`reading-layout.js` coalesces document-ready, appearance and article-resize changes into one animation-frame measurement. Existing technical DOM is measured and restored synchronously, without cloning frames or re-running document scripts. Validated diagram viewBox width and image metadata avoid depending on fitted display size. The 1800px container bounds all main-document blocks; measured prose and short blocks align left, while intrinsically wide content spans the container. Image/math-only paragraph wrappers participate in the same rule. `stableChange` preserves the visible reading anchor during reclassification. Compare retains its independent pane sizing.

Appearance normalization preserves valid stored measures, clamps to 60–140, defaults the line limit to 80, and stores a strict Fill boolean in reader-owned browser storage. New/reset/unset Fill is on; saved explicit off is preserved. Maximum line length is exposed only with Fill off. The single `--reading-container-cap` constant in `polish.css` bounds article and wrapper in both normal and Focus modes. `appearance-popover.js` uses a nonmodal anchored dialog, existing controls and explicit outside/Escape dismissal. A reserved narrow bottom strip keeps the menu outside the document viewport. See [layout decision](decisions/0011-shared-reading-edge.md) for alternatives, measurement cost and compatibility effects.

| Invariant / mitigation | Regression evidence |
| --- | --- |
| Default prose fills available container through resizing/panel/Focus changes; unset Fill migrates, explicit off persists, Reset fills | [Fill checks](../tests/fill-browser.mjs): 1200/1440/1715/1920 plus 2560px cap; [normalization tests](../tests/reading.test.js) |
| Heading text and prose/technical boxes share a left edge within 1px; wide blocks reach the right edge | [Polish browser checks](../tests/polish-browser.mjs): 1920/1440/1024, normal/focus, panels open/closed |
| Short code/table/diagram/math remain measured; Fill persists, expands prose and resets | Same browser checks, plus [normalization tests](../tests/reading.test.js) |
| Menu cannot cover visible document content at 390/768; Appearance is nonmodal with keyboard and outside dismissal | Same browser checks |
| Read-only files and isolated diagram authority remain unchanged | [Server tests](../tests/test_server.py), [image tests](../tests/test_images.py), [browser security matrix](../tests/browser.mjs) |

## Implemented: overview

One loopback Python HTTP process serves a static browser application and read-only Markdown APIs. The browser renders sanitized HTML and keeps preferences in localStorage. Reader settings persist registered paths separately from documents. There is no database, hosted service, build pipeline or document-write API.

```mermaid
flowchart LR
  Browser[Browser ES modules] --> HTTP[Loopback HTTP handler]
  HTTP --> Policy[Workspace and path policy]
  Policy --> Documents[Read-only Markdown roots]
  Policy --> Settings[Reader-owned JSON settings]
  HTTP --> Assets[Static web and vendor assets]
```

Caption: implemented component boundaries. Legend: solid arrows are implemented calls; only the settings arrow permits writes.

```mermaid
sequenceDiagram
  participant Browser
  participant Handler
  participant Policy
  participant Filesystem
  Browser->>Handler: GET file with root ID and relative path
  Handler->>Handler: Check Host and supplied Origin
  Handler->>Policy: Resolve registered root and validate path
  Policy->>Filesystem: Bounded read of Markdown
  Filesystem-->>Browser: Markdown through handler
  Browser->>Browser: Parse, sanitize, decorate and render
```

Caption: implemented document request flow. Legend: solid calls and dashed responses describe existing behaviour, not future components.

## Implemented: responsibilities and technology

The [shell](../web/shell.js) composes existing controls into a section rail, reusable panel hosts and an in-document page header. It owns panel visibility, drawer keyboard handling, remembered labels and focus-header geometry; existing modules still own navigation, search, review records and rendering. [Shell CSS](../web/shell.css) provides neutral chrome and responsive layout. [ADR 0010](decisions/0010-reading-shell.md) records alternatives and compatibility changes.

```mermaid
flowchart LR
  Rail[Section rail or drawer tabs] --> Panel[Shared panel host]
  Panel --> Files[Tree and content search]
  Panel --> Reviews[Existing review records]
  Page[In-document actions] --> Menus[Keyboard menus and palette]
  Page --> Reading[Sanitized document]
  Outline[Tabbed page tools] --> Reviews
```

Caption: implemented shell composition. Legend: solid arrows are existing UI calls; no source-write route is introduced.

| Behavior / boundary | Regression evidence |
| --- | --- |
| Six-width chrome, compact rows, one filter, menu keys, panel access and roving tree focus | [chrome browser tests](../tests/chrome-browser.mjs) |
| Focus hides side chrome; overlay does not move the heading; focused actions stay on screen | Chrome browser tests, existing anchor/refresh browser assertions |
| Browse eligibility uses registration policy and retains Host/Origin/Fetch Metadata checks | [shell policy tests](../tests/test_shell.py) |
| Currency inline helper suppression and overflow-only display hints | [release browser tests](../tests/release-browser.mjs) |
| Public images use isolated state and exclude attack fixtures/stale controls | `publicScreenshots` in chrome browser tests |

| Component | Responsibility / choice | Trade-off |
| --- | --- | --- |
| [HTTP](../server/http.py) | stdlib HTTP routing, exact request guards, explicit static MIME types | Suitable for a trusted local reader, not a production Internet server |
| [Policy](../server/policy.py) | canonical boundaries, caps, root state and settings | Path resolution is not race-proof against a malicious local filesystem actor |
| [Entry point](../server/__main__.py) | CLI roots/port and environment-selected settings | A startup root is an intentional filesystem capability |
| [State](../web/state.js), [workspace](../web/workspace.js) | browser preference storage and picker lifecycle | No shared account or synchronization |
| [Tree](../web/tree.js), [search](../web/search.js) | natural/modified sorting, folder rendering and bounded scoped search | No persistent search index |
| [Rendering](../web/rendering.js), [paths](../web/paths.js) | marked, DOMPurify, highlight.js and local link/slug handling | Preserved renderer limitations and pinned older vendor versions |
| [Navigation](../web/navigation.js), [theme](../web/theme.js) | keyboard, hash navigation, theme, font, print | Position restoration after edits is best-effort |
| [Configuration](../web/config.js) | one display-name/storage-prefix source | Documentation titles remain static text |
| [Tests](../tests/test_server.py) | unittest and node:test without dependencies | Real-browser layout and clipboard/print behaviour require browser verification |

## Implemented: threat model

### Shared path and response-header boundaries

`policy.confined_target` is the shared validation boundary for static assets, Markdown targets and review anchors. It rejects absolute paths, traversal components and caller-specified skipped directories; checks the normalized joined path against the canonical root plus a separator before inspecting candidate components; rejects symlink components (including in-root and dangling links); then checks the canonical path against the same separator-aware boundary. Root equality is rejected. Markdown and static suffix whitelists, bounded document reads and safe missing review anchors remain caller policies. Static vendor assets deliberately do not use the document skipped-directory list. The explicit normalized prefix checks replace duplicated custom containment checks, not the protections themselves. Descriptor-relative opening was not introduced: malicious concurrent local filesystem replacement remains outside the trusted-local threat model.

All response header values pass through `Handler.send_header`, which rejects CR or LF before the standard-library writer receives the value. Rejection discards buffered, unsent response headers so error handling cannot append a second status line to a partial success response. This applies to inherited Server/Date headers as well as Content-Type and future headers.

| Boundary | Regression evidence |
| --- | --- |
| Reject traversal/absolute/skipped components before candidate probes; separator-aware lexical and canonical confinement; reject root itself | `ConfinedPathTests.test_relative_rules_before_filesystem_probes`, `test_lexical_boundary_before_component_probes`, `test_canonical_separator_boundary`, `test_root_separator_and_safe_missing_targets` in [boundary tests](../tests/test_path_headers.py) |
| Reject symlink components while preserving normal static and vendor assets, and safe missing anchors | `test_symlink_components_even_when_target_is_inside`, `test_anchor_lists_and_notes_share_confinement`, `test_static_assets_and_symlinks` in [boundary tests](../tests/test_path_headers.py); existing server/review confinement tests |
| Reject CR/LF in every header value without sending buffered success or injected headers | `HeaderSinkTests` and `StaticBoundaryTests.test_bad_mime_returns_clean_error_response` in [boundary tests](../tests/test_path_headers.py) |

CodeQL supplements these executable regressions; passing tests do not establish that a hosted analysis recognizes a validation barrier or certify the absence of vulnerabilities.

Default startup resolves user-scoped settings and performs a non-overwriting legacy copy before constructing the workspace. Explicit overrides bypass copying. [ADR 0009](decisions/0009-user-settings.md) records location compatibility and migration limits; [settings](../server/settings.py) uses streamed temporary copies and exclusive hard links. Settings stay outside registered document roots. The browser's [dialog helper](../web/dialogs.js) uses the existing modal lifecycle and text-only action status, with no new rendering injection path.

| Invariant / behavior | Regression evidence |
| --- | --- |
| Default outside checkout; refuse roots enclosing settings; preserve originals and existing targets; copy once | `test_default_location_and_one_time_non_destructive_migration`, `test_xdg_override_existing_destination_and_symlinks` in [settings tests](../tests/test_settings.py) |
| Failed copy leaves no partial target or completion marker and can retry | `test_failed_migration_preserves_source_and_can_retry` |
| Truncated search deterministic under changed enumeration, including entry cap | `test_search_truncated_results_stable_under_changed_enumeration` |
| Non-corruption reset errors never move files | `test_reset_rethrows_non_corruption_from_load_without_moving` |
| Currency/code stay literal; mixed inline and display equations work | [extension tests](../tests/extensions.test.js), [release browser tests](../tests/release-browser.mjs) |
| No native alerts/confirms; cancellation, trapped Tab, restored focus and action errors | Extension source scan and [dialog browser tests](../tests/dialog-browser.mjs) |

Assets: displayed Markdown contents, local directory metadata, reader settings and browser execution context. Actors: the local user, a remote site attempting cross-origin/rebinding requests, malicious Markdown, and local processes. Trust boundaries: HTTP request to handler, root-relative path to filesystem, Markdown to DOM, and reader-owned settings to source documents.

| Invariant / mitigation | Regression evidence |
| --- | --- |
| Bind only to IPv4 loopback | `ServerTests.test_loopback_binding` in [server tests](../tests/test_server.py) |
| Reject unapproved Host and supplied Origin; require Origin for writes | `test_host_and_origin_matrix`, `test_duplicate_headers_rejected` |
| Reject absolute/traversing paths and non-public static files | `test_paths_and_static_boundary` |
| Reject symlink and skipped-folder reads consistently | `test_symlink_and_skipped_paths` |
| Bound Markdown and request-body reads, results and browse listings | `test_file_size_boundary_and_search`, `test_bad_request_bodies`, `test_search_and_file_caps`, `test_browse_and_registration_boundaries` |
| Enforce resolved home/startup boundaries; saved state cannot expand them | `test_browse_and_registration_boundaries`, `test_persistence_cannot_expand_boundaries` |
| Never write displayed source documents | `test_documents_remain_unchanged` |
| Treat prototype-shaped names as data; escape search output | [logic tests](../tests/logic.test.js): prototype and highlighting cases |
| Namespace preferences and tolerate inaccessible browser storage | [logic tests](../tests/logic.test.js): storage case |

Markdown sanitization occurs immediately before DOM insertion. Browser checks exercise hostile synthetic markup; this is not a proof against all sanitizer bypasses. Remote/data images retain the existing treatment; remote images can disclose network metadata. Local PNG/JPEG references use the bounded image routes described below.

Residual risks: broad home enumeration by a trusted same-origin client, concurrent filesystem replacement between validation and open, concurrent settings mutations, slow/large directory traversal, and up to 5,000 bounded file reads per search. Caps limit returned counts and individual bytes, not total execution time or memory in directory enumeration. The HTTP server is not hardened for exposure beyond loopback. Local processes can impersonate HTTP headers and are outside the remote-site protection model.

## Implemented: reading and media

The editorial tokens in `web/styles.css` define surfaces, text, essential control boundaries and focus independently. `appearance.js` validates/persists reading preferences. `layout.js` preserves visible anchors around synchronous geometry changes; image frames reserve height before async loads. `media.js` handles validated local raster metadata and enlargement. `diagrams.js` lazy-loads the pinned renderer and places its generated output in an opaque-origin, no-permissions frame. See [image ADR](decisions/0002-raster-image-boundary.md) and [diagram ADR](decisions/0003-isolated-diagrams.md).

GET `/api/image` and `/api/image-info` are the new read-only routes. Both share type/signature/size/dimension/confinement checks in `server/images.py`; Host, Origin, Fetch Metadata and nosniff remain centralized. `ImageTests` pins these boundaries and image immutability. The browser suite pins real scroll containment, heading clearance, isolated diagram output, error/source states, image enlargement, native fragment history, focus/drawers and measured theme contrasts. `reading.test.js` pins input limits, preference validation and fragment encoding.

Image contract tests in `tests/test_images.py` separately enforce `test_png_trailing_bytes_rejected`, `test_png_without_idat_rejected`, `test_jpeg_without_end_marker_rejected`, `test_png_response_mime_and_bytes`, `test_jpeg_response_mime_and_bytes` and `test_image_info_returns_metadata_json`. Malformed cases exercise both routes, while successful metadata is decoded and compared with known dimensions/type. Header checks are still not full image decoding.

The diagram policy recognizes newline/semicolon statement boundaries outside quoted or bracketed labels, skips ordinary comments, and distinguishes sequence message text from commands. It rejects leading front matter, configuration directives, click/link/style statements and image/icon resource attributes without globally banning ordinary words or URLs. Node tests cover indented directives, semicolon directives and directive-like node names; the browser asserts those same accepted architecture fixtures reach ready frames, including a hostile label whose active markup is stripped and surrounding text remains. Frame permissions and CSP are unchanged.

This small scanner is not the Mermaid grammar: it tracks double-quoted strings and bracket depth, distinguishing ER cardinality braces from attribute groups and rejecting unfinished quotes/groups. Tests cover ER relationships in both directions, attributes and later prohibited styles. Unquoted pipe-delimited edge labels containing statement separators may still be treated as statements; unusual syntax should be quoted or reported for a targeted regression. Filter acceptance does not guarantee parser acceptance. The sandbox/CSP, not the filter, isolates output. Renderer work still executes in the parent; stale document completion is discarded but queued/in-progress diagram work is not cancelled (see backlog). No hard CPU/time isolation is claimed.

## Implemented: orientation and continuity

`server/catalog.py` provides paged stat/title metadata, reusing `policy.markdown_target` with exact request guards. `/api/files` remains compatible. `CatalogTests` enforces Host/Origin/Fetch Metadata/nosniff, symlink/skipped-path/confinement, title prefix, size/page/file caps, cache invalidation and source immutability. The catalog is read-only and cache-bounded; see [decision 0004](decisions/0004-bounded-catalog.md).

`orientation.js` and the existing tree/workspace modules implement menus, breadcrumbs, filters and panel sizing. `continuity-model.js` owns pure ordering/filter/fuzzy/storage/position logic; `session.js` persists validated per-workspace records; `continuity.js` integrates browser history, trail, quick open and visibility-gated polling. `reading-tools.js` creates sanitized inert section previews and reversible text-node find marks. [Decision 0005](decisions/0005-reader-continuity.md) records alternatives and fallback limitations.

```mermaid
flowchart LR
  Catalog[Bounded read-only catalog] --> Tree[Workspace tree and quick open]
  Reader[Sanitized document] --> Position[Heading and snippet positions]
  Position --> History[Browser history and local workspace records]
  Reader --> Peek[Sanitized resource-free section preview]
```

Caption: implemented orientation and navigation data flow. Legend: arrows are in-memory/read-only transfers; only browser storage records change, never source documents.

Pure model tests pin natural sort, filter paths, fuzzy caps, validated storage, bounded trail and position fallback order. The browser suite preserves the original 66-case rendering matrix and exercises six theme/viewport configurations for keyboard menus/tree/reveal, breadcrumbs, quick open, trail return, section Peek, find, reload, modified synthetic files and missing-file fallback. Tests copy examples to an OS temporary root before changing them. Controls reuse measured contrast/focus tokens. No operating-system launching or new HTML execution boundary is added.

Print is native browser printing, not an export feature. Wide tables wrap at 6pt with repeated headers; 12-column print readability remains a stated limitation. Large diagrams fit a bounded frame and may have tiny labels. See [rendering checklist](known-rendering-issues.md).

## Implemented: search and review records

Search scans sorted eligible paths up to 5,000 files, 10,000 directory entries and 16 MiB per query; file reads retain the 2 MiB cap and results the 60-hit cap. These are work bounds, not a wall-clock guarantee for a stalled filesystem. AND terms, literal phrases, case and word options compile escaped patterns. Filename matches rank before occurrence count then path. Truncation makes partial ranking explicit. Legacy search returns an array; `format=details` adds `hits`, `truncated`, `scanned` and enumerated eligible `total`. Chain reads 16 KiB heads of at most 20 siblings after capped file enumeration; its family and small related-list parser never grants filesystem authority.

`reviews.py` validates versioned whole-record replacements, registered roots and safe Markdown anchor paths, including missing paths. Settings names are fixed from a validated root ID. Strict shapes, string/count/body caps and exact-origin writes protect the new persistence boundary. One process-wide lock plus expected revision prevents lost updates. Temporary-file flush/fsync and atomic replacement preserve the previous file on failure. Multiple server processes and hostile local filesystem races remain unsupported. See [storage decision](decisions/0006-review-storage.md).

`renderArticle` shares sanitation, heading/table/code decoration, safe image routes and isolated diagram output between main reading and Compare. Compare interpolates common heading geometry and uses proportional fallback, with stacked panes on narrow screens. `review-model.js` implements matching, ordering, anchor fallback and text export; `reviews.js` integrates local notes/lists. Off-document note anchors are checked when that document is opened; missing documents and current-document orphan anchors remain listed. See [alignment decision](decisions/0007-heading-aligned-compare.md).

```mermaid
sequenceDiagram
  participant Browser
  participant Handler
  participant Reviews
  participant Settings
  Browser->>Handler: POST bounded records with expected revision
  Handler->>Handler: Host, exact Origin and Fetch Metadata checks
  Handler->>Reviews: Validate registered root, schema and anchors
  Reviews->>Reviews: Lock and compare persisted revision
  Reviews->>Settings: Write temporary file, flush, replace
  Settings-->>Browser: New revision or failure through handler
```

Caption: implemented review-state write flow. Legend: solid calls and dashed responses; no operation targets source documents.

| Invariant / mitigation | Regression evidence |
| --- | --- |
| Catalog truncates titles, skips bad entries, avoids uncached content reads when titles disabled, and locks shared cache | Four focused tests in [catalog tests](../tests/test_catalog.py) |
| Review writes require exact Host/Origin and same-origin supplied Fetch Metadata | `test_write_guards` in [review/search tests](../tests/test_review_search.py) |
| Strict bounded records, traversal/symlink/canonical confinement and fixed settings location | `test_schema_limits_and_confinement`, `test_settings_location_and_canonical_confinement` |
| Concurrent stale writers cannot overwrite accepted revisions; failed replacement rolls back | `test_atomic_failure_and_concurrent_revision_conflict` |
| Accepted/rejected list and note operations do not modify Markdown bytes | `write` helper and `test_review_roundtrip_missing_and_immutable_operations` |
| Scoped query semantics, ranking, file/entry/byte/hit budgets | `test_search_semantics_scopes_ranking_and_budgets` |
| Chain family/related grammar and bounded head reads | `test_chain_pure_rules_head_limit_and_route` |
| Heading alignment, immutable list reordering, heading/snippet/offset fallbacks and inert export | [pure review tests](../tests/review.test.js) |
| Search survival, Chain visit, full Compare frames/overflow, keyboard reorder, note export/orphaning | [review browser checks](../tests/review-browser.mjs), plus unchanged original matrix and orientation checks |

## Planned / rejected follow-ups

GET requests explicitly marked `Sec-Fetch-Site: cross-site` are rejected as defence in depth (`test_fetch_metadata`). Missing metadata remains valid for local clients. `same-site` can include unrelated applications on other localhost ports, so Host and Origin remain the primary guards, not Fetch Metadata. Static suffix filtering, nosniff responses and failed-settings-save rollback are pinned by `test_static_suffix_whitelist`, `test_nosniff_responses` and `test_settings_save_failure_rolls_back_registration`.

SVG/GIF/WebP, rich nested footnotes/general YAML and stronger layout CPU isolation remain deferred. A framework, bundler, database and document editing remain rejected for this scope. No future component is shown as implemented in the diagrams.

## Implemented: rendering, recovery and release preparation

`extensions.js` implements bounded front matter, plain-text footnotes and callouts, and lazy MathML-only KaTeX 0.19.0. Both generated Markdown HTML and math output pass DOMPurify. No remote fonts, stylesheet dependencies, trusted commands or static suffix expansion are added. Invalid expressions remain source. `export.js` applies a stricter sanitizer, drops active elements and remote resources, embeds eligible bounded local raster images and trusted CSS, and creates a client download with restrictive CSP. Opaque diagram frames become honest source placeholders. [Decision 0008](decisions/0008-safe-math-and-export.md) records alternatives and trade-offs.

```mermaid
flowchart LR
  Source[Read-only Markdown] --> Extensions[Bounded syntax preparation]
  Extensions --> Sanitize[DOMPurify]
  Math[Lazy native math output] --> Sanitize
  Sanitize --> Reader[Safe article]
  Reader --> Export[Stricter export sanitizer]
  Export --> Download[Inert browser download]
```

Caption: implemented rendering/export flow. Legend: solid arrows are existing processing; no source write is present.

| Invariant / behavior | Regression evidence |
| --- | --- |
| Late sorted search coverage, actual byte limit, whole word/scope semantics | `test_search_late_hit_and_deterministic_total`, `test_search_options_and_actual_byte_boundary` in [release tests](../tests/test_release.py) |
| Version/list count and relative Chain resolution/cap | `test_review_version_and_list_cap`, `test_related_folder_and_chain_limit` |
| Corrupt reset preserves backup, refuses valid/unsafe state and enforces write guards | `test_corrupt_reset_guards_rollback_and_source_immutability` |
| Protected code, bounded metadata, footnote escaping and reference destinations | [extension unit tests](../tests/extensions.test.js) |
| No math load for prose, valid MathML, hostile metadata/math/details/footnotes inert, overflow retained | [browser matrix](../tests/browser.mjs), [release interactions](../tests/release-browser.mjs) |
| Export lacks active elements, embeds CSP, provides diagram placeholder and actual download | [release interactions](../tests/release-browser.mjs) |
| Server failure explains recovery and Retry works; palette and backlinks keyboard reachable | [release interactions](../tests/release-browser.mjs) |
| Release scanner rejects sample private paths, credentials and personal mailboxes | [scanner tests](../tests/prepublish.test.js) |

Corrupt review recovery is an explicit POST with an empty schema under the existing write guards. It moves only the fixed root-ID settings file to a random sibling backup while holding the review lock; GET never performs recovery. Failed rename retains original bytes; valid settings refuse reset. Backup files stay outside documents. This is not an automated retention/backup system.

Recovery UI covers failed initial workspace loading, document requests, render exceptions and browser-storage writes. Media/math retain source/alt failures. Commands enumerates reader controls and delegates File/View/Navigate submenus; not every context-specific media action has a direct shortcut. Accessibility verification is keyboard/landmark/label/contrast/reduced-motion testing in installed Chrome, not assistive-technology certification. `tools/pre-publish-check` scans tracked content and reachable history with explicit vendor exceptions and invokes documentation checks; local verification is not a hosted CI run.
