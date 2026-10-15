# Local rendering worker

`render-film.mjs` owns the exclusive render lock, process timeout, cancellation, log and durable status. `render-worker.mjs` freezes a Remotion bundle, synthesizes the Cinetic score, renders muted picture, muxes AAC with FFmpeg and runs upstream technical gates before publishing a unique MP4 filename.

Preview and sharp master modes are implemented. All Remotion packages are pinned to 4.0.529; browser setup records the executable and version. Technical success has `shipReady: false`; creative lint/forensics failures are reported separately.

The local HTTP job manager invokes this worker for a fixed, validated product-launch template. The separate native authoring adapter in `src/cinetic-adapter/native-*.mjs` supports adaptive blur, ranges, chunks, HyperFrames and delivery. CLI authoring is trusted local code; the API accepts declarative inputs. The disk-backed queue, recovery and retrieval live under `src/jobs` and `src/api`. Distributed deployment remains planned.
