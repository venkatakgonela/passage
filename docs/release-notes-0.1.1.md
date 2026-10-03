# Passage 0.1.1 — 2026-10-03

A security hardening and maintenance release. Upgrading is recommended; nothing about how you use Passage changes.

- Request paths for static files, Markdown documents and review anchors now pass through one audited confinement check (canonical root plus separator test, no symlink components, no traversal), instead of three separate ones.
- Response headers can no longer contain CR or LF, and the Content-Type is selected from a fixed list of the types the server actually sends.
- These changes resolve eight findings reported by automated code scanning. No exploit against 0.1.0 was demonstrated; the checks that existed already covered the reported inputs, and the new helper and tests make them harder to regress.
- GitHub Actions are pinned by commit and updated; secret scanning, dependency updates and code scanning are enabled.

How to update: pull the latest `main` (or download the 0.1.1 ZIP) and restart the reader. Your settings are untouched.

Trusted-local use only, as before; see the [security policy](../SECURITY.md).
