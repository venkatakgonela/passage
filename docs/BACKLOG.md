# Backlog

- SVG as image-only content, with restrictive CSP, never inline. Keep SVG excluded until its dedicated security tests and serving policy are approved.
- GIF/WebP with small bounded parsers and mutation coverage, or an explicit dependency decision.
- Hard CPU/time isolation for pathological diagram layouts; current source/edge caps are not a wall-clock bound.
- More readable very wide print tables and extremely tall printed diagrams. No print-only column splitting is implemented.
- Footnotes, callout syntax and front-matter metadata UI remain deferred; literal content must remain reachable.
- General navigation history, trail, tabs, split view and search expansion remain separate scope.
