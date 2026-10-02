# 0004: Bounded document metadata

Status: Accepted

Recorded: 2026-10-03.

## Context

Sorting, titles and refresh need filesystem metadata without reading every full document on each UI render.

## Decision drivers

Preserve existing request and file authority, bound work, retain the filename-list API, and add no runtime dependency.

## Options considered

1. Fetch all documents in the browser: simple but transfers and parses too much content. Rejected.
2. Add a paged metadata API with bounded title-prefix caching: modest server code, incremental network requests and explicit limits. Selected.
3. Database or watcher index: efficient at larger scale but adds lifecycle/dependency complexity. Deferred.

## Decision

Keep `/api/files` unchanged. `/api/catalog` returns at most 100 entries per page from the existing 5,000-file enumeration; `/api/metadata` resolves a single guarded relative path. Reuse Markdown target validation, symlink/skipped-path/containment checks and 2 MiB eligibility limit. Titles inspect at most 16 KiB: scalar front-matter title, first H1, then filename. Cache at most 1,000 titles by root/path/mtime/size. Cached values never bypass path validation.

The browser obtains title pages when loading a workspace, then polls stat metadata every four seconds while visible without overlapping polls. Changed lists trigger title metadata refresh. Documents over the read limit are not returned by the catalog. The older `/api/files` contract still enumerates them.

## Consequences

Warm UI renders do not reread document contents. Large roots still incur capped enumeration/stat work, repeated for each page, and more than 1,000 title entries can churn the cache. This is not a scalable filesystem index. Title changes beyond the prefix are not recognized; no general YAML parser is included. Stat timestamps are best-effort change detection, not content hashes. Existing filesystem race limitations remain.

## Revisit when

Large workspaces make polling costly, title syntax needs expand, or descriptor-based filesystem protection is required.

## Sources

[Catalog](../../server/catalog.py), [shared policy](../../server/policy.py), [tests](../../tests/test_catalog.py).
