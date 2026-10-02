# Synthetic architecture

## Flow

```mermaid
flowchart LR
  Draft --> Review --> Archive
```

## Components

| Component | Purpose |
| --- | --- |
| Draft | Fabricated text |
| Review | Synthetic check |

Return to the [plan](plan.md).

## Ordinary label words

```mermaid
flowchart LR
  clickWorker[Build container image] --> styleWorker[Code style checks]
  styleWorker --> Notes["see http://example.test in notes; href is text"]
```

```mermaid
sequenceDiagram
  clickClient->>styleServer: Click to submit
  styleServer-->>clickClient: Code style checks, build container image
```

## Inert label content

This fabricated label is data, not an instruction to execute HTML.

```mermaid
flowchart LR
  Label["Hostile payload <img src='https://example.invalid/probe' onerror='parent.diagramProbe=1;alert(1)'><script>parent.diagramProbe=1;alert(1)</script> remains data"] --> Safe[Inert label]
```
