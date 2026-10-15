# Architecture

## Scope and ownership

VideoAIAgent is an independent service developed in this repository. Virtual Company will remain a consumer through an HTTP contract, with no Node or Python dependencies added to its .NET application. Cinetic compatibility belongs here; no separate Cinetic fork will be created.

## Intended flow

```mermaid
flowchart LR
  VC[Virtual Company client] --> API[Video job API]
  API --> Jobs[Persistent job queue]
  Jobs --> Agent[Production orchestration]
  Agent --> Adapter[Cinetic Windows adapter]
  Adapter --> Worker[Remotion and FFmpeg worker]
  Worker --> Storage[Local artifacts or Azure Blob Storage]
```

Only the local API's `GET /health` exists today. All production-flow boxes above describe the target architecture.

## Boundaries

| Area | Responsibility |
| --- | --- |
| `src/api` | Validate requests, expose job status, return artifact references |
| `src/agent` | Brief, treatment, scene/timeline planning and revision workflow |
| `src/cinetic-adapter` | Versioned upstream integration, Windows tooling and file handling |
| `src/renderer` | Bounded render execution, audio muxing, QA and progress |
| `src/templates` | Reusable compositions and input definitions |

Use Node.js 22.9+ for the initial foundation and future process orchestration. Introduce TypeScript and React with the renderer. Keep Python for compatible Cinetic audio and QA tooling. Pin exact dependencies once selected; the foundation deliberately has no external runtime packages.

## Proposed job contract (not implemented)

- `POST /v1/video-jobs`: validate a specification; persist it before returning 202 with a job ID and status URL.
- `GET /v1/video-jobs/{id}`: report `queued`, `planning`, `rendering`, `succeeded`, `failed`, or `cancelled`, progress and structured errors.
- `GET /v1/video-jobs/{id}/artifacts`: return authorized output references after verification.

Define a versioned schema and OpenAPI contract before adding endpoints. `examples/launch-brief.json` is design input, not a supported request contract. Successful status must require an actual probed output. Plan for idempotent submission, restart recovery and cancellation before connecting VC.

## Execution and storage

Start with one local worker and per-job directories under ignored `data/`. Add a durable queue and metadata store with the job API; choose Azure services when deployment requirements are concrete. Move artifacts to Azure Blob Storage behind a storage interface later.

Constrain duration, resolution, concurrency and runtime. Accept declarative inputs rather than uploaded executable compositions. Launch subprocesses with argument arrays and keep private assets and credentials out of logs. Authentication and deployment hardening are required before exposing the service beyond loopback.
