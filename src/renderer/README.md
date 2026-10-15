# Local rendering worker

`render-film.mjs` owns the exclusive render lock, process timeout, cancellation, log and durable status. `render-worker.mjs` freezes a Remotion bundle, synthesizes the Cinetic score, renders muted picture, muxes AAC with FFmpeg and runs upstream technical gates before publishing a unique MP4 filename.

Preview and sharp master modes are implemented. All Remotion packages are pinned to 4.0.529; browser setup records the executable and version. Technical success has `shipReady: false`; creative lint/forensics failures are reported separately.

This is a local trusted-author CLI, not an HTTP render service or executable-code sandbox. Motion blur and the durable production job queue remain planned.
