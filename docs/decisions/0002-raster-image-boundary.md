# 0002: Raster image boundary

Status: Accepted

Recorded: 2026-10-02.

## Context

Local Markdown image references need rendering without exposing arbitrary workspace files or executing active vector content. The server must remain standard-library only. Images can consume significant decoder memory even when their compressed files are small.

## Decision drivers

Reuse the document authority boundary; validate before returning metadata or bytes; bound encoded size and dimensions; preserve source immutability; keep the first implementation auditable.

## Options considered

1. PNG/JPEG only: small explicit allowlist, bounded header parsing and no active vector payloads. Fewer formats, and header validation is not a full decoder. Selected.
2. Raster plus restricted SVG: valuable for architecture documents, but requires an additional active-content serving policy and tests. Deferred rather than sanitized with ad-hoc string filtering.
3. Broad image library: more formats and thorough decoding, but adds a runtime dependency and decoder surface outside the current scope. Rejected here.

## Decision

`/api/image` and `/api/image-info` share the same root/path/type/size parser. Accept PNG and baseline/progressive JPEG, matching extension and signature. PNG checks bounded chunk structure and CRC, required data/end chunks and dimensions. JPEG scans at most 64 KiB of segment headers for supported size markers and requires start/end markers. Reject files above 8 MiB, dimensions above 8,192 pixels or 16 million pixels total, zero dimensions, malformed or unsupported headers. Browser decode failures show alt text; header validation is explicitly not full decoding.

Reuse exact Host/Origin checks, cross-site GET rejection and nosniff. Paths must be root-relative, without traversal, skipped components or symlink components; canonical containment is checked before reading. Both metadata and image bytes use identical validation. No image upload/write API exists. GIF and WebP are not included.

Reserve a 420px image frame before asynchronous metadata/data loads; fit the image inside it and offer keyboard-accessible enlargement. The resulting blank space for a small or failed image is a deliberate stability trade-off. No remote-image proxy is introduced.

## Consequences

PNG/JPEG references render locally; SVG, GIF, WebP, malformed and missing images show readable failures. Symlinked images are refused even when their resolved targets are inside the root. Large compressed/decompressed dimensions are bounded, but browser decoders remain part of the trusted platform. Existing local filesystem race limitations still apply.

SVG is the most requested missing type for architecture documents in the current requirements. The follow-up path is to serve SVG only as an `<img>` resource, never inline, with `Content-Security-Policy: sandbox; default-src 'none'`, exact MIME/nosniff and the same path/size tests. This is **planned**, not a claim that SVG is currently served safely. See [backlog](../BACKLOG.md).

## Revisit when

SVG support is explicitly scheduled; users need GIF/WebP; a bounded header parser cannot reject an observed malformed case; or stronger filesystem-race isolation becomes necessary.

## Sources

[Image policy](../../server/images.py), [routes](../../server/http.py), [image tests](../../tests/test_images.py), [browser checks](../../tests/browser.mjs), [image UI](../../web/media.js).
