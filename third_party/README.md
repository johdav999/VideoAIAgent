# Third-party source

`cinetic/` contains a reviewed subset of [Leonxlnx/cinetic v1.0.0](https://github.com/Leonxlnx/cinetic/tree/91c43acf4ea183ea68861d4cd99ec054f6741876), commit `91c43acf4ea183ea68861d4cd99ec054f6741876`.

The source is original, with canonical LF line endings. See `cinetic/LICENSE` for the MIT licence and `cinetic/provenance.json` for the complete SHA-256 inventory. Native wrappers are implemented in `src/cinetic-adapter` and `src/renderer`. They adapt generated copies rather than editing this source.

Imported surfaces: Remotion starter, cue/grid/film-lint scripts, score/synth/master, probe/sync checks, and encoded-video contact sheets/forensics helpers. The starter's original package/config files are retained for provenance; the adapter uses the repository's locked packages and explicit render API settings instead of running its Bash npm scripts.

No Cinetic fork or global skill installation is used. To reproduce the import, check out the exact commit locally under ignored `external/cinetic`, then run `node scripts/vendor-cinetic.mjs`. Do not edit vendored files to bypass a failing hash check.
