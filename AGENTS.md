# Engineering rules

- Keep the runtime to Python's standard library, vanilla JavaScript modules and the existing vendored scripts. No bundler or framework without an explicit scope decision.
- Preserve read-only source documents and loopback-only binding. Settings belong outside displayed roots and must remain untracked.
- Every security invariant needs a regression test, including its failure path. Run `make test` and `make lint` before delivery.
- Keep examples synthetic. Never commit secrets, private filesystem paths, personal documents or runtime settings.
- Preserve third-party licences and provenance. First-party content must not describe other products as inspiration.
- Document actual behaviour and limits. Keep architecture, threat-to-test mappings, feature audit and changelog current.
- Record significant choices with real alternatives in a decision record. Avoid unrelated features or rendering changes during structural work.
