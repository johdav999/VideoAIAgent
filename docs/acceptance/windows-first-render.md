# First native Windows render acceptance

Date: 15 October 2026. Scope: local Windows CLI scaffolding, preview/sharp rendering and technical output acceptance. This is not full Cinetic parity or customer-film approval.

## Implemented path

Cinetic v1.0.0 (`91c43acf4ea183ea68861d4cd99ec054f6741876`) supplies the original starter and audio/QA tooling. Native Node adapters replace Bash scaffolding and render orchestration. No fork, global skill installation, WSL, Bash invocation or Unix symlink was used for rendering.

Exact imported files and hashes: `third_party/cinetic/provenance.json`. Original MIT notice: `third_party/cinetic/LICENSE`.

## Accepted host and artifact

| Item | Observed |
| --- | --- |
| Host | Native Windows, x64 |
| Node | 24.13.1 |
| Python | 3.12.6, repository-local venv |
| FFmpeg / ffprobe | 8.0.1, libx264 available |
| Remotion packages | 4.0.529 throughout |
| Browser | Chrome Headless Shell 149.0.7790.0 |
| Workspace | `data/films/Windows final rörelse` (spaces and non-ASCII character) |
| Mode | Sharp master, CRF14, x264 slow, concurrency 2 |
| Output | `out/master-1792094111974-7368.mp4` in that workspace |
| SHA-256 | `3c87f9659663e085f959ac42a8b630c6a74cde610aa7779eaa4a547ac567d7fe` |
| Dimensions / timing | 1920x1080, 60 fps, 540 frames, 9.000 seconds |
| Video | H.264 High, yuv420p, BT.709 primaries/transfer/matrix, limited range |
| Audio | AAC stereo, 48 kHz, 9.000 seconds |
| Sync | Worst lag 0 samples at all three measured correlation windows |
| Loudness / peak | -14.01 LUFS and -2.25 dBTP from decoded-audio sync audit |

A separate 1280x720/60 fps preview also passed the technical gates. Python package versions are fixed in `requirements-render.txt`; npm versions/transitive dependencies are fixed in `package-lock.json`. The managed browser version is selected by the pinned renderer.

## Verification and retained evidence

- `npm.cmd run check`: passed syntax, original-source hashes and matching Remotion versions.
- `npm.cmd test`: seven checks passed, covering HTTP behavior, safe scaffolding, exact upstream provenance, missing executable, nonzero renderer exit, timeout and owned descendant cancellation.
- `npm.cmd run doctor:render`: all executable/module/package/provenance/browser checks passed.
- The 1080p render passed upstream score, grid, audio-sync and format/loudness/peak gates.
- The encoded MP4's contact sheet was inspected at 18 half-second samples. Text, dot handoff, assembled mark and final wordmark were visible without clipping or missing fonts. This is frame inspection, not a full playback/subjective sound review.

Raw local files remain in the ignored film workspace: `out/render.log`, `out/qa/versions.json`, `score.json`, `sync.json`, `probe.json`, `ffprobe.json`, `creative.json`, `forensics.json`, `acceptance.json`, and `contact-sheet.png`. Its treatment and film input are retained alongside source and the frozen bundle. Generated videos/media are deliberately not committed.

## Failure, cancellation and retry acceptance

`npm.cmd run test:render` exercised the real pipeline in `data/films/Acceptance rörelse 1792094222081`:

| Trigger | Recorded result |
| --- | --- |
| Nonexistent Python executable | Failed with actionable executable/path details; no successful artifact |
| Nonexistent browser executable | Failed with actionable executable/path details |
| Abort after actual picture rendering began | Cancelled; worker terminated and lock released |
| One-second deadline | Failed with `TIMEOUT`; lock released |
| Retry after those failures | Succeeded with a technically verified 640x360/30 fps MP4 |

Evidence is in that workspace's `out/qa/failure-acceptance.json` and appended render log. Process-tree unit checks also verified that an owned descendant stopped. The repeatable opt-in command is `npm.cmd run test:render`; it requires the real dependencies and creates its own workspace.

## Creative failures and remaining boundaries

Creative QA is **not passed**. Upstream film lint reports five starter-brand placeholders. Pixel forensics reports one failing hold at frames 362-539: a 178-frame static tail, against its 120-frame limit. It also reports three warnings about quiet opening/middle sections. These findings are retained; no rules were disabled to obtain technical success.

The output has `technicalQaPassed: true`, `creativeQaPassed: false`, and `shipReady: false`. It demonstrates the native Windows pipeline with original starter artwork. A finished film needs its own brand/treatment, revised motion and creative approval.

Motion-blurred masters and broader Cinetic options are not implemented. HTTP rendering, automated brief-to-film direction, distributed queue, Azure storage/deployment, production security and Linux rendering acceptance remain outstanding. The GitHub CI definition covers source/unit checks; it is not evidence of a browser/Python render on a hosted runner.
