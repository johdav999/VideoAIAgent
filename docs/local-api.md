# Local video job service

Start from the prepared Windows repository with `npm.cmd start`. The service listens on `127.0.0.1:4310`, runs one render at a time and persists accepted input before returning 202.

The [OpenAPI contract](openapi.yaml), [input schema](video-specification.schema.json) and [sample input](../examples/product-launch.json) describe version 1. This service is intended for local clients; it binds to loopback, checks Host/Origin and does not enable cross-origin browser access.

## Submit and download from PowerShell

```powershell
$body = Get-Content examples/product-launch.json -Raw
$job = Invoke-RestMethod http://127.0.0.1:4310/v1/video-jobs -Method Post -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -Headers @{ 'Idempotency-Key' = 'my-first-video' }
$job

do {
  Start-Sleep -Seconds 1
  $job = Invoke-RestMethod "http://127.0.0.1:4310/v1/video-jobs/$($job.id)"
  $job | Select-Object id,state,progress
} while ($job.state -notin @('succeeded','failed','cancelled'))

if ($job.state -eq 'succeeded') {
  New-Item -ItemType Directory -Path data/downloads -Force | Out-Null
  Invoke-WebRequest "http://127.0.0.1:4310$($job.result.url)" -OutFile data/downloads/my-first-video.mp4
}
```

To include a PNG logo, build the request before submission:

```powershell
$spec = Get-Content examples/product-launch.json -Raw | ConvertFrom-Json
$logo = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path examples/logo.png)))
$spec.brand | Add-Member -NotePropertyName logoDataUrl -NotePropertyValue "data:image/png;base64,$logo"
$body = $spec | ConvertTo-Json -Depth 10
```

The included `logo.png` is an example VC monogram created locally for testing, not an official brand asset. Supply your own embedded PNG for a real production. Logo inputs are limited to 256 KiB and 2048 pixels per side; remote URLs, SVG and filesystem paths are rejected. Text is rendered as text rather than executable markup/code.

## Jobs and lifecycle

| Request | Behavior |
| --- | --- |
| `POST /v1/video-jobs` | Validate, persist, return job/Location |
| `GET /v1/video-jobs?limit=50` | List newest jobs, maximum 100 per response |
| `GET /v1/video-jobs/{id}` | Status, progress, input summary and result URL |
| `POST /v1/video-jobs/{id}/cancel` | Cancel queued work or stop the active worker |
| `POST /v1/video-jobs/{id}/retry` | Explicitly retry a failed/cancelled job with its original input |
| `GET` or `HEAD /v1/video-jobs/{id}/video` | Retrieve successful output; GET supports a single byte range |

Use a fresh idempotency key for a different request. Repeating a key with the same normalized input returns the existing job, including after restart. Reusing it with different input returns 409. Failed/cancelled jobs remain terminal until explicit retry. Cancelling an already succeeded/failed job returns 409.

Public states are `queued`, `preparing`, `rendering`, `verifying`, `cancelling`, `succeeded`, `failed`, and `cancelled`. Progress reflects measured renderer events with stage weights, not elapsed time or an ETA. `result` appears only after a real MP4 passed technical gates. Creative QA is reported separately and `shipReady` remains false pending human approval.

## Persistence and restart recovery

Records are atomic JSON files under `data/service/jobs`. `VIDEO_DATA_DIR` can select a separate store. One owner lock protects each store. The local filesystem must support atomic rename and be used by only this service instance; network shares/distributed queues are outside this implementation.

Normal shutdown stops the active worker and leaves its job queued. On restart, interrupted active states return to the queue with an increased recovery count, while a persisted cancellation completes as cancelled. Every attempt gets a new `data/films/job-{id}-{attempt}` directory. Completed and failed records are retained and never automatically replayed. An owned render worker watches its parent and stops its tree if the parent exits; Windows acceptance also verifies a hard service/process-tree restart.

Successful MP4s, their SHA-256 values and result paths remain in the same checkout. Keep the store and film directories together. Removing media makes retrieval return 410; it does not fabricate success. The store has no automatic history/media retention policy. Current limits are 100 unfinished jobs, one active worker, 6-30 seconds, 30/60 fps, up to 1080p pixels, 28 user copy words plus seven template label words, and a 1 MiB JSON body. Invalid or unreadable specifications return 400 before a job is accepted.

## Verification

`npm.cmd test` uses isolated unit fixtures for HTTP/state/process behavior. `npm.cmd run test:api-render` performs real rendering, cancellation, hard restart, failed-job persistence, explicit retry and MP4 hash retrieval on Windows. It writes local evidence under `data/api-acceptance-*` and never uses an injected renderer.

Virtual Company integration, hosted AI direction, remote-client authentication and Azure storage/deployment remain future work. This HTTP contract uses sharp renders; the [native Cinetic CLI and local directing skill](windows-cinetic.md) support motion blur and the full pinned release's authoring tools.
