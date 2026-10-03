# Passage documentation index

Passage is a local, read-only Markdown reader for technical document sets. This page orders the project's documents so you can find the right one quickly. All example content is synthetic.

## Start here

1. [README](../README.md): what Passage is, a 60-second quick start and safety summary. Continue with the [ten-minute tutorial](getting-started.md), [captioned demo](media/passage-demo.mp4) and [full reference / keyboard map](reference.md).
2. [Examples](../examples/README.md): a synthetic task, standard, plan, architecture note, report and review you can open in the reader to see every feature.

## Understand how it works

3. [Architecture](ARCHITECTURE.md): components, request flows, limits, and the threat model with the test that guards each protection.
4. [Decision index](decisions/README.md): why it is built this way. Read these in order when you need the reasoning:
   - [0001 Folder authority](decisions/0001-folder-authority.md): which folders the reader may show.
   - [0002 Raster image boundary](decisions/0002-raster-image-boundary.md): which images are served and how.
   - [0003 Isolated diagrams](decisions/0003-isolated-diagrams.md): how Mermaid output is sandboxed.
   - [0004 Bounded catalog](decisions/0004-bounded-catalog.md): titles, sorting and metadata limits.
   - [0005 Reader continuity](decisions/0005-reader-continuity.md): history, trail and position restore.
   - [0006 Review storage](decisions/0006-review-storage.md): where notes and reading lists live.
   - [0007 Heading-aligned compare](decisions/0007-heading-aligned-compare.md): how two documents line up.
   - [0008 Safe math and export](decisions/0008-safe-math-and-export.md): math rendering and HTML export.
   - [0009 User-scoped settings](decisions/0009-user-settings.md): default location, legacy migration and confirmation behavior.
   - [0010 Reading-first shell](decisions/0010-reading-shell.md): section rail, shared panels and focus geometry.
   - [0011 Shared reading edge](decisions/0011-shared-reading-edge.md): intrinsic block widths and the fill-first addendum.

## What works, what does not

5. [Feature audit](feature-audit.md): present, partial and missing features.
6. [Known rendering issues](known-rendering-issues.md): the baseline defects and their current status.
7. [Backlog](BACKLOG.md): deferred work and open risks.

## Using, changing and releasing it

8. [Security policy](../SECURITY.md): the local-only threat model and how to report a problem.
9. [Contributing](../CONTRIBUTING.md): engineering rules and checks.
10. [Changelog](../CHANGELOG.md) and [third-party notices](../THIRD-PARTY-NOTICES.md): what changed and which libraries are bundled.

11. [Media regeneration](media.md) and [0.1.1](release-notes-0.1.1.md) and [0.1.0](release-notes-0.1.0.md) release notes: maintain the demo assets and see what each release contains.
