# Native Windows Cinetic adapter

## Dependency and provenance

The adapter consumes [Cinetic v1.0.0](https://github.com/Leonxlnx/cinetic/tree/91c43acf4ea183ea68861d4cd99ec054f6741876), commit `91c43acf4ea183ea68861d4cd99ec054f6741876`, through a vendored subset. See `third_party/cinetic/provenance.json` for every source hash and `third_party/cinetic/LICENSE` for the MIT notice. Cinetic supplies an agent workflow and tooling rather than a hosted video API.

No fork or global skill installation is used. Original source retains canonical LF line endings. Generated copies receive width/height/fps/BPM substitutions. Native orchestration lives here rather than in upstream Bash scripts.

## Setup from PowerShell

```powershell
npm.cmd ci
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements-render.txt
npm.cmd run browser:install
npm.cmd run doctor:render
npm.cmd run render:sample
```

Use Node >=22.9, Python >=3.11, FFmpeg/ffprobe >=6 with libx264. The accepted host uses Python 3.12.6. Python versions are exact in `requirements-render.txt`; Remotion packages are all 4.0.529 with an npm lockfile. Browser setup records Remotion's managed executable/version in ignored `data/browser.json`.

The worker uses `.venv/Scripts/python.exe` directly. `PYTHON_PATH` overrides it. `REMOTION_BROWSER`, then `CHROMIUM_PATH`, override the managed browser. Optional `.env` values are loaded by npm rendering commands; shell environment values win. No activation, global Python packages, Unix symlinks, Bash or WSL are required.

## Implemented subset

| Surface | Native implementation |
| --- | --- |
| Scaffolding | Node file copies; exclusive workspaces under `data/films` |
| Timeline | Validated dimensions, fps/BPM and whole-beat grid |
| Dependencies/fonts | Repository lockfile and local Geist font assets |
| Browser | Recorded Windows executable or explicit override |
| Cues/grid | Local Node/tsx dispatch with argument arrays |
| Score/master | Explicit venv interpreter and upstream Python tools |
| Preview/sharp master | Remotion Node APIs; frozen source bundle per attempt |
| Audio mux | FFmpeg, AAC stereo/48 kHz, padded/trimmed to picture |
| Technical gates | Score, grid, audio sync, format/loudness/peak probe |
| Creative evidence | Encoded-video contact sheet, film lint and forensics |
| Failure/cancellation | Owned process tree, deadline, lock, durable status and retry |

API settings retain BT.709, yuv420p, JPEG q95, ANGLE and the font-loading timeout. The original CLI config is kept for provenance but is not executed. The scaffold does not run the original package's Bash-based npm scripts.

Defaults are 1280x720/60 fps/120 BPM, with the starter's 9-second duration. Master means sharp CRF14; it does not imply motion blur or creative approval. Status records technical and creative QA separately and keeps `shipReady: false`.

## Retry and retained evidence

Correct the dependency/source problem and rerun `film:render` for the same project. Each attempt freezes a separate bundle under `out/work-*`; successful MP4 filenames are unique. Current QA reports are in `out/qa`; retries replace them. The render log appends attempts and `out/LATEST.txt` retains the last successful artifact. Archive the workspace before revising a delivery requiring immutable evidence.

Concurrent renders of one film fail on `.render.lock`. Graceful cancellation, timeout and failure release the lock. After a hard OS/process crash, inspect the PID/start time recorded in that lock; remove only that film's lock after confirming its worker stopped. Automatic crash recovery belongs to the future production job service.

## Acceptance and remaining scope

See [Windows evidence](acceptance/windows-first-render.md) for real 1080p60 output, Unicode/spaces, format/audio measurements, frame inspection and failure/retry checks.

Motion blur, frame-range exports, silent deliverables, font vending, HyperFrames, brand-kit delivery and the broader agent direction/review workflow are not ported. Starter placeholder lint failures and its static end-hold forensics failure are preserved. The HTTP job API, distributed queue, Azure deployment and customer-film approval remain future work.
