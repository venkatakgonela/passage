# 0008: Sanitized math and inert document export

Status: Accepted

Recorded: 2026-10-03 during implementation.

## Context

Readable equations and portable document copies must not add executable source content or network dependencies.

## Decision drivers

Offline operation, shared sanitation, no build step, source immutability and explicit export limits.

## Options considered

1. KaTeX HTML with bundled fonts: mature layout but increases assets and font-serving surface. Not selected for this small reader.
2. Pinned prebuilt KaTeX with MathML-only output: uses native math layout and no remote fonts or CSS. Selected with browser verification and source fallback.
3. Raw TeX only: safest dependency footprint but does not meet readable-math needs. Retained only for errors.
4. Active exported reader application: preserves controls but exports execution and resource loading. Rejected in favor of sanitized static HTML.

## Decision

Lazy-load KaTeX 0.19.0 only for recognized math. Limit 200 expressions per document, 4,000 characters per expression, 100 expansions and maximum size 20. Disable trust, reject resource/definition commands, render MathML and sanitize again with the existing DOMPurify boundary. No math CSS/font assets or new static suffix permissions. Invalid/unavailable math shows original source. Native MathML appearance varies by browser.

Export clones the rendered article, removes controls, active/resource elements and style attributes, sanitizes again, and packages trusted reader CSS inline. Only validated local PNG/JPEG images may be embedded; remote images become placeholders. A total 8 MiB limit bounds the output. Opaque sandboxed diagram output is not extracted: export uses an explicit source placeholder rather than relaxing the iframe boundary. Export has restrictive CSP and no scripts, remote resources, filesystem write API or reader settings. Browser print/PDF remain separate.

## Consequences

Math is native and font-free but not identical across platforms. Expression limits are not a hard CPU timeout. Export loses diagram graphics and interactive controls; users can use print for graphical snapshots. Small Markdown extensions deliberately do not implement full YAML or all footnote grammar.

## Revisit when

Cross-browser MathML quality is insufficient, rich footnotes are needed, or a separately reviewed safe static-diagram export becomes worthwhile.

## Sources

[KaTeX security](https://katex.org/docs/security.html), [upstream advisories](https://github.com/KaTeX/KaTeX/security/advisories), [notices](../../THIRD-PARTY-NOTICES.md), [extensions](../../web/extensions.js), [export](../../web/export.js).
