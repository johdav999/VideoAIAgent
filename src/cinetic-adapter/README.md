# Cinetic Windows adapter

`workspace.mjs` verifies pinned Cinetic source hashes and scaffolds independent film workspaces under `data/films/`. It adapts timeline settings using Node file APIs without Bash or symlinks. It rejects unsafe Windows names and refuses to overwrite existing films.

Cinetic v1.0.0 source/licence/provenance live under `third_party/cinetic`; no fork or global skill installation is used. See [the port plan](../../docs/windows-port.md) for supported scope and remaining work.
