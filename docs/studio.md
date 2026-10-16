# Local video studio

Start the prepared repository from PowerShell:

```powershell
Set-Location "C:\Users\Johan\source\repos\VideoAIAgent"
npm.cmd start
```

Open [http://127.0.0.1:4310/](http://127.0.0.1:4310/). The UI and API use the same local server; there is no separate frontend build or provider account to configure. Use [Windows setup](windows-cinetic.md#setup) if renderer dependencies are not installed yet.

1. Enter the message for the video and your brand name. Choose length, landscape/portrait/square, and a color mood.
2. Optionally open **Edit scene copy** and prepare the three scenes. Edit the opening, main message and call to action.
3. Click **Generate video**. Follow measured prepare/render/check progress, then play the MP4 in the preview or download it.

Example brief:

> Work better together. Bring plans, people and priorities into one place. Start building today.

You can also specify the scenes directly:

```text
Title: Launch with confidence
Message: Keep your team moving together
CTA: Start today
```

The current studio uses the existing product-launch motion template. A local extractive planner shortens your wording into three scenes; it does not use an AI model to interpret visual directions or generate footage. All scene copy remains editable. The template adds typography, motion and a synthesized soundtrack. Final creative review belongs to the viewer.

Long copy is shortened for the selected reading time. Edited copy must fit the existing API's 28-word total and reading-time limits. The brand name allows up to four words. The UI offers 8/12/20/30 seconds at 30 fps, 1280×720 landscape, 720×1280 portrait and 1080×1080 square. Color moods use validated contrasting palettes.

## Jobs and recovery

- Recent videos are read from durable server records. Selecting one restores its progress or preview.
- The selected job and original brief/settings are saved in browser-local storage when available. Reloading or leaving the page does not stop a render.
- **Cancel generation** stops the selected queued/active job. **Retry video** creates another isolated attempt for a failed/cancelled job, with the same submitted scene copy.
- A failed render shows an error and no successful preview. Connection loss is distinguished from job failure; polling reconnects automatically.
- Generation submissions use idempotency keys to avoid duplicates when a request is repeated after a network error. Creating another video intentionally creates a new job.
- Download/playback use the existing MP4 endpoint with byte ranges. Generated media, logs and job stores remain under ignored `data/`.

The service binds to loopback and serves a fixed asset allowlist, a local font and a restrictive content security policy. No external CDN, font, telemetry or model request is introduced by the UI. Briefs are treated as text and declarative data, never commands or executable compositions.

## Brief planning API

`POST /v1/video-plans` accepts JSON `{brief, brandName?, durationSeconds?, format?, palette?}`. It returns `{method, specification, notice, shortened}` without submitting a job. `method` is `local-extractive-v1`; `specification` is compatible with the unchanged `POST /v1/video-jobs` contract. `shortened` lists copy fields condensed from the supplied text.

See [OpenAPI](openapi.yaml), [local API](local-api.md) and [Windows studio acceptance](acceptance/windows-studio.md).
