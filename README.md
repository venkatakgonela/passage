# Passage

A local, read-only Markdown reader for folders of technical documents. No account, build step or runtime package installation is required.

## Run

Requires Python 3.9 or later. Node 22 or later is needed only for tests and syntax checks.

```sh
make run
make run ARGS="--root /path/to/documents --port 8765"
```

Open `http://127.0.0.1:8765`. With no root argument the reader opens the bundled [synthetic examples](examples/README.md). Repeat `--root` for multiple startup folders. The server binds only to the IPv4 loopback address.

## Existing features

- Folder selection, in-page folder picker, removal from the reader without deleting documents, and persisted root selection.
- Collapsible folders, folders-first alphabetical tree, ancestor reveal and current-file highlight.
- Case-insensitive full-text/path search with snippets and up to 60 results. Queries need two characters.
- Relative Markdown links, heading fragments, duplicate-safe heading identifiers, heading navigation and a scroll-aware table of contents on wide screens.
- Tables with horizontal scrolling, highlighted code with copy buttons, disabled task checkboxes, and print styling.
- Auto/light/dark theme, text sizing from 13 to 24 pixels, breadcrumb and reading-time metadata.

Local images remain placeholders; Mermaid remains code. Footnotes, callouts and front matter do not have dedicated rendering. Long content can overflow. See the [verified feature audit](docs/feature-audit.md) and [rendering checklist](docs/known-rendering-issues.md). This is not an editor, a hardened filesystem sandbox or an offline network firewall: rendered remote images may contact external servers.

## Safety and settings

The picker and root registration are limited to the resolved home directory plus folders explicitly supplied at startup. Outside-home folders must be supplied again at each launch; saved settings cannot expand that boundary. Hidden/skipped picker entries and symlink entries are excluded. Home browsing remains broad: any same-origin user of the reader can enumerate allowed folders. Use only on a trusted local machine.

Document access rejects absolute paths, parent traversal, symlinks, skipped directories and non-`.md` files. Uppercase `.MD` files are not enumerated. Reads are capped at 2 MiB, searches at 60 returned hits, enumeration at 5,000 Markdown files, folder listings at 1,000 entries, and registration bodies at 16 KiB. Oversized files are rejected on direct read and skipped in search. These output caps do not bound all filesystem traversal cost.

Host checks apply to every method. A supplied Origin must match a permitted local origin; POST/DELETE also require it. Ordinary GET navigation without Origin is allowed. The server serves only intended web/vendor assets, not arbitrary repository files. Markdown HTML passes through DOMPurify before insertion; retained dependency versions are documented, not represented as the newest or immune to vulnerabilities.

Reader-owned root settings live in ignored `.state/roots.json` by default. To move them, set `READER_SETTINGS` to a JSON-file path **outside all displayed document roots**. A folder containing that settings file cannot be registered. This means selecting the entire checkout with default settings is rejected; put settings outside it first. The read-only guarantee covers displayed documents, not reader settings. Browser preferences use an application prefix; previous unprefixed preferences are not imported.

## Keyboard

`/` focuses search and reveals the sidebar; Escape clears focused search; `b` toggles the sidebar when not typing. Heading clicks scroll but do not save section positions in browser history. The print button opens the browser print dialog.

## Development

```sh
make test
make lint
```

`make test` runs stdlib Python HTTP/filesystem/documentation tests and dependency-free Node logic tests. `make lint` checks Python and JavaScript syntax; it is not a comprehensive style or type checker. HTTP tests require local loopback sockets. CI declares the same commands, but remote execution is separate from local verification.

[Architecture and threat model](docs/ARCHITECTURE.md) · [Decisions](docs/decisions/README.md) · [Changelog](CHANGELOG.md) · [Third-party notices](THIRD-PARTY-NOTICES.md) · [Licence](LICENSE)
