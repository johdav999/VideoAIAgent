# Development milestones

## 0. Repository foundation

- [x] Separate VideoAIAgent repository with GitHub origin.
- [x] Source boundaries, Windows instructions and sample brief.
- [x] Local health endpoint and executable diagnostics.
- [x] Service smoke test and Windows/Linux CI definition.

## 1. Cinetic on native Windows

- [x] Record Cinetic v1.0.0 source/licence/hashes; no fork.
- [x] Inventory dependencies and Bash/Unix assumptions for the Remotion path.
- [x] Implement native scaffolding, preview and sharp-master rendering.
- [x] Pin Remotion 4, Python packages and managed browser setup.
- [x] Render and inspect MP4 samples with audio and technical QA on Windows.
- [x] Exercise dependency failure, invalid browser, cancellation, timeout and successful retry.
- [ ] Extend the adapter to motion blur, frame ranges and other upstream options.
- [ ] Replace starter artwork and pass creative/ship gates for a customer film.

The first local render milestone is accepted; this is a supported subset, not full Cinetic parity. See [evidence and limitations](acceptance/windows-first-render.md).

## 2. Video production API

- [ ] Define versioned video specifications and OpenAPI contract.
- [ ] Add durable job state, queue and one bounded worker.
- [ ] Submit a specification, monitor it and retrieve a verified MP4.
- [ ] Handle failures, cancellation, retries and process restarts.

## 3. Virtual Company integration

- [ ] Add a VC client and Video Production Agent in the VC solution.
- [ ] Connect submission, status, previews and output retrieval.
- [ ] Add authentication and prove an end-to-end VC request.

## 4. Production and reusable workflows

- [ ] Add branded templates, previews and revision approval.
- [ ] Add Azure Blob Storage and production queue/worker deployment.
- [ ] Choose container/cloud rendering separately from native Windows acceptance.
- [ ] Validate licensing, observability, resource limits and retention for the chosen deployment.
