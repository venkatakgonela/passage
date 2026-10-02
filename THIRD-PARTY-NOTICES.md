# Third-party notices

## Mermaid 12.1.0

Vendored `vendor/mermaid.min.js`, MIT; [licence](vendor/mermaid-LICENSE.txt). Retrieved from the official npm package. The archive integrity is `sha512-wlVCp+8eTupfCeeFvoZNNiTuHrvag0P2jz/ILgb/f/6jkVokUefOcujefi8qUe/j2asHiSePncVsz/xzzA80LQ==`. The extracted JS SHA-512 is `32bd67f9b79c5870bf95ea89e7e5cdf27e1b0469382451a276d04ab6ff77ffcc1c4b68db5cc18378134c1c751d4437aa0343843b0f26e6ccecb3e095e9c9428d`. Archive integrity and file hash refer to different objects. Sources: `https://registry.npmjs.org/mermaid/12.1.0` and its declared tarball. The 5,493,176-byte standalone browser build loads only for diagrams; the server does not gzip it. The full package is not shipped.

Development only: playwright-core 1.63.0, Apache-2.0, installed via the lockfile; no browser is bundled or downloaded by the test command.

These vendored distributions retain their original copyright, licence and provenance headers verbatim. Upstream contact addresses and product names in those headers are upstream metadata, not first-party inspiration or design claims.

| Component | Version | Assets | Licence |
| --- | --- | --- | --- |
| marked | 12.0.2 | `vendor/marked.min.js` | [MIT](vendor/marked-LICENSE.txt) |
| DOMPurify | 3.1.6 | `vendor/purify.min.js` | [Apache-2.0 OR MPL-2.0](vendor/purify-LICENSE.txt) |
| highlight.js | 11.10.0 | `vendor/highlight.min.js`, `vendor/hl-light.css`, `vendor/hl-dark.css` | [BSD-3-Clause](vendor/highlight-LICENSE.txt) |

Versions are read from the supplied script headers. Theme provenance remains in each CSS header; the precise theme distribution version is not independently encoded there. No claim is made that these are the latest versions. Library upgrades require a separate compatibility and advisory review.

Exact-version licence sources:
- https://raw.githubusercontent.com/markedjs/marked/v12.0.2/LICENSE.md
- https://raw.githubusercontent.com/cure53/DOMPurify/3.1.6/LICENSE
- https://raw.githubusercontent.com/highlightjs/highlight.js/11.10.0/LICENSE
