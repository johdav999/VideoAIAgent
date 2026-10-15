# Native Windows setup and Cinetic port

## Upstream basis

The upstream is [Leonxlnx/cinetic](https://github.com/Leonxlnx/cinetic); see its [setup guide](https://github.com/Leonxlnx/cinetic/blob/main/docs/setup.md). It is an agent skill, with a Remotion starter and Python/Node/Bash tooling. Upstream currently documents macOS/Linux and untested WSL guidance. Our target is native Windows 11 with PowerShell.

**Do not fork Cinetic.** Implement Windows entry points in this repository. At the first integration milestone, select and record an exact upstream commit or release, preserve its licence and record any copied files and changes. A local checkout may live under ignored `external/`; no upstream code is bundled in this foundation.

## Foundation diagnostics

```powershell
npm.cmd run doctor
```

Doctor checks Node >=22.9, Git, Python >=3.11, FFmpeg >=6 with libx264, and ffprobe >=6. It performs no installs and does not validate Python modules, Remotion, Chromium, or rendering.

For the future render pipeline, prepare a repository-local Python environment:

```powershell
python -m venv .venv
$env:PYTHON_PATH = (Resolve-Path .venv/Scripts/python.exe).Path
npm.cmd run doctor
```

This does not install audio/QA dependencies. Select and lock those dependencies after checking the pinned Cinetic version. A Chromium headless-shell executable and matching Remotion 4 packages will also be required.

## Porting work

| Surface | Windows implementation |
| --- | --- |
| Film scaffolding (`new-film.sh`) | Node file APIs, explicit paths, pinned starter and dependencies |
| Render/mux orchestration (`render.sh`) | Node process APIs; preserve upstream flags, exit failures and QA gates |
| Python dispatch | Explicit venv interpreter instead of assuming `python3` and shell activation |
| Browser discovery | Explicit Windows executable path or managed Remotion browser; no `/opt` assumptions |
| Fonts and assets | Portable copies and local asset references, with no Unix symlink requirement |
| Audio and quality gates | Run Python tools through the selected interpreter; verify Windows subprocess and temp-file behavior |
| Cancellation and cleanup | Terminate only the job's process tree and close file handles before cleanup |

Inventory the chosen upstream scripts before implementation. Use a preview render first, then cover audio, QA and motion blur. Additional engines and delivery variants can follow the Remotion path.

## Acceptance for the first port

1. Record upstream revision and exact runtime/package/browser versions.
2. Run from PowerShell without WSL or Git Bash, including a working directory with spaces and non-ASCII characters.
3. Create and render a sample to a real MP4; preserve its treatment, inputs and render log locally.
4. Use ffprobe to confirm dimensions, frame rate, duration, video codec/pixel format and expected audio stream.
5. Run applicable upstream audio/sync/visual QA gates and inspect the output. Label preview-only evidence clearly.
6. Exercise missing dependencies, a failed renderer, cancellation and retry; preserve actionable failure details.

No part of this rendering acceptance has been completed by the repository setup.
