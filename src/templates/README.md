# Video templates

`product-launch` is the version 1 template: title, message and call to action, with supplied brand colours/name, optional embedded PNG logo and 6-30 second timing. Local Geist fonts are used. Its advancing beat/progress system replaces the starter's static ending; section exits are frame-driven.

`create-product-film.mjs` creates isolated generated copies from validated job inputs and adds the pinned Cinetic audio/QA scripts and licence. `lib/FontGate.tsx` is adapted from MIT Cinetic and carries attribution. No user-supplied JavaScript/TypeScript, URLs or filesystem paths are accepted through the job API.

`blur.ts` and `FilmSub.tsx` reuse the original MIT Cinetic v1.0.0 Remotion starter files, recorded under `third_party/cinetic/provenance.json` at revision `91c43acf4ea183ea68861d4cd99ec054f6741876`. The native authoring CLI can render this template's registered `FilmSub` composition with adaptive blur; the HTTP request contract retains its sharp renderer.
