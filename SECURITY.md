# Security

Passage is a trusted-local, loopback-only document reader, not an Internet service or a hardened filesystem sandbox. Do not expose its port through a proxy or tunnel.

Source documents are read-only. Reader settings are separate, local and unencrypted. Host, Origin and Fetch Metadata checks protect HTTP access; root-relative path checks reject traversal and symlinks. Markdown and math are sanitized; diagram output stays in an opaque sandbox with no permissions. Export is inert HTML with restrictive CSP and no remote resources. See the [threat model and tests](docs/ARCHITECTURE.md).

Residual risks include malicious local filesystem races, slow filesystem calls, resource-intensive diagram/math layout within caps, unknown vendor vulnerabilities, and network requests from remote images in the live reader. Offline export omits those images. Never treat a passing scan or dependency audit as a security certification.

Automated checks include CodeQL code scanning alongside the security regression tests.

Report suspected vulnerabilities privately through this repository's **Security → Report a vulnerability** route. Include the Passage version or commit, operating system, Python/browser versions, expected versus actual behavior, impact, and a minimal synthetic reproducer. Never include private documents, secrets or personal filesystem paths. There is no response-time guarantee.

If the button is unavailable, do not disclose exploit details publicly; a public issue may ask only for a private reporting route.
