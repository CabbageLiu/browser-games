# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A personal collection of small browser games written as plain static HTML/CSS/JS. **No build step, no package manager, no tests, no dependencies** — every file runs directly in the browser.

## Running a game

Each game opens by pointing a browser at its `index.html`:

```
open index.html               # Tetris (root, single file)
open shooter/index.html       # Top-down shooter
```

There is no dev server or file watcher. Edit a file and refresh the browser.

## Layout convention

- Tiny single-file games live at the repo root (e.g. `index.html` is Tetris).
- Larger games get their own subfolder containing `index.html`, `style.css`, `game.js` (e.g. `shooter/`).
- All visuals are programmatic canvas drawing — no images, audio, or font files are checked in.
- When adding a new game, follow whichever pattern fits its size. Do not introduce build tooling, package managers, or external asset downloads without asking.

## Shooter architecture (`shooter/game.js`)

A single ~600-line file organized into labeled `// ===== ... =====` sections (constants, state, init, input, spawning, update, render, HUD, main loop) — grep for those headers to navigate.

The game is a **state machine**: `title → playing → levelClear → ... → victory | gameOver`. The main loop always runs `render()` and `updateHud()`, but `update(dt)` runs only while `state === 'playing'`. `dt` is clamped to 33 ms so tab-switches don't teleport entities.

**Levels are pure data.** Each entry in `LEVELS` is a list of waves where each wave has a `delay` (seconds since level start) and `[type, count]` pairs. Triggering a wave doesn't spawn enemies directly — it pushes "spawn markers" (fading triangles drawn inside the canvas) that convert into real enemies when their timer expires. The level-clear check therefore watches `enemies`, `spawnMarkers`, and `waveQueue` together.

**Entities are plain object literals** in flat arrays (`enemies`, `playerBullets`, `enemyBullets`, `particles`, `spawnMarkers`). No classes. Enemy behavior branches on `e.type` inside the enemy update loop. To add a new enemy, add an entry to `ENEMY_TYPES`, a render branch in `drawEnemy()`, and (if its movement isn't a plain chase) a behavior branch in the update loop.

## Workflow

Personal project on `main` — focused commits go directly to `origin/main`, no PRs.

```
git add <files>
git commit -m "<imperative subject>"
git push
```

Commit messages include the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer per the Claude Code system prompt.
