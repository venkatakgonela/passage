# Synthetic diagram error states

These deliberately invalid synthetic diagrams must show their source and an intelligible error.

## Parser error

```mermaid
flowchart LR
  Draft[unterminated
```

## Disallowed configuration

```mermaid
%%{init: {securityLevel: "loose"}}%%
flowchart LR
  Draft --> Review
```

## Return

Return to the [collection](README.md).
