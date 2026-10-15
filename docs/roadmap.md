# Development milestones

## 0. Repository foundation

- [x] Separate VideoAIAgent repository with GitHub origin.
- [x] Source boundaries, Windows instructions and sample brief.
- [x] Local health endpoint and executable diagnostics.
- [x] Service smoke test and Windows/Linux CI definition.

## 1. Cinetic on native Windows

- [ ] Select and record an upstream release/commit; no fork.
- [ ] Inventory dependencies and Bash/Unix assumptions.
- [ ] Implement film scaffolding and rendering entry points here.
- [ ] Pin Remotion 4, Python packages and browser setup.
- [ ] Render and inspect a sample MP4 with audio and QA evidence on Windows.

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
