# VideoAIAgent

An independent Windows video production service, intended to integrate with Virtual Company through an HTTP job API.

Repository: [johdav999/VideoAIAgent](https://github.com/johdav999/VideoAIAgent).

## Current status

**Native Windows scaffolding and local rendering work.** The adapter uses a pinned, attributed subset of [Cinetic v1.0.0](https://github.com/Leonxlnx/cinetic/tree/91c43acf4ea183ea68861d4cd99ec054f6741876), Remotion 4.0.529 and FFmpeg. It produces preview and sharp-master MP4s with synthesized audio and output QA. No Cinetic fork or global skill installation is used.

Windows acceptance includes a real 1920x1080/60 fps sample, Unicode/spaces in its path, failure/cancellation/timeout/retry checks, and format/audio evidence. See [the acceptance report](docs/acceptance/windows-first-render.md).

The sample retains Cinetic's starter artwork. Creative QA flags placeholder branding and a static end hold; it is a technical demonstration. Motion blur, brief-to-film AI orchestration, the HTTP job API and Azure storage remain unimplemented.

## Render on Windows

Requirements: Node.js 22.9+, Python 3.11+ (validated with 3.12), Git, FFmpeg/ffprobe 6+ with libx264. From PowerShell in this repository:

```powershell
npm.cmd ci
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements-render.txt
npm.cmd run browser:install
npm.cmd run doctor:render
npm.cmd run render:sample
```

No virtual-environment activation or Bash is required. Initial setup downloads npm/Python packages and Remotion's pinned Chrome Headless Shell. Renders then use local fonts, code and browser.

The sample prints the verified MP4 path under ignored `data/films/`. Each film retains `film.json`, `TREATMENT.md`, `status.json`, `out/render.log` and `out/qa/` reports. `out/LATEST.txt` points to its last successful output.

Create and render a named film:

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

The HTTP foundation serves `GET http://127.0.0.1:4310/health`. Its capability flags describe HTTP features and remain false because rendering is currently available through the CLI only. Other paths return 404. Change `PORT` through the shell or optional `.env` copied from `.env.example`.

| Command | Purpose |
| --- | --- |
| `npm.cmd run doctor` | Check core executables |
| `npm.cmd run doctor:render` | Check Python modules, source hashes, renderer and browser |
| `npm.cmd run browser:install` | Download/locate the managed browser and record its version |
| `npm.cmd run film:new -- --name NAME` | Create a starter workspace |
| `npm.cmd run film:render -- --project PATH` | Render an existing workspace |
| `npm.cmd run render:sample` | Create and render a new demonstration |
| `npm.cmd run test:render` | Opt-in real failure/cancellation/timeout/retry acceptance |

CI checks syntax, provenance, matching Remotion versions, HTTP behavior, scaffolding and process management on Windows/Linux with Node 22/24. CI does not run Python/browser rendering acceptance. Linux rendering has not been accepted.

## Layout and next steps

`src/api` holds the HTTP foundation, `src/cinetic-adapter` the scaffolder, `src/renderer` the worker and `third_party/cinetic` the attributed upstream source. `src/agent` and `src/templates` are future integration boundaries. Generated media and credentials stay out of Git.

See [architecture](docs/architecture.md), [Windows port](docs/windows-port.md) and [roadmap](docs/roadmap.md). Virtual Company will submit jobs through a dedicated client when the job API is implemented.

This repository is unlicensed project code at present. Imported Cinetic code is MIT; [its notice](third_party/cinetic/LICENSE) is preserved. Remotion dependencies retain their own licence terms.
