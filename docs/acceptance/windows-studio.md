# Windows video studio acceptance

Date: 16 October 2026. Base revision: `7c99fa7` plus the studio change. Environment: native Windows, local operator, Node 24.13.1, Chrome in-app browser, real Remotion/Python/FFmpeg worker. No model account, external provider or simulated render is used.

Launch: `npm.cmd start`; studio: `http://127.0.0.1:4310/`. The existing local API, renderer and data directory remain the execution path. A separate disposable store on port 4311 was used for dependency failure/restart testing.

## Acceptance flows

| ID | Action and expected outcome | Observed result |
| --- | --- | --- |
| STUDIO-01 | Open a fresh studio, enter a brief and generate a landscape video | Real queued/preparing/rendering/checking progress, then Ready/100%; 12-second 1280×720 MP4 |
| STUDIO-02 | Play and download the completed video | Browser decoded H.264 with no media error, played to 12 s; downloaded file SHA-256 matches the persisted render hash |
| STUDIO-03 | Prepare labeled copy, edit the opening and generate a portrait video | Submitted title `Launch as one` preserved; real 8-second 720×1280 video |
| STUDIO-04 | Cancel the active job, retry, and reload while it prepares | Cancelling→Cancelled; retry starts attempt 2, reload restores selection/progress, then succeeds with the same immutable copy |
| STUDIO-05 | Select a previous entry from Recent videos | Preview and download URL switch back to that actual job; original brief/settings survive reload |
| STUDIO-06 | Use an empty brief or invalid brand | Browser required-field feedback prevents submission; five-word brand returns a visible planner validation error without creating a job |
| STUDIO-07 | Run with a missing Python executable in the isolated test store | Genuine render failure shows error/retry, no successful player/download; source brief remains available |
| STUDIO-08 | Stop that test service, reconnect, restore the interpreter and retry | Reconnecting state distinguishes transport loss from job failure; failed record persists across restart, Retry produces a real successful attempt 2 |
| STUDIO-09 | Use a 390×844 viewport, review copy and control a job | Single-column layout; measured document width fits the viewport; preview overflow repaired; controls and text remain available |
| STUDIO-10 | Edit scene copy, then change format before generation | Edited title remains visible and is submitted with updated dimensions; square 1080×1080 job uses `A fresh perspective` |

`npm.cmd run check` and all **18 tests** pass. Planner tests cover all palette/format combinations at 6/8/12/20/30 seconds, reading limits, labeled and long briefs, invalid inputs and executable-field rejection. HTTP tests cover the static allowlist, CSP, local-origin validation, the plan endpoint and submission compatibility. Existing job, state, process and rendering-source checks remain passing. OpenAPI YAML parses successfully.

## Evidence

Screenshots/logs/media are ignored by Git. Local artifacts:

- `data/ui-uat/studio.png`: completed studio, form, actual video preview and recent jobs.
- `data/ui-uat/mobile-progress.png`: mobile form/progress flow.
- `data/ui-uat/mobile-complete.png`, `mobile-preview.png`: corrected mobile form and completed-video controls.
- `data/ui-uat/failure.png`: genuine missing-dependency error and retry control.
- `data/ui-uat/render-evidence.json`, `landscape-ffprobe.json`, `portrait-ffprobe.json`: actual hashes and stream facts.
- `data/service/jobs/dcad3e40-d2d5-495b-a65b-b0910f2dc29d.json`: landscape job, 360 frames, 1280×720/30 fps, H.264/yuv420p/BT.709, AAC stereo/48 kHz, SHA-256 `f57358d72c5a2b8eb30cfb770533e80b0a5144cd61edbebeb24cc2544a58f4fc`.
- `data/service/jobs/3fe51053-d859-499d-ae42-e201e695f5c5.json`: cancelled/retried portrait job, attempt 2, 240 frames, SHA-256 `4239d6fe24c44698fd579e1ecbe7b2b4a9d7c5d1efaff84bfd5598bacb8980d9`.
- `data/ui-uat/failure-store/jobs/9f8e5695-3388-47a7-a48f-02b0d3f18985.json`: failed dependency followed by successful retry after service restart.

Both successful primary renders pass technical and automated creative checks. Human creative approval remains separate. The original brief is condensed locally into an editable motion template; this is not AI-generated footage or autonomous cinematic direction.

## UAT issue ledger

| ID | Severity | Flow | Finding | Repair and verification | Status |
| --- | --- | --- | --- | --- | --- |
| UI-001 | P2 | STUDIO-09 | Mobile preview minimum height forced the 16:9 box wider than its card | Remove the minimum height; measured no horizontal overflow at 390×844; repeated the mobile flow | Verified |
| UI-002 | P2 | STUDIO-10 | Changing a format setting discarded edited scene text | Keep edited copy when refreshing plan metadata; actual submission retained the edited title with new square dimensions | Verified |

The UI also retains client action/media error messages during polling, prevents concurrent form submissions, reuses idempotency keys after uncertain submission, disables mutating controls while disconnected, and uses plain text DOM insertion for user copy. The shipped UI introduces no new runtime dependency or external network request.

Production/remote exposure, model-based brief interpretation, arbitrary generated footage and customer creative signoff remain separate work. This report accepts the local studio flows above.
