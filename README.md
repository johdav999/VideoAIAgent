# VideoAIAgent

An independent video production service for Windows, intended to integrate with Virtual Company through an HTTP job API.

Repository: [johdav999/VideoAIAgent](https://github.com/johdav999/VideoAIAgent).

## Current status

This is the repository foundation. It includes a runnable health endpoint, dependency diagnostics, tests, and Windows/Linux CI. **Video rendering, the Cinetic Windows adapter, job processing, and Azure storage are not implemented yet.**

This is the only project repository. We will consume [Cinetic](https://github.com/Leonxlnx/cinetic) as an upstream dependency and implement Windows compatibility here; no Cinetic fork is planned. Cinetic supplies an agent-directed production workflow rather than a hosted rendering API. Its current tooling uses Bash; native Windows support is the first development milestone.

## Quick start on Windows

Use Node.js 22.9 or newer. The foundation has no third-party npm dependencies.

```powershell
npm.cmd ci
npm.cmd run doctor
npm.cmd test
npm.cmd start
```

In another terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:4310/health
```

The health response explicitly reports `rendering: false`. The API binds to loopback. All other paths return 404; submitting a video job is not supported yet. Stop it with Ctrl+C.

Optional local configuration:

```powershell
Copy-Item .env.example .env
npm.cmd start
```

`PORT` defaults to `4310`. Shell environment variables take precedence over `.env`. Keep secrets in ignored local files; `.env.example` contains configuration names only.

## Layout

```text
src/
  api/               Local health endpoint; future job API
  agent/             Future brief-to-production orchestration
  cinetic-adapter/   Native Windows compatibility boundary
  renderer/          Future Remotion 4 rendering worker
  templates/         Future reusable compositions
scripts/             Dependency diagnostics
examples/            Draft video brief
tests/               Service smoke checks
docs/                Architecture, Windows port, milestones
```

See [architecture](docs/architecture.md), [Windows setup and port plan](docs/windows-port.md), and [roadmap](docs/roadmap.md). The first acceptance target is a real local MP4 rendered on Windows without WSL or Git Bash.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm.cmd start` | Start the local foundation API |
| `npm.cmd run dev` | Restart the API when source changes |
| `npm.cmd run check` | Check JavaScript syntax |
| `npm.cmd test` | Exercise the service over a real HTTP connection |
| `npm.cmd run doctor` | Check Node, Git, Python, FFmpeg/libx264 and ffprobe |

On Linux, use `npm` instead of `npm.cmd`. Doctor checks tool availability only; passing it does not establish rendering readiness.

No licence is granted for this repository yet. Cinetic and future renderer dependencies retain their own licences; review those before distributing their code or deploying the renderer.
