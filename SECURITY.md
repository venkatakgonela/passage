# Security

Passage is a trusted-local, loopback-only document reader, not an Internet service or a hardened filesystem sandbox. Do not expose its port through a proxy or tunnel.

Source documents are read-only. Reader settings are separate, local and unencrypted. Host, Origin and Fetch Metadata checks protect HTTP access; root-relative path checks reject traversal and symlinks. Markdown and math are sanitized; diagram output stays in an opaque sandbox with no permissions. Export is inert HTML with restrictive CSP and no remote resources. See the [threat model and tests](docs/ARCHITECTURE.md).

Residual risks include malicious local filesystem races, slow filesystem calls, resource-intensive diagram/math layout within caps, unknown vendor vulnerabilities, and network requests from remote images in the live reader. Offline export omits those images. Never treat a passing scan or dependency audit as a security certification.

Before a hosted repository is available, report suspected issues privately to the person who supplied your copy. After publication, use the repository's private vulnerability reporting channel if enabled; do not post sensitive source files, local paths, secrets or exploitable details in public issues. Include version, platform and a minimal synthetic reproducer. No response-time guarantee is currently offered.
