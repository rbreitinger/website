# Yorokobi Games — Project Context

> **This file is the authoritative reference for all Claude sessions.**
> Read it fully before touching any code. When in doubt about game mechanics,
> controls, or existing behaviour — **ask the developer, never invent.**

---

## 1. Project Overview

A personal hobby web game portal. All content is free. No ads, no tracking,
no third-party scripts. Tech stack is plain HTML / CSS / JavaScript — no
frameworks, no build tools, no npm.

**Live site root:** files are served from a flat web host. No server-side logic.

**Developer coding language:** FreeBASIC (desktop games); vanilla JS/HTML for
the web portal. Code style is procedural, not object-oriented.

---

## 2. Directory Structure

```
/                           ← site root
  index.html                ← main portal (hub, routing, game catalogue)
  game.html                 ← standalone game player (new shell, v2)
  favicon.ico
  assets/
    img/
      head/logo.png         ← brand logo
      thumbs/               ← game thumbnail images  (e.g. snake.png)

  webgames/                 ← all browser games live here
    shell.html              ← legacy shell wrapper (iframe host)
    shell.js                ← legacy shell logic
    flappy/
      flappy.js
      flappy_atlas.png
      flappy_sky.png
      flappy_flap.ogg
    breakoutv2/
      breakoutv2.js
      breakout.lev          ← level data, loaded via fetch()
      launch.ogg  relaunch.ogg  bounce.ogg  break.ogg
      combo1.ogg  combo2.ogg   solid.ogg    miss.ogg
      gameover.ogg  clear.ogg  hiscore.ogg
    snake/
      snake.js
    shapes/
      shapes.js
    15puzzle/
      15puzzle.js
    eliminate/
      eliminate.js
    sokoban/
      sokoban.js
      sokoban.lev           ← 58 levels by Laura Wheeler
    dungeon-crawler/
      dungeon-crawler.js
      dungeon-crawler.lev   ← level data
```

---

## 3. The Two Shells

### 3a. Legacy Shell  (`shell.html` + `shell.js`)

Lives at `./webgames/`. Used by seven remaining legacy games.

- `shell.html` is a minimal wrapper: canvas 560×320, title bar, loads `shell.js`.
- `shell.js` handles the RAF loop, fixed-step updates, buttons, mouse and touch
  input, personal best storage, and game loading.
- Games are launched via `shell.html?game=flappy` etc.
- The legacy shell is **frozen** — do not modify it for new features.
  All seven legacy games depend on it exactly as-is.

### 3b. New Player Page  (`game.html`)

Lives at the **site root** (`/game.html`). This is the active shell for all
future play sessions. It embeds the shell logic directly (not via shell.js) with
these additions over the legacy shell:

| Feature | Detail |
|---|---|
| CSS canvas scaling | `applyScale()` computes `Math.min(availW/560, availH/320)`, sets CSS width/height only. Canvas logical resolution stays 560×320 forever. Games never notice. |
| Orientation handling | Listens to `resize`, `orientationchange`, `screen.orientation change`. 80 ms debounce prevents double-fire on Android. |
| Fullscreen | `document.documentElement.requestFullscreen()`. CSS hides topbar in fullscreen so canvas fills the viewport. |
| Mute global | `SHELL_isMuted()` returns a boolean. Games call this before playing audio. The sound button in the topbar toggles it. |
| Asset path fix | `loadGame()` computes `new URL("./webgames/", location.href)` as an absolute base URL, injects a `<base>` tag into `<head>`, and sets the `<script src>` and back-button href as absolute URLs to escape the base. This keeps all game-internal relative asset paths (`new Image(); img.src = "flappy/bg.png"`) working exactly as they did under `shell.html`. |
| Back button | Returns to `index.html#game/{id}` (the preview screen for that game). |

### 3c. Desktop / Tablet Player  (`game-v2.html`)

Lives at the **site root** (`/game-v2.html`). Active shell for all `"webv2"` games.
Canvas is 960×640 logical pixels. Title bar is 44 px HTML above the canvas.
The game owns the entire canvas — no shell-drawn buttons, no sidebar. Scaling,
fullscreen, orientation, and back-button behaviour are identical to `game.html`.

Additional features over `game.html`:

| Feature | Detail |
|---|---|
| Per-game sound cfg | On load, reads `yk_cfg_<id>` from localStorage and restores mute state before the game script runs. On every sound toggle, writes `{ muted: <bool> }` back. Missing key = sound on by default. |
| Auto-start | `GAME.init()` then `GAME.start()` are called automatically after script load — no START button exists in this shell. |
| Reset button | Shown in title bar when `GAME.reset` or `GAME.resetLabel` is declared. |

**Shell constants available to games:**
```js
V2_CW = 960    V2_CH = 640    // canvas logical size
```

**How `game-v2.html` is called:**
```
game-v2.html?id=breakoutv2
```
The `id` must match the folder name and JS filename under `./webgames/`.

---

## 4. The GAME Object Contract

Every game script must expose a global `GAME` object. The shell calls these
methods — games must not start logic before `start()` is called.

```js
const GAME = {
    title:       "My Game",       // shown in topbar / title bar
    subtitle:    "Controls hint", // shown below title in legacy shell
    resetLabel:  "RESET",         // optional; overrides the RESET button label

    init(canvas)    { },  // called once after script loads; show idle state
    start()         { },  // called when START button clicked
    reset()         { },  // called when RESET button clicked; restart immediately
    update(dt)      { },  // dt in ms; shell calls at fixed 10 ms steps
    draw()          { },  // render everything EXCEPT the two shell buttons
    onClick(mx, my) { },  // optional; canvas tap/click outside shell buttons
    onDrag(mx, my)  { },  // optional; mousemove (held) or touchmove
    onSwipe(dir)    { },  // optional; dir = "up"|"down"|"left"|"right"
};
```

**Shell rules the game must obey:**
- Shell owns the RAF loop. Games must not call `requestAnimationFrame`.
- Shell draws START / RESET buttons **on top** of the game canvas after `draw()`.
- Games must not draw in the button area: sidebar x ≥ 400, y > ~230 (approximate —
  safe rule: never draw below `BTN_START_Y = SHELL_SBY + 214 = 230`).
- `reset()` always restarts immediately (no return to idle).
- `onDrag` and `onSwipe`/`onClick` are mutually exclusive per touch gesture.

---

## 5. Shell Layout Constants

These are defined in both `shell.js` (legacy) and embedded in `game.html`.
Games may read them freely.

```js
SHELL_CW  = 560   SHELL_CH  = 320   // total canvas size

SHELL_PFX = 16    SHELL_PFY = 16    // play field origin
SHELL_PFW = 360   SHELL_PFH = 288   // play field size
                                     // play field right edge = 376
                                     // play field bottom edge = 304

SHELL_SBX = 400   SHELL_SBY = 16    SHELL_SBW = 160  // score/control panel

BTN_W       = 136
BTN_H       = 30
BTN_X       = 412                   // = SHELL_SBX + floor((160-136)/2)
BTN_START_Y = 230                   // = SHELL_SBY + 214
BTN_RESET_Y = 268                   // = SHELL_SBY + 252

SHELL_BTN_X     = BTN_X             // alias used by games for sidebar text x
SHELL_BTN_TOP_Y = BTN_START_Y       // alias
```

---

## 6. Personal Best API

Provided by both shells. Stores to `localStorage`.

```js
SHELL_getPB("key")        // returns parsed value or null
SHELL_setPB("key", value) // stores JSON-serialised value
```

Each game uses its own key string, e.g. `"flappy_score"`, `"breakout_score"`.

---

## 7. Input Handling

Shell handles all input and calls into the GAME object. Games must not attach
their own mouse/touch listeners to the canvas.

| Event | Shell action |
|---|---|
| `mousedown` on canvas | Checks shell buttons first; if not a button, calls `GAME.onClick(mx, my)` |
| `mousemove` (while held) | Calls `GAME.onDrag(mx, my)` |
| `touchstart` | Checks shell buttons (responds immediately for snappy feel); records start coords |
| `touchmove` | Calls `GAME.onDrag(mx, my)` |
| `touchend` | If drag distance ≥ 20 px → `GAME.onSwipe(dir)`; otherwise → `GAME.onClick(mx, my)` |
| `keydown` | Games attach their own `window.addEventListener("keydown", ...)` in `init()` |

All mouse/touch coords are de-scaled to canvas-space (560×320) via:
```js
mx = (clientX - rc.left) * (SHELL_CW / rc.width)
```
This means input coordinates are always in logical canvas space regardless of
CSS scaling. Games do not need to handle scaling.

---

## 8. Asset Loading Patterns

### Images (flappy example)
```js
const _atlas = new Image();
_atlas.onload = () => { _atlasReady = true; };
_atlas.src = "flappy/flappy_atlas.png";  // relative to ./webgames/ (base tag handles this)
```
Games use a ready-flag and draw a fallback (solid colour / outline) until loaded.

### Audio (breakout / flappy example)
```js
const BRK_SND_BOUNCE = new Audio("breakout/bounce.ogg");
function brkSnd(snd) { snd.currentTime = 0; snd.play().catch(() => {}); }
```
Audio paths are relative to `./webgames/`. The `.catch(() => {})` silences
autoplay policy rejections gracefully.

### Level files (breakout / sokoban)
```js
fetch("breakout/breakout.lev")
    .then(r => r.text())
    .then(txt => { /* parse */ });
```
Level files sit next to the game JS. Always include a fallback for fetch failure.

---

## 9. The Game Catalogue (index.html)

`index.html` at the site root drives the portal. It is a single-page app using
`location.hash` routing. No framework.

### Hash Routes

| Hash | View |
|---|---|
| `#home` or empty | About / welcome text |
| `#games` | Game card grid |
| `#game/{id}` | Preview / lobby screen → **new route** |
| `#play/{id}` | Legacy iframe shell view (kept for backward compat) |

### Game Object Structure

```js
{
    id:    "snake",            // must match folder name and JS filename
    type:  "web",              // see section 11 for type roadmap
    name:  "Snake",            // display name
    desc:  "Short description shown on the card.",
    how:   "Controls / rules shown in the preview screen.",
    chips: ["Desktop Browser", "Touch Device"],  // capability badges
    icon:  "▓",               // fallback if no thumb image (Unicode or HTML entity NOT allowed here — use literal char or \uXXXX)
    thumb: "./assets/img/thumbs/snake.png"
}
```

**Important:** `desc` and `how` values are passed through `escHtml()` before
rendering. Use literal Unicode characters or `\uXXXX` escapes — **never HTML
entities like `&#215;` or `&times;`** inside these strings, as they will render
as raw text.

### Preview / Lobby Screen (`#game/{id}`)

Flow: index card click → `#game/{id}` (preview) → "▶ Start Game" → `game.html?id={id}`

The preview screen shows: large thumbnail, title, capability chips, description,
"How to Play" box, and the Start Game button. Designed for future expansion with
personal bests and global rankings.

### Win32 / Download View (`type: "win32"`)

Shows a hero image, description, and download link(s). No canvas, no iframe.

---

## 10. Active Games

**These games are frozen in behaviour. Never modify their JS files unless
explicitly asked to fix a bug or add a specific feature. Never assume or invent
controls, rules, or mechanics — always ask.**

### Legacy shell games (`type: "web"`, canvas 560×320)

| id | Name | Controls | Sound | Levels | Notes |
|---|---|---|---|---|---|
| `dungeon-crawler` | Dungeon Crawler | Arrow keys | No | Yes (.lev) | ASCII roguelike; collect all diamonds; four enemy types |
| `snake` | Snake | Arrow keys, swipe | No | No | Classic snake |
| `flappy` | Flappy | Any key or tap to flap | Yes (1 .ogg) | No | Sprite atlas + sky background image |
| `shapes` | Shapes | Drag pieces onto board | No | No | 8×8 board; fill rows/columns to clear |
| `15puzzle` | 15 Puzzle | Click tile adjacent to empty space | No | No | 4×4 grid; arrange 1–15 in order |
| `eliminate` | Eliminate | Click connected color groups | No | No | Board collapses inward; bigger groups score more |
| `sokoban` | Sokoban | Arrow keys, swipe; R or tap Reset to restart level | No | Yes (.lev, 58 levels by Laura Wheeler) | Push crates onto blue goal fields |

### Desktop / tablet shell games (`type: "webv2"`, canvas 960×640)

| id | Name | Controls | Sound | Levels | Notes |
|---|---|---|---|---|---|
| `breakoutv2` | Breakout | Drag anywhere to move paddle; tap/click to launch ball; left/right arrow keys also work; pointer lock on desktop | Yes (11 .ogg files) | Yes (.lev, 32 stages) | Combo system; extra ball on stage clear; stuck-ball timeout; free mouse via pointer lock |

---

## 11. Type System & Shell Roadmap

The `type` field in each catalogue entry controls which player page the
"Start Game" button navigates to, and which view `renderPreview()` renders.

### Current types

| type | Behaviour |
|---|---|
| `"web"` | Launches `game.html?id={id}` (legacy scaling player, 560×320) |
| `"webv2"` | Launches `game-v2.html?id={id}` (desktop/tablet player, 960×640) |
| `"win32"` | Shows download / hero view; no canvas |

### Planned future types

| type | Intended shell | Status |
|---|---|---|
| `"phone"` | `game-phone.html` — portrait shell, touch-first | Planned — see notes below |

**Phone shell design notes:**
- Architecture is technically almost identical to `game-v2.html` — same title bar
  structure, same scaling approach, same input contract (`onClick`, `onDrag`,
  `onSwipe`), same per-game sound cfg, same auto-start flow.
- Canvas will be portrait orientation. Exact resolution is not yet decided.
- Title bar layout and all shell behaviours are considered locked/agreed.
- New games targeting portrait mobile will use `"phone"`. All existing games stay
  on their current shell forever.

The router in `index.html` will gain a `"phone"` branch when the shell exists.
Each shell page is self-contained; adding a new one requires zero changes to
existing games or the catalogue structure beyond adding the new type branch.

---

## 12. Sound Gating — Implemented

Both `game.html` and `game-v2.html` expose `SHELL_isMuted()` globally.
All games with audio wrap every `.play()` call with:

```js
if (!SHELL_isMuted()) { snd.currentTime = 0; snd.play().catch(() => {}); }
```

`game-v2.html` additionally persists the mute state **per game** in localStorage
using the key `yk_cfg_<gameId>` (e.g. `yk_cfg_breakoutv2`). Value is
`{ muted: <bool> }`. Missing key = sound on by default. The cfg is written on
every toggle and read back at the start of `v2LoadGame()` before the game script
runs — so `SHELL_isMuted()` is already correct during `init()`.

`SHELL_isMuted()` is not defined in the legacy `shell.js`, only in `game.html`
and `game-v2.html`. The legacy shell and iframe path are frozen; sound gating
only applies to games running through the modern shells.

---

## 13. Future Feature Ideas

These are noted intentions, not commitments. Raise before implementing.

- **Global ranking / leaderboard:** Server-side score submission with optional
  username registration. The preview screen (`#game/{id}`) is the natural home
  for displaying rankings. Personal bests already stored client-side via
  `SHELL_getPB` / `SHELL_setPB` — these can seed or compare against global scores.
- **Phone shell:** Portrait-first layout. Architecture mirrors `game-v2.html`
  exactly — same title bar, scaling, input contract, sound cfg. Canvas resolution
  not yet decided. New games only; no existing game will be ported to it.

---

## 14. Rules for Claude Sessions

1. **Never invent game mechanics, controls, or rules.** If uncertain, ask.
2. **Never modify `shell.js` or `shell.html`.** They are frozen.
3. **Never modify any existing game `.js` file** unless explicitly asked to fix
   a specific bug or add a specific feature.
4. **Use literal Unicode or `\uXXXX` in JS strings** — never HTML entities.
5. **Game variable naming:** use descriptive prefixed names (e.g. `BRK_`, `FL_`).
   Avoid JS reserved words as variable names (`left`, `right`, `top`, `name` etc.).
6. **No OOP.** Procedural code only. No classes, no `new MyClass()`.
7. When adding a new game to the catalogue: add `id`, `type`, `name`, `desc`,
   `how`, `chips`, `icon`, `thumb` — all fields required. Verify `how` is
   accurate before writing it.
8. The `<base>` tag trick applies to both `game.html` and `game-v2.html`. The base
   tag is injected inside `loadGame()` / `v2LoadGame()` before the game script tag
   is appended. The script `src` and back-button `href` are set as absolute URLs
   (via `new URL(...)`) to escape the base. Do not restructure this without care.
