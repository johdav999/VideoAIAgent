# VideoAIAgent

An independent Windows video production service, intended to integrate with Virtual Company through an HTTP job API.

Repository: [johdav999/VideoAIAgent](https://github.com/johdav999/VideoAIAgent).

## Current status

**The local video job API works on Windows.** Submit a JSON specification, monitor progress, cancel/retry jobs and retrieve an MP4. A disk-backed queue survives restarts and one worker renders a configurable product-launch template with text, duration, brand colours and optional embedded PNG logo.

The implementation uses a pinned, attributed subset of [Cinetic v1.0.0](https://github.com/Leonxlnx/cinetic/tree/91c43acf4ea183ea68861d4cd99ec054f6741876), Remotion 4.0.529 and FFmpeg. No Cinetic fork or global skill installation is used. See [job-service acceptance](docs/acceptance/windows-job-service.md) and the earlier [native port report](docs/acceptance/windows-first-render.md).

The new API sample passes technical output checks, film lint and pixel forensics. It replaces the old starter artwork and static ending. Automated QA and human creative approval are reported separately. Motion blur, brief-to-film AI direction, Virtual Company integration and Azure deployment remain future work.

## Render on Windows

Requirements: Node.js 22.9+, Python 3.11+ (validated with 3.12), Git, FFmpeg/ffprobe 6+ with libx264. From PowerShell in this repository:

```powershell
npm.cmd ci
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements-render.txt
npm.cmd run browser:install
npm.cmd run doctor:render
npm.cmd start
```

No virtual-environment activation or Bash is required. Initial setup downloads npm/Python packages and Remotion's pinned Chrome Headless Shell. Renders then use local fonts, code and browser.

Use [the PowerShell submission example](docs/local-api.md) with [product-launch.json](examples/product-launch.json). The [OpenAPI contract](docs/openapi.yaml) and [input schema](docs/video-specification.schema.json) describe the API. Accepted jobs live in ignored `data/service` and each attempt retains inputs, treatment, render log, output and QA evidence under `data/films/`.

For trusted manual authoring, the original CLI can still create and render the Cinetic starter (whose placeholder artwork is retained):

```powershell
npm.cmd run film:new -- --name "Windows rörelse" --width 1920 --height 1080 --fps 60 --bpm 120
npm.cmd run film:render -- --project "data/films/Windows rörelse" --mode master --concurrency 2
```

Edit that film's local `src/` to develop its artwork. This is a trusted local authoring workflow. Names cannot contain path separators; scaffolding never overwrites an existing film. Preview uses CRF20/veryfast and master uses CRF14/slow. Both are sharp renders; blur mode is rejected.

Ctrl+C cancels the owned worker tree. The deadline defaults to 600 seconds; `--timeout-seconds` accepts 1-3600. Concurrency is bounded to 1-4. Failure/cancellation records actual status. Retry the render command after correcting the problem. See [Windows setup](docs/windows-port.md) for lock recovery.

## Development and local API

```powershell
npm.cmd run check
npm.cmd test
npm.cmd start
```

The service listens at `http://127.0.0.1:4310`. Use `GET /health`, `POST /v1/video-jobs`, `GET /v1/video-jobs/{id}`, `/cancel`, `/retry` and `/video`. Video retrieval supports byte ranges. The API accepts declarative inputs and binds to loopback. Change `PORT` or `VIDEO_DATA_DIR` through the shell or optional `.env` copied from `.env.example`.

| Command | Purpose |
| --- | --- |
| `npm.cmd run doctor` | Check core executables |
| `npm.cmd run doctor:render` | Check Python modules, source hashes, renderer and browser |
| `npm.cmd run browser:install` | Download/locate the managed browser and record its version |
| `npm.cmd run film:new -- --name NAME` | Create a starter workspace |
| `npm.cmd run film:render -- --project PATH` | Render an existing workspace |
| `npm.cmd run render:sample` | Create and render a new demonstration |
| `npm.cmd run test:render` | Opt-in real failure/cancellation/timeout/retry acceptance |
| `npm.cmd run test:api-render` | Real HTTP rendering, cancellation, hard restart, persistence and retrieval acceptance |

CI checks syntax, template types, provenance, matching Remotion versions, HTTP behavior, durable job lifecycle, scaffolding and process management on Windows/Linux with Node 22/24. Unit tests use labelled fixtures; real Windows acceptance uses the actual browser/Python/FFmpeg worker. CI does not run that media acceptance. Linux rendering has not been accepted.

## Layout and next steps

`src/api` holds HTTP routes, `src/jobs` the durable local queue, `src/templates` the configurable composition, `src/cinetic-adapter` the scaffolder, `src/renderer` the worker and `third_party/cinetic` the attributed upstream source. AI agent orchestration remains planned. Generated media and credentials stay out of Git.

See [architecture](docs/architecture.md), [Windows port](docs/windows-port.md) and [roadmap](docs/roadmap.md). The next integration boundary is a Virtual Company API client and Video Production Agent.

This repository is unlicensed project code at present. Imported Cinetic code is MIT; [its notice](third_party/cinetic/LICENSE) is preserved. Remotion dependencies retain their own licence terms.
