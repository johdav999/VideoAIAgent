# Working in VideoAIAgent

- Build an independent service in this repository; integrate Virtual Company through an API client later.
- Do not fork Cinetic. Keep native Windows adapters here and record upstream provenance when importing any source. Do not silently install a global agent skill.
- Native Windows is the primary acceptance target. User-facing commands must work in PowerShell without WSL, Bash, GNU utilities, or Unix symlinks.
- Use Node.js 22.9+ and prefer Node process/file APIs for portable orchestration. Launch tools with executable paths and argument arrays; do not interpolate video briefs into shell commands.
- Preserve unrelated local changes. Keep secrets, generated media, job workspaces, and local upstream checkouts out of Git.
- Keep job inputs declarative. Future workers must isolate job directories, constrain resources, and persist actual state; never report simulated rendering as success.
- Keep Remotion packages on the same exact 4.x version when introduced, and commit dependency lockfiles.
- Use `npm.cmd run check` and `npm.cmd test` for foundation changes. Port acceptance additionally requires a real Windows render with FFmpeg/ffprobe output evidence.
- Keep docs honest about implemented versus planned capabilities. Foundation CI is not rendering or Azure acceptance.
