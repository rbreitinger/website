// =============================================================================
// breakoutv2.js  —  Breakout for game-v2.html  (960 × 640 canvas)
// Place at:  ./webgames/space-blocks/space-blocks.js
// Levels at: ./webgames/space-blocks/breakout.lev
// Sounds at: ./webgames/space-blocks/*.ogg
// =============================================================================

// ── grid ──────────────────────────────────────────────────────────────────────
const V2BRK_COLS         = 10;
const V2BRK_ROWS         = 10;
const V2BRK_BW           = 54;                                  // block width  px
const V2BRK_BH           = 27;                                  // block height px
const V2BRK_HUD_H        = 40;                                  // HUD stats strip height above blocks
const V2BRK_OX           = Math.floor((V2_CW - V2BRK_COLS * V2BRK_BW) / 2); // 210
const V2BRK_OY           = V2BRK_HUD_H + 5;                    // block grid top y  (45)

// ── play-field walls (ball bounces within this column) ────────────────────────
const V2BRK_PFW          = V2BRK_COLS * V2BRK_BW;              // 540
const V2BRK_PF_LEFT      = V2BRK_OX;                           // left wall x   (210)
const V2BRK_PF_RIGHT     = V2BRK_OX + V2BRK_PFW;              // right wall x  (750)
const V2BRK_PF_TOP       = V2BRK_OY;                           // ceiling y     (45)

// ── ball ──────────────────────────────────────────────────────────────────────
const V2BRK_BALL_R        = 8;                                  // radius px
const V2BRK_SPEED         = 3.6;                                // px per update step
const V2BRK_DELTA_MAX     = 2.7;                                // max dx/dy component
const V2BRK_LAUNCH_SPREAD = 0.5;                                // ± radians from straight up
const V2BRK_MIN_ANGLE_DEG = 35;                                 // minimum vertical angle (deg from horizontal)

// ── paddle ────────────────────────────────────────────────────────────────────
const V2BRK_PAD_W        = 68;                                  // width  px
const V2BRK_PAD_H        = 13;                                  // height px
const V2BRK_PAD_Y        = 390;                                 // paddle top y  ← adjust freely
const V2BRK_PAD_EDGE     = 8;                                   // min gap from wall
const V2BRK_PAD_INF      = 0.05;                                // paddle-offset influence on ball dx
const V2BRK_PAD_KEY_SPD  = 5;                                   // px per step for arrow-key movement

// ── layout zones (all adjustable) ─────────────────────────────────────────────
const V2BRK_PLAY_CLIP_H  = V2BRK_PAD_Y + V2BRK_PAD_H + 9;    // play area clip bottom  (412)
const V2BRK_BALL_LOST_Y  = V2BRK_PAD_Y + V2BRK_PAD_H + 20;   // ball lost threshold    (423)
const V2BRK_SEP_Y        = 420;                                 // separator line y       ← adjust
const V2BRK_DZ_TOP       = 428;                                 // drag zone rect top y   ← adjust
const V2BRK_DZ_BOT       = 618;                                 // drag zone rect bottom y

// ── game limits ───────────────────────────────────────────────────────────────
const V2BRK_MAX_STAGES   = 32;
const V2BRK_INIT_BALLS   = 5;                                   // starting balls  (was 3)
const V2BRK_MAX_BALLS    = 9;                                   // max collectible balls  (was 10)
const V2BRK_MAX_PARTS    = 15;
const V2BRK_STUCK_MS     = 12000;

// ── particles ─────────────────────────────────────────────────────────────────
const V2BRK_PT_FALL      = 2.7;
const V2BRK_PT_AMP       = 15;
const V2BRK_PT_FREQ      = 0.12;

// ── state timers ──────────────────────────────────────────────────────────────
const V2BRK_BALLLOST_MS  = 1200;
const V2BRK_CLEAR_MS     = 2000;

// ── scoring ───────────────────────────────────────────────────────────────────
const V2BRK_SCORE_BASE   = 5;
const V2BRK_COMBO1_AT    = 2;
const V2BRK_COMBO2_AT    = 6;

// ── personal best key (shared with legacy — same scores, same game) ───────────
const V2BRK_PB_KEY        = "space_blocks_score";   // new key
const V2BRK_PB_KEY_LEGACY = "breakout_score";        // old key — migrated on first load

// ── states ────────────────────────────────────────────────────────────────────
const V2BRK_S_LOADING    = 0;
const V2BRK_S_READY      = 1;
const V2BRK_S_PLAYING    = 2;
const V2BRK_S_BALLLOST   = 3;
const V2BRK_S_CLEAR      = 4;
const V2BRK_S_GAMEOVER   = 5;
const V2BRK_S_COMPLETE   = 6;

// ── block colour palette  [shadow, face]  index = block value ─────────────────
const V2BRK_BLOCK_CLR = [
    ["#000000", "#000000"],   // 0  empty
    ["#0000AA", "#5555FF"],   // 1
    ["#00AA00", "#55FF55"],   // 2
    ["#AA0000", "#FF5555"],   // 3
    ["#AA00AA", "#FF55FF"],   // 4
    ["#AA5500", "#FFFF55"],   // 5
    ["#00AAAA", "#55FFFF"],   // 6
    ["#555555", "#AAAAAA"],   // 7  solid / indestructible
];

// ── colours ───────────────────────────────────────────────────────────────────
const V2BRK_C_BG         = "#0D0D1A";                // canvas background (fallback, no bg image)
const V2BRK_C_PF_BG      = "rgba(0,0,0,0.82)";       // play field overlay — semi-transparent so bg shows faintly
const V2BRK_C_HUD_BG     = "rgba(10,10,28,0.88)";    // HUD strip background
const V2BRK_C_SEP        = "#2A2A4A";                 // separator line
const V2BRK_C_DZ_BORDER  = "#2A2A5A";                 // drag zone border
const V2BRK_C_DZ_FILL    = "rgba(6,6,22,0.72)";       // drag zone fill (over background)
const V2BRK_C_DZ_LABEL   = "#484880";                 // drag zone hint text
const V2BRK_C_PAD_DARK   = "#006400";
const V2BRK_C_PAD_MID    = "#00AA00";
const V2BRK_C_PAD_MAIN   = "#00CC00";
const V2BRK_C_PAD_LIGHT  = "#88FF88";
const V2BRK_C_PAD_SHINE  = "#CCFFCC";
const V2BRK_C_BALL_SHAD  = "#888888";
const V2BRK_C_BALL_MAIN  = "#FFFF88";
const V2BRK_C_BALL_SHINE = "#FFFFFF";
const V2BRK_C_OV_BG      = "#000000";
const V2BRK_C_OV_TXT     = "#FFFFFF";
const V2BRK_C_OV_SUB     = "#93A0B3";
const V2BRK_C_GAMEOVER   = "#FF5555";
const V2BRK_C_CLEAR      = "#55FF55";
const V2BRK_C_NEWBEST    = "#FFFF55";
const V2BRK_C_STATS_LBL  = "#5A6A80";   // stats label dim colour
const V2BRK_C_STATS_VAL  = "#C8D8E8";   // stats value bright colour
const V2BRK_C_COMBO_TXT  = "#AADE55";

// ── sounds ────────────────────────────────────────────────────────────────────
const V2BRK_SND_LAUNCH   = new Audio("space-blocks/launch.ogg");
const V2BRK_SND_RELAUNCH = new Audio("space-blocks/relaunch.ogg");
const V2BRK_SND_BOUNCE   = new Audio("space-blocks/bounce.ogg");
const V2BRK_SND_BREAK    = new Audio("space-blocks/break.ogg");
const V2BRK_SND_COMBO1   = new Audio("space-blocks/combo1.ogg");
const V2BRK_SND_COMBO2   = new Audio("space-blocks/combo2.ogg");
const V2BRK_SND_SOLID    = new Audio("space-blocks/solid.ogg");
const V2BRK_SND_MISS     = new Audio("space-blocks/miss.ogg");
const V2BRK_SND_GAMEOVER = new Audio("space-blocks/gameover.ogg");
const V2BRK_SND_CLEAR    = new Audio("space-blocks/clear.ogg");
const V2BRK_SND_HISCORE  = new Audio("space-blocks/hiscore.ogg");

function v2brkSnd(snd) {
    if (!SHELL_isMuted()) { snd.currentTime = 0; snd.play().catch(() => {}); }
}

// =============================================================================
// LEVEL DATA
// =============================================================================
let v2brkStages      = null;    // null = still loading
let v2brkTotalStages = 0;
let v2brkGrid        = [];
let v2brkWantsStart  = false;   // start() was called before levels finished loading

function v2brkLoadLevels() {
    fetch("space-blocks/space-blocks.lev")
        .then(r => r.text())
        .then(txt => {
            const nums = txt.trim().split(/\s+/).map(Number);
            v2brkStages = [];
            let idx = 0;
            for (let st = 0; st < V2BRK_MAX_STAGES; st++) {
                v2brkStages[st] = [];
                for (let row = 0; row < V2BRK_ROWS; row++) {
                    v2brkStages[st][row] = new Uint8Array(V2BRK_COLS);
                    for (let col = 0; col < V2BRK_COLS; col++) {
                        v2brkStages[st][row][col] = nums[idx++] || 0;
                    }
                }
            }
            v2brkTotalStages = 0;
            for (let st = 0; st < V2BRK_MAX_STAGES; st++) {
                outer: for (let row = 0; row < V2BRK_ROWS; row++) {
                    for (let col = 0; col < V2BRK_COLS; col++) {
                        if (v2brkStages[st][row][col] > 0) { v2brkTotalStages++; break outer; }
                    }
                }
            }
            if (v2brkWantsStart) v2brkStartGame();
        })
        .catch(() => {
            // Fallback: simple placeholder levels
            v2brkStages = [];
            for (let st = 0; st < V2BRK_MAX_STAGES; st++) {
                v2brkStages[st] = [];
                for (let row = 0; row < V2BRK_ROWS; row++) {
                    v2brkStages[st][row] = new Uint8Array(V2BRK_COLS);
                    if (row < 5) {
                        for (let col = 0; col < V2BRK_COLS; col++) {
                            v2brkStages[st][row][col] = (row % 6) + 1;
                        }
                    }
                }
            }
            v2brkTotalStages = V2BRK_MAX_STAGES;
            if (v2brkWantsStart) v2brkStartGame();
        });
}

function v2brkLoadGrid(stIdx) {
    v2brkGrid = [];
    for (let row = 0; row < V2BRK_ROWS; row++) {
        v2brkGrid[row] = new Uint8Array(V2BRK_COLS);
        for (let col = 0; col < V2BRK_COLS; col++) {
            v2brkGrid[row][col] = v2brkStages[stIdx][row][col];
        }
    }
}

function v2brkStageClear() {
    for (let row = 0; row < V2BRK_ROWS; row++)
        for (let col = 0; col < V2BRK_COLS; col++)
            if (v2brkGrid[row][col] > 0 && v2brkGrid[row][col] < 7) return false;
    return true;
}

// =============================================================================
// GAME STATE
// =============================================================================
let v2brkState     = V2BRK_S_LOADING;
let v2brkStateTmr  = 0;

let v2brkStageIdx  = 0;
let v2brkScore     = 0;
let v2brkPB        = 0;
let v2brkBalls     = V2BRK_INIT_BALLS;
let v2brkCombo     = 0;
let v2brkStuckMs   = 0;
let v2brkNewBest   = false;
let v2brkOverLockMs = 0;   // 1-second Play Again button lock after game over

// paddle
let v2brkPadX      = V2BRK_OX + V2BRK_PFW / 2;

// ball — position, previous position, velocity
let v2brkBX        = 0;
let v2brkBY        = 0;
let v2brkBPX       = 0;
let v2brkBPY       = 0;
let v2brkBDX       = 0;
let v2brkBDY       = 0;

// particles  { bx, y, col, age, ph }
let v2brkParts     = [];

// canvas / context (set in init)
let _v2brkCtx      = null;
let _v2brkCanvas   = null;

// keyboard arrow key state
let _v2brkKeyLeft  = false;
let _v2brkKeyRight = false;

// pointer lock state
let _v2brkLocked      = false;
let _v2brkLockSkipOne = false;  // skip first mousemove after lock grant (avoids snap)

// background image
let _v2brkBgImg    = null;
let _v2brkBgLoaded = false;

// =============================================================================
// POINTER LOCK — free mouse tracking on desktop
// =============================================================================
function v2brkOnLockChange() {
    const nowLocked = (document.pointerLockElement === _v2brkCanvas);
    if (nowLocked && !_v2brkLocked) _v2brkLockSkipOne = true;  // skip first event on grant
    _v2brkLocked = nowLocked;
}

function v2brkOnFreeMouse(e) {
    if (!_v2brkLocked) return;
    if (_v2brkLockSkipOne) { _v2brkLockSkipOne = false; return; }
    if (v2brkState !== V2BRK_S_READY && v2brkState !== V2BRK_S_PLAYING) return;
    const rc    = _v2brkCanvas.getBoundingClientRect();
    const scale = V2_CW / rc.width;
    v2brkPadX  += e.movementX * scale;
    v2brkClampPad();
}

function v2brkLockMouse() {
    if (_v2brkCanvas && !_v2brkLocked) _v2brkCanvas.requestPointerLock();
}

function v2brkUnlockMouse() {
    if (_v2brkLocked) document.exitPointerLock();
}

// =============================================================================
// HELPERS
// =============================================================================
function v2brkFnt(sz) { return `${sz}px Consolas,"Lucida Console","Courier New",monospace`; }

function v2brkPadLeft()  { return v2brkPadX - V2BRK_PAD_W / 2; }
function v2brkPadRight() { return v2brkPadX + V2BRK_PAD_W / 2; }
function v2brkBallSitY() { return V2BRK_PAD_Y - V2BRK_BALL_R - 1; }

function v2brkClampPad() {
    const lo = V2BRK_OX + V2BRK_PAD_W / 2 + V2BRK_PAD_EDGE;
    const hi = V2BRK_OX + V2BRK_PFW - V2BRK_PAD_W / 2 - V2BRK_PAD_EDGE;
    if (v2brkPadX < lo) v2brkPadX = lo;
    if (v2brkPadX > hi) v2brkPadX = hi;
}

// Enforce minimum vertical angle so the ball never travels nearly horizontally.
// Works on any (dx, dy) pair, normalised or not — re-normalises to unit vector.
function v2brkEnforceMinAngle() {
    const spd = Math.sqrt(v2brkBDX * v2brkBDX + v2brkBDY * v2brkBDY);
    if (spd === 0) return;
    let nx = v2brkBDX / spd;
    let ny = v2brkBDY / spd;
    const minSin = Math.sin(V2BRK_MIN_ANGLE_DEG * Math.PI / 180);
    if (Math.abs(ny) < minSin) {
        ny = minSin * (ny >= 0 ? 1 : -1);
        nx = Math.sqrt(1 - ny * ny) * (nx >= 0 ? 1 : -1);
    }
    v2brkBDX = nx;
    v2brkBDY = ny;
}

function v2brkCapDelta() {
    if (v2brkBDX < -V2BRK_DELTA_MAX) v2brkBDX = -V2BRK_DELTA_MAX;
    if (v2brkBDX >  V2BRK_DELTA_MAX) v2brkBDX =  V2BRK_DELTA_MAX;
    if (v2brkBDY < -V2BRK_DELTA_MAX) v2brkBDY = -V2BRK_DELTA_MAX;
    if (v2brkBDY >  V2BRK_DELTA_MAX) v2brkBDY =  V2BRK_DELTA_MAX;
}

// =============================================================================
// STATE MACHINE
// =============================================================================
function v2brkEnter(st) {
    v2brkState    = st;
    v2brkStateTmr = 0;

    if (st === V2BRK_S_READY) {
        v2brkBX    = v2brkPadX;
        v2brkBY    = v2brkBallSitY();
        v2brkBDX   = 0;
        v2brkBDY   = 0;
        v2brkParts = [];
    }

    if (st === V2BRK_S_CLEAR) {
        v2brkStateTmr = V2BRK_CLEAR_MS;
        if (v2brkBalls < V2BRK_MAX_BALLS) v2brkBalls++;
        v2brkSnd(V2BRK_SND_CLEAR);
    }

    if (st === V2BRK_S_BALLLOST) {
        v2brkStateTmr = V2BRK_BALLLOST_MS;
        v2brkSnd(V2BRK_SND_MISS);
    }

    if (st === V2BRK_S_GAMEOVER) {
        v2brkCheckBest();
        v2brkOverLockMs = 0;
        v2brkSnd(V2BRK_SND_GAMEOVER);
        v2brkUnlockMouse();
    }

    if (st === V2BRK_S_COMPLETE) {
        v2brkCheckBest();
        v2brkOverLockMs = 0;
        v2brkUnlockMouse();
    }
}

function v2brkCheckBest() {
    if (v2brkScore > v2brkPB) {
        v2brkPB      = v2brkScore;
        v2brkNewBest = true;
        SHELL_setPB(V2BRK_PB_KEY, v2brkPB);
        v2brkSnd(V2BRK_SND_HISCORE);
    }
}

function v2brkStartGame() {
    v2brkStageIdx = 0;
    v2brkScore    = 0;
    v2brkBalls    = V2BRK_INIT_BALLS;
    v2brkCombo    = 0;
    v2brkNewBest  = false;
    v2brkPadX     = V2BRK_OX + V2BRK_PFW / 2;
    v2brkLoadGrid(0);
    v2brkEnter(V2BRK_S_READY);
}

// =============================================================================
// LAUNCH
// =============================================================================
function v2brkLaunch() {
    const angle   = -Math.PI / 2 + (Math.random() - 0.5) * V2BRK_LAUNCH_SPREAD;
    v2brkBDX      = Math.cos(angle);
    v2brkBDY      = Math.sin(angle);   // negative = upward
    v2brkStuckMs  = 0;
    v2brkCombo    = 0;
    v2brkSnd(V2BRK_SND_LAUNCH);
    v2brkEnter(V2BRK_S_PLAYING);
}

// =============================================================================
// COLLISION — collect all contacts first, reflect each axis once only
// =============================================================================
function v2brkCircVsRect(cx, cy, r, rx, ry, rw, rh) {
    const nearX = Math.max(rx, Math.min(cx, rx + rw));
    const nearY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nearX, dy = cy - nearY;
    return dx * dx + dy * dy < r * r;
}

function v2brkContactFace(cx, cy, px, py, rx, ry, rw, rh) {
    const wasLeft  = px + V2BRK_BALL_R <= rx;
    const wasRight = px - V2BRK_BALL_R >= rx + rw;
    const wasAbove = py + V2BRK_BALL_R <= ry;
    const wasBelow = py - V2BRK_BALL_R >= ry + rh;
    let hitX = wasLeft || wasRight;
    let hitY = wasAbove || wasBelow;

    if (!hitX && !hitY) {
        // Ball was already overlapping — use block-centre distance ratio
        const bCX = rx + rw * 0.5, bCY = ry + rh * 0.5;
        const nDX = Math.abs(cx - bCX) / (rw * 0.5);
        const nDY = Math.abs(cy - bCY) / (rh * 0.5);
        hitX = nDX >= nDY;
        hitY = nDY >= nDX;
    }
    return { hitX, hitY };
}

function v2brkCollideBlocks() {
    const rowLo = Math.max(0,             Math.floor((v2brkBY - V2BRK_BALL_R - V2BRK_OY) / V2BRK_BH));
    const rowHi = Math.min(V2BRK_ROWS-1, Math.floor((v2brkBY + V2BRK_BALL_R - V2BRK_OY) / V2BRK_BH));
    const colLo = Math.max(0,             Math.floor((v2brkBX - V2BRK_BALL_R - V2BRK_OX) / V2BRK_BW));
    const colHi = Math.min(V2BRK_COLS-1, Math.floor((v2brkBX + V2BRK_BALL_R - V2BRK_OX) / V2BRK_BW));

    let anyX = false, anyY = false;
    const hits = [];

    for (let row = rowLo; row <= rowHi; row++) {
        for (let col = colLo; col <= colHi; col++) {
            const val = v2brkGrid[row][col];
            if (val === 0) continue;
            const rx = V2BRK_OX + col * V2BRK_BW;
            const ry = V2BRK_OY + row * V2BRK_BH;
            if (!v2brkCircVsRect(v2brkBX, v2brkBY, V2BRK_BALL_R, rx, ry, V2BRK_BW, V2BRK_BH)) continue;
            const face = v2brkContactFace(v2brkBX, v2brkBY, v2brkBPX, v2brkBPY, rx, ry, V2BRK_BW, V2BRK_BH);
            if (face.hitX) anyX = true;
            if (face.hitY) anyY = true;
            hits.push({ row, col, val });
        }
    }

    if (!hits.length) return;

    const nudge = () => (Math.random() - 0.5) * 0.2;
    if (anyX) v2brkBDX = -v2brkBDX + nudge();
    if (anyY) v2brkBDY = -v2brkBDY + nudge();

    for (const h of hits) {
        if (h.val < 7) {
            // Destructible: vals 1–4 destroyed immediately; 5–6 degrade one step
            v2brkGrid[h.row][h.col] = h.val <= 4 ? 0 : h.val - 1;
            v2brkCombo++;
            v2brkScore   += V2BRK_SCORE_BASE * h.val * v2brkCombo;
            v2brkStuckMs  = 0;

            if (v2brkParts.length < V2BRK_MAX_PARTS) {
                v2brkParts.push({
                    bx:  V2BRK_OX + h.col * V2BRK_BW,
                    y:   V2BRK_OY + h.row * V2BRK_BH,
                    col: h.val,
                    age: 0,
                    ph:  Math.random() * Math.PI * 2
                });
            }

            if      (v2brkCombo === V2BRK_COMBO1_AT) v2brkSnd(V2BRK_SND_COMBO1);
            else if (v2brkCombo === V2BRK_COMBO2_AT) v2brkSnd(V2BRK_SND_COMBO2);
            else                                      v2brkSnd(V2BRK_SND_BREAK);
        } else {
            v2brkSnd(V2BRK_SND_SOLID);
        }
    }
}

// =============================================================================
// UPDATE — PLAYING state
// =============================================================================
function v2brkUpdatePlaying(dt) {
    v2brkStuckMs += dt;
    if (v2brkStuckMs >= V2BRK_STUCK_MS) {
        v2brkSnd(V2BRK_SND_RELAUNCH);
        v2brkEnter(V2BRK_S_READY);
        return;
    }

    v2brkCapDelta();

    v2brkBPX  = v2brkBX;
    v2brkBPY  = v2brkBY;
    v2brkBX  += v2brkBDX * V2BRK_SPEED;
    v2brkBY  += v2brkBDY * V2BRK_SPEED;

    // Left / right walls
    if (v2brkBX < V2BRK_PF_LEFT + V2BRK_BALL_R) {
        v2brkBX  = V2BRK_PF_LEFT + V2BRK_BALL_R;
        v2brkBDX = Math.abs(v2brkBDX);
        v2brkEnforceMinAngle();
        v2brkSnd(V2BRK_SND_BOUNCE);
    } else if (v2brkBX > V2BRK_PF_RIGHT - V2BRK_BALL_R) {
        v2brkBX  = V2BRK_PF_RIGHT - V2BRK_BALL_R;
        v2brkBDX = -Math.abs(v2brkBDX);
        v2brkEnforceMinAngle();
        v2brkSnd(V2BRK_SND_BOUNCE);
    }

    // Ceiling
    if (v2brkBY < V2BRK_PF_TOP + V2BRK_BALL_R) {
        v2brkBY  = V2BRK_PF_TOP + V2BRK_BALL_R;
        v2brkBDY = Math.abs(v2brkBDY);
        v2brkEnforceMinAngle();
        v2brkSnd(V2BRK_SND_BOUNCE);
    }

    // Block collision (skip once ball is clearly below block grid)
    if (v2brkBY < V2BRK_OY + V2BRK_ROWS * V2BRK_BH + V2BRK_BALL_R) {
        v2brkCollideBlocks();
        v2brkEnforceMinAngle();
    }

    // Paddle collision
    if (v2brkBY + V2BRK_BALL_R >= V2BRK_PAD_Y  &&
        v2brkBY - V2BRK_BALL_R <= V2BRK_PAD_Y + V2BRK_PAD_H &&
        v2brkBX  >= v2brkPadLeft()  - V2BRK_BALL_R &&
        v2brkBX  <= v2brkPadRight() + V2BRK_BALL_R) {
        v2brkBY      = V2BRK_PAD_Y - V2BRK_BALL_R - 1;
        v2brkBDY     = -Math.abs(v2brkBDY);              // always bounce upward
        v2brkBDX    += (v2brkBX - v2brkPadX) * V2BRK_PAD_INF;
        // Re-normalise: paddle zone shifts angle only, never speed
        const _pspd  = Math.sqrt(v2brkBDX * v2brkBDX + v2brkBDY * v2brkBDY);
        if (_pspd > 0) { v2brkBDX /= _pspd; v2brkBDY /= _pspd; }
        v2brkEnforceMinAngle();
        v2brkCombo   = 0;
        v2brkStuckMs = 0;
        v2brkSnd(V2BRK_SND_BOUNCE);
    }

    // Ball lost — fell below threshold
    if (v2brkBY > V2BRK_BALL_LOST_Y) {
        v2brkBalls--;
        if (v2brkBalls > 0) v2brkEnter(V2BRK_S_BALLLOST);
        else                 v2brkEnter(V2BRK_S_GAMEOVER);
        return;
    }

    // Stage clear check
    if (v2brkStageClear()) {
        v2brkEnter(V2BRK_S_CLEAR);
        return;
    }

    // Age particles — fade them out once they drift below the block grid
    for (let i = v2brkParts.length - 1; i >= 0; i--) {
        const p = v2brkParts[i];
        p.age++;
        p.y += V2BRK_PT_FALL;
        if (p.y > V2BRK_OY + V2BRK_ROWS * V2BRK_BH + V2BRK_BH) v2brkParts.splice(i, 1);
    }
}

// =============================================================================
// DRAW
// =============================================================================
function v2brkDrawBoard() {
    for (let row = 0; row < V2BRK_ROWS; row++) {
        for (let col = 0; col < V2BRK_COLS; col++) {
            const val = v2brkGrid[row][col];
            if (!val) continue;
            const x = V2BRK_OX + col * V2BRK_BW;
            const y = V2BRK_OY + row * V2BRK_BH;
            const [shd, face] = V2BRK_BLOCK_CLR[val];
            _v2brkCtx.fillStyle = shd;
            _v2brkCtx.fillRect(x + 2, y + 2, V2BRK_BW, V2BRK_BH);
            _v2brkCtx.fillStyle = face;
            _v2brkCtx.fillRect(x, y, V2BRK_BW - 2, V2BRK_BH - 2);
        }
    }
}

function v2brkDrawParts() {
    _v2brkCtx.lineWidth = 1;
    for (const p of v2brkParts) {
        const drawX = p.bx + Math.sin(p.age * V2BRK_PT_FREQ + p.ph) * V2BRK_PT_AMP;
        const [shd, face] = V2BRK_BLOCK_CLR[p.col];
        _v2brkCtx.strokeStyle = shd;
        _v2brkCtx.strokeRect(drawX + 2, p.y + 2, V2BRK_BW - 4, V2BRK_BH - 4);
        _v2brkCtx.strokeStyle = face;
        _v2brkCtx.strokeRect(drawX, p.y, V2BRK_BW - 4, V2BRK_BH - 4);
    }
}

function v2brkDrawPaddle() {
    const px = Math.round(v2brkPadX);
    const py = V2BRK_PAD_Y;
    const hw = Math.floor(V2BRK_PAD_W / 2);
    _v2brkCtx.fillStyle = V2BRK_C_PAD_DARK;
    _v2brkCtx.fillRect(px - hw + 4, py + 4, V2BRK_PAD_W, V2BRK_PAD_H);
    _v2brkCtx.fillStyle = V2BRK_C_PAD_MID;
    _v2brkCtx.fillRect(px - hw + 2, py + 2, V2BRK_PAD_W, V2BRK_PAD_H);
    _v2brkCtx.fillStyle = V2BRK_C_PAD_MAIN;
    _v2brkCtx.fillRect(px - hw, py, V2BRK_PAD_W, V2BRK_PAD_H);
    _v2brkCtx.fillStyle = V2BRK_C_PAD_LIGHT;
    _v2brkCtx.fillRect(px - hw, py, V2BRK_PAD_W - 2, V2BRK_PAD_H - 2);
    _v2brkCtx.fillStyle = V2BRK_C_PAD_SHINE;
    _v2brkCtx.fillRect(px - hw + 1, py + 2, V2BRK_PAD_W - 2, 2);
}

function v2brkDrawBall() {
    const bx = Math.round(v2brkBX);
    const by = Math.round(v2brkBY);
    const r  = V2BRK_BALL_R;
    const sh = Math.floor(r / 2);
    const sp = Math.floor(r / 3);
    _v2brkCtx.beginPath();
    _v2brkCtx.arc(bx + sh, by + sh, r, 0, Math.PI * 2);
    _v2brkCtx.fillStyle = V2BRK_C_BALL_SHAD;
    _v2brkCtx.fill();
    _v2brkCtx.beginPath();
    _v2brkCtx.arc(bx, by, r, 0, Math.PI * 2);
    _v2brkCtx.fillStyle = V2BRK_C_BALL_MAIN;
    _v2brkCtx.fill();
    _v2brkCtx.beginPath();
    _v2brkCtx.arc(bx - sp, by - sp, sp, 0, Math.PI * 2);
    _v2brkCtx.fillStyle = V2BRK_C_BALL_SHINE;
    _v2brkCtx.fill();
}

// HUD stats strip — drawn above the block grid
function v2brkDrawStats() {
    const cx   = _v2brkCtx;
    const segW = V2BRK_PFW / 4;   // 135 px per segment

    // Background
    cx.fillStyle = V2BRK_C_HUD_BG;
    cx.fillRect(V2BRK_OX, 0, V2BRK_PFW, V2BRK_HUD_H);

    // Bottom separator
    cx.strokeStyle = V2BRK_C_SEP;
    cx.lineWidth   = 1;
    cx.beginPath();
    cx.moveTo(V2BRK_OX,             V2BRK_HUD_H);
    cx.lineTo(V2BRK_OX + V2BRK_PFW, V2BRK_HUD_H);
    cx.stroke();

    cx.textBaseline = "alphabetic";
    cx.textAlign    = "center";

    const lblY = 13;
    const valY = 32;

    function statCell(segIdx, lbl, val, valColour) {
        const segCX = V2BRK_OX + segIdx * segW + segW / 2;
        cx.font      = v2brkFnt(10);
        cx.fillStyle = V2BRK_C_STATS_LBL;
        cx.fillText(lbl, segCX, lblY);
        cx.font      = "bold " + v2brkFnt(16);
        cx.fillStyle = valColour || V2BRK_C_STATS_VAL;
        cx.fillText(val, segCX, valY);
    }

    statCell(0, "STAGE", (v2brkStageIdx + 1) + "/" + v2brkTotalStages);
    statCell(1, "SCORE", String(v2brkScore).padStart(6, "0"));

    // BEST goes green when player is beating their record
    const bestCol = (v2brkScore > 0 && v2brkScore >= v2brkPB) ? "#60FF60" : V2BRK_C_STATS_VAL;
    statCell(2, "BEST", String(v2brkPB).padStart(6, "0"), bestCol);

    // BALLS segment: label + row of overlapping circles
    const ballSegCX   = V2BRK_OX + 3 * segW + segW / 2;
    cx.font      = v2brkFnt(10);
    cx.fillStyle = V2BRK_C_STATS_LBL;
    cx.fillText("BALLS", ballSegCX, lblY);

    const ballR       = 4;
    const ballSpacing = 8;                              // slightly overlapping to fit up to 9
    const ballsW      = (v2brkBalls - 1) * ballSpacing;
    const ballsStartX = ballSegCX - ballsW / 2;
    const ballsY      = valY - ballR - 1;

    for (let i = 0; i < v2brkBalls; i++) {
        const bx = ballsStartX + i * ballSpacing;
        cx.beginPath();
        cx.arc(bx, ballsY, ballR, 0, Math.PI * 2);
        cx.fillStyle   = V2BRK_C_BALL_MAIN;
        cx.fill();
        cx.strokeStyle = V2BRK_C_STATS_LBL;
        cx.lineWidth   = 1;
        cx.stroke();
    }

    cx.textAlign    = "left";
    cx.textBaseline = "alphabetic";
}

// Drag zone — clearly bordered rect below the play area
function v2brkDrawDragZone() {
    const cx    = _v2brkCtx;
    const zoneW = V2BRK_PFW;
    const zoneH = V2BRK_DZ_BOT - V2BRK_DZ_TOP;

    cx.fillStyle = V2BRK_C_DZ_FILL;
    cx.fillRect(V2BRK_OX, V2BRK_DZ_TOP, zoneW, zoneH);

    cx.strokeStyle = V2BRK_C_DZ_BORDER;
    cx.lineWidth   = 1;
    cx.strokeRect(V2BRK_OX + 0.5, V2BRK_DZ_TOP + 0.5, zoneW - 1, zoneH - 1);

    cx.font         = v2brkFnt(12);
    cx.fillStyle    = V2BRK_C_DZ_LABEL;
    cx.textAlign    = "center";
    cx.textBaseline = "middle";
    cx.fillText("DRAG PADDLE HERE", V2BRK_OX + zoneW / 2, V2BRK_DZ_TOP + zoneH / 2);
    cx.textAlign    = "left";
    cx.textBaseline = "alphabetic";
}

// Semi-transparent overlay over the block + travel zone (above paddle)
function v2brkOverlay(line1, col1, line2, col2) {
    const cx = _v2brkCtx;
    const areaH = V2BRK_PAD_Y - V2BRK_OY;
    const ox    = V2BRK_OX + V2BRK_PFW / 2;
    const oy    = V2BRK_OY + areaH / 2;
    cx.globalAlpha = 0.55;
    cx.fillStyle   = V2BRK_C_OV_BG;
    cx.fillRect(V2BRK_OX, V2BRK_OY, V2BRK_PFW, areaH);
    cx.globalAlpha = 1.0;
    cx.textAlign   = "center";
    if (line1) {
        cx.fillStyle = col1;
        cx.font      = v2brkFnt(28);
        cx.fillText(line1, ox, oy - (line2 ? 18 : 0));
    }
    if (line2) {
        cx.fillStyle = col2;
        cx.font      = v2brkFnt(16);
        cx.fillText(line2, ox, oy + 20);
    }
    cx.textAlign = "left";
}

// Full-canvas game-over / win results screen (§15c style, adapted for 960×640)
function v2brkDrawGameOver(headline) {
    const cx   = _v2brkCtx;
    const midX = V2_CW / 2;
    const midY = V2_CH / 2;

    // Full-canvas dark overlay
    cx.fillStyle = "rgba(8,8,24,0.88)";
    cx.fillRect(0, 0, V2_CW, V2_CH);

    // Headline
    cx.font         = "bold 34px sans-serif";
    cx.fillStyle    = "#ffffff";
    cx.textAlign    = "center";
    cx.textBaseline = "alphabetic";
    cx.fillText(headline, midX, midY - 72);

    // Sub-label
    cx.font      = v2brkFnt(14);
    cx.fillStyle = "#8888cc";
    cx.fillText("FINAL SCORE", midX, midY - 28);

    // Score
    cx.font      = "bold " + v2brkFnt(52);
    cx.fillStyle = "#f0d020";
    cx.fillText(String(v2brkScore).padStart(6, "0"), midX, midY + 26);

    // PB line — only shown if a PB is recorded
    if (v2brkPB > 0) {
        if (v2brkNewBest) {
            cx.font      = "bold " + v2brkFnt(14);
            cx.fillStyle = "#60ff60";
            cx.fillText("NEW BEST! \u2B50", midX, midY + 58);
        } else {
            cx.font      = v2brkFnt(12);
            cx.fillStyle = "#6666aa";
            cx.fillText("BEST: " + String(v2brkPB).padStart(6, "0"), midX, midY + 58);
        }
    }

    // Play Again button
    const btnW    = 200, btnH = 52, btnR = 14;
    const btnX    = midX - btnW / 2;
    const btnY    = midY + 68;
    const locked  = v2brkOverLockMs < 1000;

    cx.beginPath();
    cx.moveTo(btnX + btnR, btnY);
    cx.lineTo(btnX + btnW - btnR, btnY);
    cx.arcTo(btnX + btnW, btnY, btnX + btnW, btnY + btnR, btnR);
    cx.lineTo(btnX + btnW, btnY + btnH - btnR);
    cx.arcTo(btnX + btnW, btnY + btnH, btnX + btnW - btnR, btnY + btnH, btnR);
    cx.lineTo(btnX + btnR, btnY + btnH);
    cx.arcTo(btnX, btnY + btnH, btnX, btnY + btnH - btnR, btnR);
    cx.lineTo(btnX, btnY + btnR);
    cx.arcTo(btnX, btnY, btnX + btnR, btnY, btnR);
    cx.closePath();
    cx.fillStyle   = locked ? "#222222" : "#1a5a1a";
    cx.fill();
    cx.strokeStyle = locked ? "#555555" : "#50c050";
    cx.lineWidth   = 2;
    cx.stroke();

    cx.font         = "bold 20px sans-serif";
    cx.fillStyle    = "#ffffff";
    cx.textBaseline = "middle";
    cx.fillText(locked ? "WAIT..." : "PLAY AGAIN", midX, btnY + btnH / 2);

    cx.textAlign    = "left";
    cx.textBaseline = "alphabetic";
}

function v2brkDrawBg() {
    const cx = _v2brkCtx;
    if (_v2brkBgLoaded && SHELL_isBgEnabled()) {
        // Cover-fill: centre-crop the image to fill the full 960×640 canvas
        const iw    = _v2brkBgImg.naturalWidth;
        const ih    = _v2brkBgImg.naturalHeight;
        const scale = Math.max(V2_CW / iw, V2_CH / ih);
        const sw    = V2_CW / scale;
        const sh    = V2_CH / scale;
        const sx    = (iw - sw) / 2;
        const sy    = (ih - sh) / 2;
        cx.drawImage(_v2brkBgImg, sx, sy, sw, sh, 0, 0, V2_CW, V2_CH);
    } else {
        cx.fillStyle = V2BRK_C_BG;
        cx.fillRect(0, 0, V2_CW, V2_CH);
    }
}

function v2brkDraw() {
    const cx = _v2brkCtx;

    // Full canvas background (image or solid fallback)
    v2brkDrawBg();

    // Play field background (block area + ball travel + just below paddle)
    cx.fillStyle = V2BRK_C_PF_BG;
    cx.fillRect(V2BRK_OX, 0, V2BRK_PFW, V2BRK_PLAY_CLIP_H);

    // HUD stats strip — overdraws the top portion with its own styled background
    if (v2brkState >= V2BRK_S_READY) {
        v2brkDrawStats();
    }

    // Clip all in-field drawing to the play column
    cx.save();
    cx.beginPath();
    cx.rect(V2BRK_OX, 0, V2BRK_PFW, V2BRK_PLAY_CLIP_H);
    cx.clip();

    switch (v2brkState) {

        case V2BRK_S_LOADING:
            cx.fillStyle    = V2BRK_C_OV_TXT;
            cx.font         = v2brkFnt(18);
            cx.textAlign    = "center";
            cx.textBaseline = "middle";
            cx.fillText("LOADING...", V2BRK_OX + V2BRK_PFW / 2, V2BRK_OY + (V2BRK_PAD_Y - V2BRK_OY) / 2);
            cx.textAlign    = "left";
            cx.textBaseline = "alphabetic";
            break;

        case V2BRK_S_READY:
            v2brkDrawBoard();
            v2brkDrawPaddle();
            v2brkDrawBall();
            cx.fillStyle    = V2BRK_C_OV_SUB;
            cx.font         = v2brkFnt(14);
            cx.textAlign    = "center";
            cx.textBaseline = "alphabetic";
            cx.fillText("tap or click to launch", V2BRK_OX + V2BRK_PFW / 2, V2BRK_PAD_Y - 10);
            cx.textAlign    = "left";
            break;

        case V2BRK_S_PLAYING:
            v2brkDrawBoard();
            v2brkDrawParts();
            v2brkDrawPaddle();
            v2brkDrawBall();
            if (v2brkCombo > 1) {
                const cTxt = "COMBO x" + v2brkCombo;
                const cX   = V2BRK_OX + V2BRK_PFW / 2;
                const cY   = V2BRK_OY + (V2BRK_PAD_Y - V2BRK_OY) / 2;
                cx.font         = v2brkFnt(28);
                cx.textAlign    = "center";
                cx.textBaseline = "middle";
                cx.fillStyle    = "#000000";
                cx.fillText(cTxt, cX + 2, cY + 2);
                cx.fillStyle    = V2BRK_C_COMBO_TXT;
                cx.fillText(cTxt, cX, cY);
                cx.textAlign    = "left";
                cx.textBaseline = "alphabetic";
            }
            break;

        case V2BRK_S_BALLLOST:
            v2brkDrawBoard();
            v2brkDrawPaddle();
            v2brkOverlay("BALL LOST", V2BRK_C_GAMEOVER, v2brkBalls + " ball" + (v2brkBalls === 1 ? "" : "s") + " remaining", V2BRK_C_OV_SUB);
            break;

        case V2BRK_S_CLEAR:
            v2brkDrawBoard();
            v2brkOverlay("STAGE CLEAR!", V2BRK_C_CLEAR, "+1 BALL", V2BRK_C_OV_SUB);
            break;

        case V2BRK_S_GAMEOVER:
            v2brkDrawBoard();
            v2brkDrawPaddle();
            break;

        case V2BRK_S_COMPLETE:
            v2brkDrawBoard();
            break;
    }

    cx.restore();   // end play-field clip

    // Full-canvas game-over / win overlay — drawn after clip restore so it covers the full canvas
    if (v2brkState === V2BRK_S_GAMEOVER) v2brkDrawGameOver("GAME OVER");
    if (v2brkState === V2BRK_S_COMPLETE) v2brkDrawGameOver("YOU WIN!");

    // Separator + drag zone — drawn outside clip once game is in progress
    if (v2brkState >= V2BRK_S_READY &&
        v2brkState !== V2BRK_S_GAMEOVER &&
        v2brkState !== V2BRK_S_COMPLETE) {
        cx.strokeStyle = V2BRK_C_SEP;
        cx.lineWidth   = 1;
        cx.beginPath();
        cx.moveTo(V2BRK_OX,             V2BRK_SEP_Y);
        cx.lineTo(V2BRK_OX + V2BRK_PFW, V2BRK_SEP_Y);
        cx.stroke();
        v2brkDrawDragZone();
    }
}

// =============================================================================
// GAME INTERFACE
// =============================================================================
const GAME = {
    title:      "Space Blocks",
    resetLabel: "RESET",

    init(canvas) {
        _v2brkCtx    = canvas.getContext("2d");
        _v2brkCanvas = canvas;
        // Load PB — migrate from legacy "breakout_score" key if new key is absent
        v2brkPB = SHELL_getPB(V2BRK_PB_KEY) || 0;
        if (v2brkPB === 0) {
            const legacy = SHELL_getPB(V2BRK_PB_KEY_LEGACY) || 0;
            if (legacy > 0) { v2brkPB = legacy; SHELL_setPB(V2BRK_PB_KEY, legacy); }
        }
        v2brkState   = V2BRK_S_LOADING;
        v2brkLoadLevels();

        // Background image (space art — 960×640 recommended)
        _v2brkBgImg     = new Image();
        _v2brkBgImg.onload = function() { _v2brkBgLoaded = true; };
        _v2brkBgImg.src = "space-blocks/bg.jpg";

        // Pointer lock for free mouse tracking on desktop
        document.addEventListener("pointerlockchange", v2brkOnLockChange);
        document.addEventListener("mousemove",         v2brkOnFreeMouse);

        // Arrow key paddle control
        window.addEventListener("keydown", e => {
            if (e.key === "ArrowLeft")  _v2brkKeyLeft  = true;
            if (e.key === "ArrowRight") _v2brkKeyRight = true;
        });
        window.addEventListener("keyup", e => {
            if (e.key === "ArrowLeft")  _v2brkKeyLeft  = false;
            if (e.key === "ArrowRight") _v2brkKeyRight = false;
        });
    },

    // Called automatically by the shell right after init.
    // Levels may still be fetching — v2brkWantsStart defers the actual start.
    start() {
        v2brkWantsStart = true;
        if (v2brkStages) v2brkStartGame();
    },

    // Called from the title bar Reset button — always a real user gesture,
    // so pointer lock can be requested here safely.
    reset() {
        if (!v2brkStages) return;
        v2brkStartGame();
        v2brkLockMouse();
    },

    update(dt) {
        if (v2brkState === V2BRK_S_LOADING) return;

        // Game over / complete — tick button lock timer, nothing else
        if (v2brkState === V2BRK_S_GAMEOVER || v2brkState === V2BRK_S_COMPLETE) {
            v2brkOverLockMs += dt;
            return;
        }

        // Timed state transitions (BALLLOST, CLEAR)
        if (v2brkStateTmr > 0) {
            v2brkStateTmr -= dt;
            if (v2brkStateTmr <= 0) {
                v2brkStateTmr = 0;
                if (v2brkState === V2BRK_S_BALLLOST) {
                    v2brkEnter(V2BRK_S_READY);
                } else if (v2brkState === V2BRK_S_CLEAR) {
                    v2brkStageIdx++;
                    if (v2brkStageIdx >= v2brkTotalStages) {
                        v2brkEnter(V2BRK_S_COMPLETE);
                    } else {
                        v2brkLoadGrid(v2brkStageIdx);
                        v2brkEnter(V2BRK_S_READY);
                    }
                }
            }
            return;
        }

        // Arrow key paddle movement (READY and PLAYING)
        if (v2brkState === V2BRK_S_READY || v2brkState === V2BRK_S_PLAYING) {
            if (_v2brkKeyLeft)  { v2brkPadX -= V2BRK_PAD_KEY_SPD; v2brkClampPad(); }
            if (_v2brkKeyRight) { v2brkPadX += V2BRK_PAD_KEY_SPD; v2brkClampPad(); }
        }

        // READY — keep ball glued to paddle top
        if (v2brkState === V2BRK_S_READY) {
            v2brkBX = v2brkPadX;
            v2brkBY = v2brkBallSitY();
        }

        // PLAYING — full physics
        if (v2brkState === V2BRK_S_PLAYING) v2brkUpdatePlaying(dt);
    },

    draw() { v2brkDraw(); },

    // Tap / click — launch ball from READY, or hit Play Again on end screens.
    onClick(mx, my) {
        if (v2brkState === V2BRK_S_READY) {
            v2brkLockMouse();
            v2brkLaunch();
            return;
        }
        if (v2brkState === V2BRK_S_GAMEOVER || v2brkState === V2BRK_S_COMPLETE) {
            if (v2brkOverLockMs < 1000) return;
            // Hit-test the Play Again button (200×52, centred, top y = V2_CH/2 + 68)
            const btnW  = 200, btnH = 52;
            const btnX  = V2_CW / 2 - btnW / 2;
            const btnY  = V2_CH / 2 + 68;
            if (mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH) {
                v2brkStartGame();
                v2brkLockMouse();
            }
        }
    },

    // Drag (touchmove or held mouse via shell) — move paddle.
    // Input outside the drag zone rect is ignored.
    // On desktop the pointer-lock path handles free mouse; this covers touch.
    onDrag(mx, my) {
        if (my < V2BRK_DZ_TOP || my > V2BRK_DZ_BOT) return;
        if (v2brkState === V2BRK_S_READY || v2brkState === V2BRK_S_PLAYING) {
            v2brkPadX = mx;
            v2brkClampPad();
        }
    },

    onSwipe(dir) {}
};
