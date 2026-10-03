# Backlog

- Broader screen-reader/platform validation and richer nested footnotes remain follow-ups.
- Reduce empty space around short diagrams without reintroducing asynchronous reading-position jumps, including at narrow widths.
- Cancel or skip stale queued diagram work on navigation. Discarding document completion does not cancel the current serial renderer, and no hard execution timeout is implemented.

- SVG as image-only content, with restrictive CSP, never inline. Keep SVG excluded until its dedicated security tests and serving policy are approved.
- GIF/WebP with small bounded parsers and mutation coverage, or an explicit dependency decision.
- Hard CPU/time isolation for pathological diagram layouts; current source/edge caps are not a wall-clock bound.
- More readable very wide print tables and extremely tall printed diagrams. No print-only column splitting is implemented.
- General YAML and nested footnote Markdown remain deferred; current extensions use bounded minimal grammars.
- Tabs, semantic comparison and cross-device review synchronization remain outside scope.
- Large-workspace catalog indexing and cache/poll efficiency beyond the current capped enumeration.
