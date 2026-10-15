# Native Windows Cinetic feature acceptance

Date: 15 October 2026. Target: Cinetic **v1.0.0**, commit `91c43acf4ea183ea68861d4cd99ec054f6741876`. The complete pinned source is retained with MIT attribution and 141 file hashes; there is no Cinetic fork or global agent-skill installation. Later upstream revisions are outside this release's acceptance boundary.

The remaining release features are implemented through the [native command guide](../windows-cinetic.md) and [repository-local directing skill](../../skills/cinetic-windows/SKILL.md). This supersedes the feature limitations in the first-render and job-service milestone reports.

## Measured result

`npm.cmd run check` and all **15 tests** pass. The real Windows feature suite passes **33 cases**, including expected rejection cases, both preview servers, decoded alpha pixels, and a complete adaptive-blur master. No render result is simulated. The separate real HTTP regression passes all **8 scenarios**: submission/hash retrieval, queued cancellation, completed-artifact/idempotency restart, interrupted-job recovery, queued-job recovery, active cancellation, persisted failure and explicit retry.

Host: Windows x64; Node 24.13.1; Python 3.12.6; FFmpeg/ffprobe 8.0.1; Chrome Headless Shell 149.0.7790.0. Remotion packages are all 4.0.529; HyperFrames 0.8.79; GSAP 3.14.2. The full package set requires Node 22.12+ because its locked Puppeteer version requires that minimum.

The tracked [machine-readable summary](windows-cinetic-summary.json) records the actual cases, hashes, ffprobe facts and alpha/preview checks. Full local logs and generated media are intentionally ignored by Git:

- `data/native-acceptance-1792097620163/results.json`, per-case logs, `previews.json`, `alpha.json`.
- `data/films/Acceptance ö 1792097620163/out/`: Remotion renders, source bundles, QA, delivery and brand files.
- `data/films/Acceptance HF ö 1792097620163/out/`: HyperFrames PNG captures, blurred master, QA, delivery and snapshots.
- `data/api-acceptance-1792097201820/report.json`: all eight HTTP/restart scenarios and the actual retrieved MP4.

## Feature coverage

| Pinned upstream surface | Native implementation | Windows evidence |
| --- | --- | --- |
| `new-film.sh`, both starters | Node file/process APIs, central locked dependencies, exclusive names, dimensions/grid rewriting, local GSAP/fonts; no symlinks | Both engines created in paths containing spaces and `ö`; overwrite/reserved-name tests |
| `render.sh` preview/master | Frozen bundle, metadata selection, explicit browser, muted picture plus checked audio mux | 640×360/30 preview and full blurred master, 270 frames/9 s, AAC stereo 48 kHz, all four BT.709 fields |
| Adaptive blur and high bit depth | Optical flow, budget/floor controls, sample reuse/re-budget, act-clamped subframes, float accumulation and dither | Complete 270-frame master plus 20-frame `yuv420p10le` excerpt; sample-floor and reused-sample cases |
| Excerpts and audio offsets | Inclusive ranges, audio trim based on absolute frame index, silence and explicit tracks | Two-chunk 15–44 excerpt with default offset and sync gate; silent 20–39 blur excerpt |
| `render-chunks.sh` | Independent Node/Chromium processes at concurrency one, ordered concat and exact count | Two real chunk encodes joined to the expected 30 frames |
| `hf-finish.sh` | Timeline/root preflight, zero-error lint, layout check, PNG count/opacity, uniform accumulation, mux/sync/probe | 5-second/150-frame master, 300 source captures at 2×, mastered audio; snapshots and preview HTTP |
| Delivery posters | Clean Remotion/HF source comparison with measured master fallback | Clean loop poster; deliberate missing-entry fallback; HF blurred-last-frame mismatch truthfully falls back |
| Loop/GIF/WebM | Muted MP4, seam gate, two-pass GIF, VP9 with optional Opus | Seamless 60-frame loop; 320×180/25 fps/50-frame GIF; VP9; non-looping original rejected |
| Alpha and social delivery | ProRes 4444, VP9 alpha, excerpt/props support, registered re-layout compositions | 8-frame alpha exports; square 320×320 and portrait 320×568 videos; decoded alpha is 93.9%/93.8% transparent and retains opaque artwork |
| `brand-kit.sh`, `brand-svg.ts`, `outline-text.py` | Local Python shaping, React SVG mark, path-outlined wordmark, PNG sizes, alpha crop, avatar/header | Light/dark SVG and PNG kits; 16/32/512/1024 marks; real lockup/alpha inspection; Unicode text outlined |
| `add-font.mjs` | npm JavaScript entrypoint, Node tar extraction, local copies/licence, role/token updates | Local Geist for both engines; separately fetched and extracted pinned Manrope 5.3.0 without installation or GNU tar |
| `layout-audit.sh` | COPY/CUE/act/explicit sampling, audit browser output, safe zones and normalized text speed | Real adjacent stills pass at frame 180; deliberately invalid safe area fails |
| `grab.sh`, `sheet.py` | Array-based FFmpeg and native Remotion dispatch | Cropped/resized frames, EOF rejection, encoded-video sheet and composition-mode sheet |
| Score/synthesis/mastering | Explicit local interpreter, original score/stem/master algorithms | Both engines synthesize and master actual WAVs; encoded audio passes sync; strict stem-based A/V audit runs |
| `av-audit.py`, `forensics.py` | Original analysis, local dependencies, repository-scoped Unicode image I/O | Actual encoded starter: zero failing audio/forensics checks; warnings retained rather than hidden |
| `palette.py`, `dither-gradient.py` | Original numerical/image algorithms | Accepted blue palette, rejected unsupplied orange palette, dithered gradient PNG and diagnostic preview |
| `lint-film.mjs`, `grid-check.ts` | Direct Node/tsx processes | Actual timing grid checked; unchanged starter placeholder lint correctly rejects the sample as unbranded |
| Direction/reference/critic workflow | Explicit repository skill with original reference library and templates; evidence/rubric ledger validation | Skill validator passes; unit checks reject missing evidence, low scores and open P0; no fabricated creative approval |
| Process/state behavior | Owned worker trees, deadline, shared render lock, per-command state, isolated work directories | Both preview servers served HTML then their exact owned trees were cancelled; existing process and HTTP restart/cancellation tests pass |

The configurable product template also registers the attributed Cinetic `FilmSub` implementation. A real native 20-frame blur render of that template passed; its HTTP contract remains unchanged and uses sharp renders.

## Windows defects resolved

1. Windows FFmpeg lacks the upstream image-sequence glob demuxer. The adapted accumulator uses an ordered concat manifest and explicit input frame rate.
2. OpenCV's filename APIs failed for Unicode paths. A child-local Python adapter uses file bytes with `imdecode`/`imencode`; brand cropping, contact sheets and image QA now work in those paths.
3. The tested FFmpeg encode omitted H.264 transfer/primaries fields. The finish step explicitly writes limited-range BT.709 bitstream metadata, verified by ffprobe in both 8-bit and 10-bit outputs.
4. Python composition sheets attempted `.cmd`/`npx` dispatch and browser downloads. Generated copies now invoke the locked JavaScript CLI and configured executable with argument arrays.
5. Font extraction and outlined SVGs assumed GNU tar, `npm` shell dispatch, `python3`, and film-local modules. They now use Node tar, npm's JavaScript executable, the explicit interpreter and repository dependencies.
6. HyperFrames assumes home-based cache/config paths. A child-only preload places that state under the film's ignored output directory; telemetry, global skill installation and automatic remote snapshot descriptions are disabled.

## Acceptance boundary

This accepts the native tooling and directing workflow for the pinned release. It does not declare the sample to be a finished customer film: the source starter intentionally retains its placeholder brand, lint catches those markers, and its strict audio audit retains two warnings. Contact sheets, a decoded blur frame and the cropped lockup were inspected. Human creative approval is still separate.

The native adapter deliberately centralizes dependencies, rejects destructive scaffold overwrite, and retains work/temporary files for diagnosis. These replace upstream installation/symlink/cleanup choices; the command guide records the differences. The skill runs critic lenses sequentially unless parallel work is explicitly authorized.

Hosted model orchestration, a VC API client, Azure storage/queues/deployment, production exposure and later upstream features are separate work. Foundation CI is not render or cloud acceptance.
