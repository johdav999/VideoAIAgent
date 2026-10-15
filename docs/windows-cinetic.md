# Cinetic v1.0.0 on native Windows

The native adapter covers both engines, rendering modes, delivery tools and the directing/review workflow of Cinetic **v1.0.0**, commit `91c43acf4ea183ea68861d4cd99ec054f6741876`. This is the same release originally selected for this repository. It does not claim parity with later, unreviewed upstream revisions. No fork, global agent skill, Bash, WSL, GNU tar or Unix symlink is involved.

Original files remain unchanged under `third_party/cinetic/release`, alongside the earlier runtime subset. `provenance.json` hashes all 141 retained files. Native orchestration lives in `src/cinetic-adapter/native-*.mjs`. Extracted helper algorithms identify their source shell file; `scripts/generate-native-helpers.mjs` reproduces them. Generated workspace scripts are adapted copies, never the provenance originals. The product template also reuses the original `blur.ts` and `FilmSub.tsx` from the attributed Remotion starter.

## Setup

Use PowerShell from this repository:

```powershell
npm.cmd ci
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements-render.txt
npm.cmd run browser:install
npm.cmd run doctor:render
```

Accepted host: Windows x64, Node 24.13.1, Python 3.12.6, FFmpeg/ffprobe 8.0.1, Chrome Headless Shell 149.0.7790.0. The full toolset needs Node 22.12+ because the locked HyperFrames Puppeteer dependency requires it. All Remotion packages are exactly 4.0.529; HyperFrames is 0.8.79 and GSAP 3.14.2. The repository lockfile owns dependencies for every film. `PYTHON_PATH`, `REMOTION_BROWSER` and `CHROMIUM_PATH` support explicit executable overrides. Font fetching uses npm's JavaScript entrypoint and the locked Node `tar` library; it never calls a `.cmd` file through a shell or installs into a shared film directory.

## Author a film

```powershell
npm.cmd run cinetic -- new --name "Windows rörelse" --size 1920x1080 --fps 60 --bpm 120
npm.cmd run cinetic -- new --name "HTML rörelse" --engine hyperframes --size 1920x1080 --fps 60
```

Projects live directly under ignored `data/films`. Names allow spaces and Unicode. Creation is exclusive and never overwrites a film. The native replacement for upstream `--link-modules` and per-film installation is central dependency resolution; no symlink or installation is needed. Destructive upstream `--force` is intentionally replaced by choosing a new workspace name.

Scaffolding retains the repository's resource bounds: even dimensions from 320×180 up to 3840×2160, 24–60 integer fps, and 60–180 integer BPM giving whole-frame beats. `new` also accepts an explicit browser executable and repeated `--font` families. Other compositions can be authored locally; render concurrency and duration deadlines remain bounded.

Load [the repository-local Cinetic skill](../skills/cinetic-windows/SKILL.md) explicitly to direct a film from a brief. It carries intake, three concepts, treatment, brand/type, timeline, real product UI, scoring, critique, verification, revision and delivery instructions. The full reference library and critic templates remain available with provenance. This supplies an agent workflow; it does not introduce a hosted model API or silently install a global skill.

The examples below run **inside the generated film directory**. From the repository root, replace `node scripts/native.mjs` with `npm.cmd run cinetic --` and add `--project "data/films/Windows rörelse"`.

```powershell
node scripts/native.mjs cues
node scripts/native.mjs audio
node scripts/native.mjs render Film out/preview.mp4 --preview
node scripts/native.mjs render Film out/master.mp4 --blur --budget 6
node scripts/native.mjs render Film out/excerpt.mp4 --blur --frames 120-179 --samples-from out/samples.json --10bit --no-audio
node scripts/native.mjs render-chunks Film out/sharp.mp4 --chunks 2
```

`render` accepts inclusive frame ranges, custom entry/composition/sub-composition, JSON props, explicit audio or silence, audio offset in timeline frames, CRF, preview/master, concurrency 1–4, adaptive blur, sample reuse, re-budgeting and repeated `--floor A-B:N`. `--measure` takes a **JSON argument array**, for example `'["--min","4","--max","16"]'`; it is never evaluated by a shell. `--10bit` requires blur. Additional Remotion arguments follow `--`. Chunk mode renders separate browser processes at concurrency one and concatenates the frozen bundle's independently encoded ranges. Each mode checks exact frame count. The default soundtrack is `public/audio/soundtrack.wav`; use `--build-audio` to create it first.

BT.709 limited-range conversion, primaries and transfer tags are explicit, including H.264 bitstream metadata. Blur averages at float precision and quantizes once, with upstream gradient-aware dither. FFmpeg muxes AAC stereo/48 kHz/320 kbps after precise trim/pad; sync and probe gates inspect the actual result. `--no-check` explicitly skips those gates and is recorded in the render report.

Each command owns its worker tree and has a one-hour deadline. Ctrl+C cancels descendants. Render/audio/delivery mutations share `.render.lock` with the service renderer; a second command cannot mutate that film concurrently. Success, failure and cancellation are written to `native-status.json`. After a hard crash, inspect the lock PID/start time and confirm the process stopped before deleting that one lock file. Unique work directories and bundles are retained under `out/work` for diagnosis; `--keep` is accepted for upstream compatibility, and retention is the native default. Nothing recursively deletes a film or its evidence.

## HyperFrames

```powershell
node scripts/native.mjs cues
node scripts/native.mjs audio
node scripts/native.mjs hyperframes lint --json
node scripts/native.mjs hyperframes check
node scripts/native.mjs hyperframes snapshot --at 1,2,3 --output out/snapshots
node scripts/native.mjs hf-finish out/preview.mp4 --preview
node scripts/native.mjs hf-finish out/master.mp4 --audio public/audio/soundtrack.wav --blur 2
```

Scaffolding vendors GSAP and the local font. Preflight compares root metadata to the shared timeline and checks local script/font files. Finishing enforces zero lint errors, runs layout check unless explicitly skipped, captures lossless PNGs, checks frame count and end-frame opacity, accumulates uniform blur when selected, muxes sound and runs sync/probe. Capture fps is capped at 240. Options include output fps, workers 1–4, shutter, CRF, alternate HTML composition, strict variable JSON, transparency override and JSON report path. `--export-cues FILE` exports without rendering. Existing HyperFrames composition audio is preserved if no explicit mastered track is supplied, and the report labels it unmastered.

Windows FFmpeg builds without glob support use an ordered concat manifest for image sequences. OpenCV image tools receive a repository-scoped Unicode file adapter through the worker's `PYTHONPATH`; no global Python customization is installed. HyperFrames telemetry and skill installation are disabled. Its home-based cache/config paths are scoped to `out/hyperframes-home` by a child-only Node preload; the user's profile and environment are unchanged. Snapshot vision descriptions default off; screenshots stay local.

## Delivery, brand and fonts

```powershell
node scripts/native.mjs deliver out/master.mp4
node scripts/native.mjs deliver out/loop.mp4 --comp Loop --loop --gif --webm --gif-width 960
node scripts/native.mjs deliver out/sting.mp4 --alpha StingAlpha,StingClear --alpha-webm
node scripts/native.mjs deliver out/master.mp4 --variants Film9x16,Film1x1 --variant-samples out/samples.json
node scripts/native.mjs brand-kit --x-header --avatar dark
node scripts/native.mjs add-font geist --role text
node scripts/native.mjs add-font "@fontsource-variable/manrope@5.3.0" --role text
```

Author and register alpha/social compositions first. Variants are actual re-layouts, not automatic crops. Alpha delivery supports frame ranges, JSON props, ProRes 4444 and VP9 alpha. Brand kits include outlined light/dark SVG marks and lockups, transparent PNG marks at 16/32/512/1024, cropped lockups, avatar and optional X header. Supplied logo fonts can be selected explicitly.

Posters first try a clean source matching the master's frame. A stale source or a blurred final frame may fail the pixel comparison; the adapter then retains the decoded-master fallback and explains it in `qa/manifest.json`. GIF size warnings remain in that manifest. A failed loop seam makes the delivery command fail. QA files remain below `qa`.

Font vendoring preserves licences, copies upright local faces, updates tokens and clamps weights. Network fetches are only needed for a family not already installed or an explicitly requested version. HyperFrames receives local font files and a printed CSS block to apply. Font role, `--no-tokens`, `--brand-supplied` and `--dry-run` pass through to the adapted tool.

## QA and utility coverage

```powershell
node scripts/native.mjs grid-check
node scripts/native.mjs lint
node scripts/native.mjs layout-audit Film --cues --speed --safe wide16x9
node scripts/native.mjs grab out/master.mp4 --frames 0,120-124 --crop 640:360:0:0 --width 320
node scripts/native.mjs sheet out/master.mp4 --every 30 --out out/qa/sheet.png
node scripts/native.mjs sheet --comp Act1 --from 0 --to 119 --every 30 --out out/qa/act.png
node scripts/native.mjs forensics out/master.mp4 --cues out/cues.json --json out/qa/forensics.json
node scripts/native.mjs av-audit out/master.mp4 --cues out/cues.json --stems out/stems --json out/qa/av.json
node scripts/native.mjs palette --accent '#1F86CD' --json out/qa/palette.json
node scripts/native.mjs dither-gradient --spec backdrops.json --out public/fx
```

Layout QA supports COPY/CUE/explicit frames, act-relative timelines, custom props, safe presets/insets/JSON, normalized text-speed checks and retained audit stills. Missing browser audit output is a failure. Grab rejects frames past EOF. Video and composition contact sheets both use native commands and the configured browser.

`probe`, `check-sync`, `measure-speed`, `accumulate`, `outline-text`, `score`, `synth` and `master` also pass argument arrays to the local Python interpreter. Each tool's `--help` describes its original algorithm options. `remotion` and `hyperframes` provide explicit native CLI passthrough for trusted local authoring, preview and still workflows. Source code is never accepted through the job API.

`review FILE.json` validates a recorded critic/evidence ledger and writes `out/qa/review.json`. Required fields are `round` (1–5), `scores` (the original eleven rubric names), `lenses` (director/forensics/sound-sync/art-copy-ui/verifier, each with `evidence` paths), `issues`, and `gates` (each with `pass` and `report`). Human approval is explicit via `humanApproved`; passing automation alone does not imply approval. A muted loop may set its sound score to `"N/A"` with `format: "loop", muted: true`.

## Test boundary

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run test:cinetic
npm.cmd run test:api-render
```

See [the feature acceptance report](acceptance/windows-cinetic-complete.md). `test:cinetic` renders actual media on Windows and keeps reports/logs under `data/native-acceptance-*`. It can resume a failed run by passing its evidence directory. CI runs foundation tests; it does not imply real rendering, subjective customer-film approval, VC integration or Azure acceptance. The declarative local API retains its existing sharp product-template contract; the full native authoring surface is the Cinetic CLI/skill.
