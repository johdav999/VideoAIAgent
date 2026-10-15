---
name: cinetic-windows
description: Direct, author, score, render and critique Cinetic films on native Windows in VideoAIAgent. Use for product films, logo stings, loops, walkthroughs and motion graphics using the repository's Remotion or HyperFrames adapters.
---

# Cinetic on Windows

This repository-local workflow ports Cinetic v1.0.0, revision `91c43acf4ea183ea68861d4cd99ec054f6741876`, MIT. It is loaded explicitly from this file; it is not installed globally. Read [the native command guide](../../docs/windows-cinetic.md) before executing commands. The complete unmodified source and its hashes are in `third_party/cinetic`; shell scripts there are provenance, never executable instructions for Windows.

## Direction and ownership

Direct a short film around one product-specific idea. Picture, copy and sound share one timeline. A render passing technical checks still needs creative review. Follow supplied branding; when inventing a brand, apply the original bans and placeholder checks from [the source workflow](../../third_party/cinetic/release/SKILL.md). Do not remove placeholder markers without replacing the placeholder design.

1. Write `BRIEF.md`: product, audience, promise, format, duration, placement, supplied brand, assumptions and output list. Infer ordinary choices from an adequate brief; ask only for essential missing information.
2. Read `references/concept-and-story.md` under the pinned source. Develop three concepts: the product's verb, the viewer's pain, and a formal device. Apply the ownership and deletion tests. Fill the generated `TREATMENT.md`: logline, hook/turn/proof/promise/lockup, shot path, beat sheet, complete copy and final frame.
3. Read `brand-and-color.md` and `copy-and-type.md`. Build the brand tokens, original mark and offline fonts. Render style frames and check palette contrast and text legibility. Supplied brand exceptions belong in the brief.
4. Read `timing-grid.md`, `motion-tokens.md`, `camera.md`, `transitions.md`, and the selected engine guide. Put every cue, act, duration, copy hold and sound event on the shared timeline. Use declarative data for real product UI; read `product-ui.md` for walkthroughs.
5. Author the composition and score using `sound.md`. Rebuild cues and stems with the native `audio` command. Use the score, synthesis and mastering tools through the adapter. Never claim sound sync from source timing alone.
6. Read `finishing.md` and `chromium-rendering.md`. Render a preview, inspect the actual decoded output, run grid, lint, probe, sync, layout, forensics and strict stem-based audio audits. Generate contact sheets, inspect full-size flagged frames, and retain every report. Declare designed cuts/freezes with reasons, rather than suppressing inconvenient failures.
7. Read `review-loop.md`. Review through director, forensics, sound-sync, art-copy-ui and verifier lenses using the source `assets/critics/*.md` templates. Run lenses sequentially unless the user authorizes parallel critics. Verify every P0/P1 with frame/audio evidence, fix in impact order, record fixes and re-render. Launch films/walkthroughs need at least two rounds; loops/stings at least one; stop after five and report unresolved issues.
8. Score the original eleven dimensions: Idea and device, Hook (0–2 s), Copy and type, Colour and brand, Composition, Motion, Transitions, Pacing, Product truth, Sound and sync, Finish. Minimum 3 each, mean at least 4.2, Finish and Sound and sync 5, no open P0, all technical gates passing. A silent loop may mark sound N/A with a recorded format rationale. Record evidence and human approval separately. The native `review` command validates the evidence ledger; it does not invent critic judgments.
9. Render the final master once direction is settled, run final forensics/audio checks and inspect the fastest blur frames and act boundaries. Use `deliver` for posters, loops, GIF/WebM, alpha stings and explicitly re-laid-out social variants. Use `brand-kit` when a brand was invented. `formats.md` defines the format-specific output list, including authored SRT captions for walkthroughs. Deliver files with their QA manifest; report any incomplete gate explicitly.

## Native execution

From the repository use `npm.cmd run cinetic -- COMMAND --project "data/films/NAME" ...`. Inside a generated film use `node scripts/native.mjs COMMAND ...` or its npm scripts. Use executable paths and argument arrays for orchestration. Never execute upstream Bash, use Unix symlinks, install packages in generated films, or put briefs in shell command text. Generated workspaces use the repository's exact locked dependencies.

The source references describe artistic algorithms and thresholds. Translate their command examples using the native command guide: `render.sh` → `render`, `render-chunks.sh` → `render-chunks`, `hf-finish.sh` → `hf-finish`, `deliver.sh` → `deliver`, `brand-kit.sh` → `brand-kit`, `layout-audit.sh` → `layout-audit`, `grab.sh` → `grab`, and Python tool names → commands of the same basename. All paths and outputs stay in this repository.
