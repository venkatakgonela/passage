# Contributing

Keep changes small, synthetic examples clearly labelled, and source documents read-only. The runtime is Python standard library plus vanilla browser modules and pinned vendor assets; no bundler is required.

Run `make test`, `make lint`, `make test-browser` and `python3 tools/pre-publish-check`. Browser tests need Node 22+, `npm ci --ignore-scripts`, and installed Chrome (`BROWSER_EXECUTABLE` can override its path). They use temporary synthetic workspaces, never personal documents.

Add failure-path and hostile-input tests for security boundaries. Significant decisions need an ADR. Preserve third-party licence/provenance headers. Do not commit settings, personal paths, credentials or real documents. Record limitations rather than hiding failures.

Publication, hosted CI and release tags are separate maintainer actions, not side effects of local verification.

Start with [AGENTS.md](AGENTS.md) for repository engineering rules, regardless of which editor you use. `tools/pre-publish-check` is a local privacy/licence/history check, not a publishing command. Use the issue and pull-request templates, including a synthetic reproducer rather than private documents. [Media generation](docs/media.md) uses dev-only Chrome, Playwright and ffmpeg; it is not part of CI or the reader runtime. Follow the [manual release checklist](docs/RELEASE-CHECKLIST.md) only with maintainer authorization.
