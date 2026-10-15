# Native Windows job-service acceptance

Historical API milestone. The later [native Cinetic feature report](windows-cinetic-complete.md) supersedes its CLI/blur limitations; the HTTP contract remains a sharp product-template renderer.

Date: 15 October 2026. Scope: local JSON request to verified MP4, configurable template, durable state, cancellation, restart recovery and retrieval. This succeeds the [initial CLI port milestone](windows-first-render.md).

## Implemented result

The service accepts schema-version-1 `product-launch` specifications, including title, message, call to action, duration, brand colours/name and an optional embedded PNG logo. It persists input before returning 202, runs one bounded worker and exposes measured progress, cancellation, retry and MP4 retrieval. Idempotency keys survive restart. Each render attempt uses a separate directory.

Jobs are atomic JSON records on local disk. The owner lock prevents concurrent service owners; dead-owner recovery preserves accepted work. Successful and failed jobs remain terminal across restarts. Interrupted active work returns to the queue. A queued cancellation never starts rendering.

## Windows evidence

The real acceptance script uses the actual HTTP service, browser, Python audio/QA scripts and FFmpeg. It has no injected renderer. Unit fixtures are tested separately.

The accepted sample is 12 seconds, 1280x720 at 30 fps (360 frames), H.264/yuv420p with BT.709 tagging and stereo AAC at 48 kHz. It uses the request's palette, text and an embedded example PNG monogram. The downloaded bytes match the job's SHA-256:

`f75e027bf25c0c0774770ae8d05baaf91c3884190594ac7746338f42d06f6582`

The host uses Node 24.13.1, Python 3.12.6, FFmpeg/ffprobe 8.0.1, Remotion 4.0.529 and Chrome Headless Shell 149.0.7790.0. Exact npm and Python packages remain locked. Cinetic source remains pinned to v1.0.0 with its MIT notice and SHA inventory; no fork or global skill installation was created.

## Verified flows

| Flow | Observed result |
| --- | --- |
| JSON request with PNG logo | Real MP4, measured progress, correct duration/dimensions and hash-matched download |
| Duplicate idempotency key | Existing job returned; same key/input still matches after restart |
| Queued cancellation | Cancelled with zero render attempts |
| Active cancellation | Owned worker stopped; cancelled job has no downloadable result |
| Completed-job restart | Same successful job, attempt count and MP4 hash retained |
| Interrupted rendering restart | New isolated second attempt succeeds; recovery count increases |
| Queued work behind interrupted rendering | Survives the hard restart and completes in its first attempt |
| Failed-job restart | Failure retained with no automatic retry |
| Explicit retry | Corrected dependency produces a verified second-attempt MP4 |

Raw real-service evidence is retained under ignored `data/api-acceptance-*`: report JSON, server log and downloaded sample. The first complete run is `data/api-acceptance-1792095080422`. Final-source acceptance passed under `data/api-acceptance-1792095560616`, including queued-job recovery; its `sample.mp4` is the downloaded, hash-verified output. Each job points to its complete input/treatment, render log, frozen bundle and QA reports in its `data/films/job-*` directory.

`npm.cmd run check` includes JavaScript syntax, template TypeScript, matching Remotion versions and original-source hashes. `npm.cmd test` covers validation, idempotency/conflicts, exclusive store ownership, persistence/retry, dead-owner recovery, byte ranges, request errors and process cleanup. HTTP unit tests use explicit fixture bytes; these are never reported as real video acceptance.

## Template quality

The new artwork uses supplied brand tokens and local Geist fonts, with three text acts, timed audio and an advancing beat/progress strip through the ending. Section text fades out before the next section arrives. This fixes the old long static hold and the first version's abrupt seam changes.

The real API sample passed upstream score, grid, audio-sync and encoded-output probes, plus film lint with no placeholder-brand errors and pixel forensics with no failing findings. Its 24-frame contact sheet was inspected at half-second intervals: supplied copy/logo render without clipping, section changes are clean, and the footer continues moving through the end. The final-source output has the same byte hash as the visually inspected sample. This is frame inspection and automated audio analysis, not subjective playback/sound approval. It has `technicalQaPassed: true`, `creativeQaPassed: true` and `shipReady: false`.

## Remaining boundaries

This is a local service with one worker and local-disk persistence. It has no distributed queue, cloud deployment, remote-client authentication, AI direction, Virtual Company client or automatic media retention. Motion blur is not implemented. The original manual CLI starter is retained for authoring and still has its historical creative findings.
