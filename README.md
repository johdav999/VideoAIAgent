# VideoAIAgent

An independent Windows video production service, intended to integrate with Virtual Company through an HTTP job API.

Repository: [johdav999/VideoAIAgent](https://github.com/johdav999/VideoAIAgent).

## Current status

**A local video studio is available at [http://127.0.0.1:4310/](http://127.0.0.1:4310/).** Run `npm.cmd start`, enter a brief, optionally edit the three-scene copy, generate a video, follow progress and preview/download the MP4. The UI includes length/format/color choices, recent jobs, cancel/retry and reload recovery. See [studio usage](docs/studio.md).

The first UI uses local text extraction and the existing motion template. It does not claim AI interpretation of visual directions or generated footage.

**The local video job API works on Windows.** Submit a JSON specification, monitor progress, cancel/retry jobs and retrieve an MP4. A disk-backed queue survives restarts and one worker renders a configurable product-launch template with text, duration, brand colours and optional embedded PNG logo.

The native authoring adapter covers the pinned [Cinetic v1.0.0](https://github.com/Leonxlnx/cinetic/tree/91c43acf4ea183ea68861d4cd99ec054f6741876) release, including Remotion 4.0.529, HyperFrames 0.8.79, adaptive motion blur, chunked/range rendering, fonts, brand kits, delivery formats and QA. Original sources and hashes remain in this repository. No Cinetic fork or global skill installation is used. See [the native command guide](docs/windows-cinetic.md) and [feature acceptance](docs/acceptance/windows-cinetic-complete.md).

The API sample passes technical output checks, film lint and pixel forensics. It replaces the old starter artwork and static ending. [The repository-local Cinetic skill](skills/cinetic-windows/SKILL.md) supplies brief-to-film direction and review when loaded by an agent. Automated QA and human creative approval are reported separately. The HTTP contract remains a declarative product template; hosted AI orchestration, Virtual Company integration and Azure deployment remain future work.

## Render on Windows

Requirements: Node.js 22.12+ (required by HyperFrames' locked Puppeteer dependency), Python 3.11+ (validated with 3.12), Git, FFmpeg/ffprobe 6+ with libx264. From PowerShell in this repository:

```powershell
npm.cmd ci
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements-render.txt
npm.cmd run browser:install
npm.cmd run doctor:render
npm.cmd start
```

Open the studio at [http://127.0.0.1:4310/](http://127.0.0.1:4310/) after starting the service.

No virtual-environment activation or Bash is required. Initial setup downloads npm/Python packages and Remotion's pinned Chrome Headless Shell. Renders then use local fonts, code and browser.

Use [the PowerShell submission example](docs/local-api.md) with [product-launch.json](examples/product-launch.json). The [OpenAPI contract](docs/openapi.yaml) and [input schema](docs/video-specification.schema.json) describe the API. Accepted jobs live in ignored `data/service` and each attempt retains inputs, treatment, render log, output and QA evidence under `data/films/`.

For trusted local authoring, create either Cinetic engine and use its native Windows tools:

```powershell
npm.cmd run cinetic -- new --name "Windows rörelse" --size 1920x1080 --fps 60
npm.cmd run cinetic -- audio --project "data/films/Windows rörelse"
npm.cmd run cinetic -- render Film out/master.mp4 --project "data/films/Windows rörelse" --blur --budget 6
```

Edit the film's local artwork and replace starter placeholders before creative delivery. Names cannot contain path separators; scaffolding never overwrites an existing film. Preview uses CRF20/veryfast; masters use CRF14/slow. See the [complete command guide](docs/windows-cinetic.md) for frame ranges, 10-bit blur, silent loops, GIF/WebM/alpha, social layouts, fonts, QA and HyperFrames.

Ctrl+C cancels the owned worker tree. Native authoring has a one-hour deadline and concurrency is bounded to 1-4. Failure/cancellation records actual status. The earlier `film:*` compatibility commands retain their sharp renderer and 600-second default deadline. See [Windows setup](docs/windows-cinetic.md) for lock recovery and retained evidence.

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
| `npm.cmd run cinetic -- help` | Full native Cinetic authoring commands |
| `npm.cmd run test:cinetic` | Real Windows feature acceptance for both engines and delivery tools |
| `npm.cmd run test:render` | Opt-in real failure/cancellation/timeout/retry acceptance |
| `npm.cmd run test:api-render` | Real HTTP rendering, cancellation, hard restart, persistence and retrieval acceptance |

CI checks syntax, template types, provenance, matching Remotion versions, HTTP behavior, durable job lifecycle, scaffolding and process management on Windows/Linux with Node 22/24. Unit tests use labelled fixtures; real Windows acceptance uses the actual browser/Python/FFmpeg worker. CI does not run that media acceptance. Linux rendering has not been accepted.

## Layout and next steps

`src/api` holds HTTP routes, `src/jobs` the durable local queue, `src/templates` the configurable composition, `src/cinetic-adapter` the native tools, `skills/cinetic-windows` the agent direction/review workflow, `src/renderer` the service worker and `third_party/cinetic` the attributed upstream source. Hosted AI orchestration remains planned. Generated media and credentials stay out of Git.

See [architecture](docs/architecture.md), [Windows port](docs/windows-port.md) and [roadmap](docs/roadmap.md). The next integration boundary is a Virtual Company API client and Video Production Agent.

This repository is unlicensed project code at present. Imported Cinetic code is MIT; [its notice](third_party/cinetic/LICENSE) is preserved. Remotion dependencies retain their own licence terms.
