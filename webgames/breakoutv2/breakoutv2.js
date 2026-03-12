// =============================================================================
// breakoutv2.js  —  Breakout for game-v2.html  (960 × 640 canvas)
// Place at:  ./webgames/breakoutv2/breakoutv2.js
// Levels at: ./webgames/breakoutv2/breakout.lev   (copy from breakout/)
// Sounds at: ./webgames/breakoutv2/*.ogg           (copy from breakout/)
// =============================================================================

// ── grid ──────────────────────────────────────────────────────────────────────
const V2BRK_COLS         = 10;
const V2BRK_ROWS         = 10;
const V2BRK_BW           = 54;                                  // block width  px
const V2BRK_BH           = 27;                                  // block height px
const V2BRK_OX           = Math.floor((V2_CW - V2BRK_COLS * V2BRK_BW) / 2); // 210
const V2BRK_OY           = 20;                                  // block grid top y

// ── play-field walls (ball bounces within this column) ────────────────────────
const V2BRK_PFW          = V2BRK_COLS * V2BRK_BW;              // 540
const V2BRK_PF_LEFT      = V2BRK_OX;                           // left wall x   (210)
const V2BRK_PF_RIGHT     = V2BRK_OX + V2BRK_PFW;              // right wall x  (750)
const V2BRK_PF_TOP       = V2BRK_OY;                           // ceiling y

// ── ball ──────────────────────────────────────────────────────────────────────
const V2BRK_BALL_R       = 8;                                   // radius px
const V2BRK_SPEED        = 4.5;                                 // px per update step
const V2BRK_DELTA_MAX    = 2.7;                                 // max dx/dy component
const V2BRK_LAUNCH_SPREAD = 0.5;                                // ± radians from straight up

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
const V2BRK_STATS_LBL_Y  = 436;                                 // stats label baseline   ← adjust
const V2BRK_STATS_VAL_Y  = 452;                                 // stats value baseline   ← adjust
const V2BRK_DRAG_Y       = 476;                                 // drag zone top hint y   ← adjust

// ── game limits ───────────────────────────────────────────────────────────────
const V2BRK_MAX_STAGES   = 32;
const V2BRK_INIT_BALLS   = 3;
const V2BRK_MAX_BALLS    = 10;
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
const V2BRK_PB_KEY       = "breakout_score";

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
const V2BRK_C_BG         = "#0D0D1A";   // canvas background (outside play column)
const V2BRK_C_PF_BG      = "#000000";   // play field background
const V2BRK_C_SEP        = "#2A2A4A";   // separator line
const V2BRK_C_DRAG_LINE  = "#1E1E3A";   // drag zone dashed hint
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
const V2BRK_SND_LAUNCH   = new Audio("breakoutv2/launch.ogg");
const V2BRK_SND_RELAUNCH = new Audio("breakoutv2/relaunch.ogg");
const V2BRK_SND_BOUNCE   = new Audio("breakoutv2/bounce.ogg");
const V2BRK_SND_BREAK    = new Audio("breakoutv2/break.ogg");
const V2BRK_SND_COMBO1   = new Audio("breakoutv2/combo1.ogg");
const V2BRK_SND_COMBO2   = new Audio("breakoutv2/combo2.ogg");
const V2BRK_SND_SOLID    = new Audio("breakoutv2/solid.ogg");
const V2BRK_SND_MISS     = new Audio("breakoutv2/miss.ogg");
const V2BRK_SND_GAMEOVER = new Audio("breakoutv2/gameover.ogg");
const V2BRK_SND_CLEAR    = new Audio("breakoutv2/clear.ogg");
const V2BRK_SND_HISCORE  = new Audio("breakoutv2/hiscore.ogg");

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
    fetch("breakoutv2/breakout.lev")
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
let _v2brkLocked   = false;

// =============================================================================
// POINTER LOCK — free mouse tracking on desktop
// =============================================================================
function v2brkOnLockChange() {
    _v2brkLocked = (document.pointerLockElement === _v2brkCanvas);
}

function v2brkOnFreeMouse(e) {
    if (!_v2brkLocked) return;
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
        v2brkSnd(V2BRK_SND_GAMEOVER);
        v2brkUnlockMouse();
    }

    if (st === V2BRK_S_COMPLETE) {
        v2brkCheckBest();
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
        v2brkSnd(V2BRK_SND_BOUNCE);
    } else if (v2brkBX > V2BRK_PF_RIGHT - V2BRK_BALL_R) {
        v2brkBX  = V2BRK_PF_RIGHT - V2BRK_BALL_R;
        v2brkBDX = -Math.abs(v2brkBDX);
        v2brkSnd(V2BRK_SND_BOUNCE);
    }

    // Ceiling
    if (v2brkBY < V2BRK_PF_TOP + V2BRK_BALL_R) {
        v2brkBY  = V2BRK_PF_TOP + V2BRK_BALL_R;
        v2brkBDY = Math.abs(v2brkBDY);
        v2brkSnd(V2BRK_SND_BOUNCE);
    }

    // Block collision (skip once ball is clearly below block grid)
    if (v2brkBY < V2BRK_OY + V2BRK_ROWS * V2BRK_BH + V2BRK_BALL_R) {
        v2brkCollideBlocks();
    }

    // Paddle collision
    if (v2brkBY + V2BRK_BALL_R >= V2BRK_PAD_Y  &&
        v2brkBY - V2BRK_BALL_R <= V2BRK_PAD_Y + V2BRK_PAD_H &&
        v2brkBX  >= v2brkPadLeft()  - V2BRK_BALL_R &&
        v2brkBX  <= v2brkPadRight() + V2BRK_BALL_R) {
        v2brkBY       = V2BRK_PAD_Y - V2BRK_BALL_R - 1;
        v2brkBDY      = -Math.abs(v2brkBDY);              // always bounce upward
        v2brkBDX     += (v2brkBX - v2brkPadX) * V2BRK_PAD_INF;
        v2brkCombo    = 0;
        v2brkStuckMs  = 0;
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

// Stats strip — four items centred in equal quarters of the play field width
function v2brkDrawStats() {
    const cx   = _v2brkCtx;
    const segW = V2BRK_PFW / 4;   // 135 px per segment

    // Separator line
    cx.strokeStyle = V2BRK_C_SEP;
    cx.lineWidth   = 1;
    cx.beginPath();
    cx.moveTo(V2BRK_OX,           V2BRK_SEP_Y);
    cx.lineTo(V2BRK_OX + V2BRK_PFW, V2BRK_SEP_Y);
    cx.stroke();

    cx.textBaseline = "alphabetic";
    cx.textAlign    = "center";

    // Helper: draw dim label above bright value
    function statCell(segIdx, lbl, val) {
        const segCX = V2BRK_OX + segIdx * segW + segW / 2;
        cx.font      = v2brkFnt(12);
        cx.fillStyle = V2BRK_C_STATS_LBL;
        cx.fillText(lbl, segCX, V2BRK_STATS_LBL_Y);
        cx.font      = v2brkFnt(15);
        cx.fillStyle = V2BRK_C_STATS_VAL;
        cx.fillText(val, segCX, V2BRK_STATS_VAL_Y);
    }

    statCell(0, "STAGE", (v2brkStageIdx + 1) + "/" + v2brkTotalStages);
    statCell(1, "SCORE", String(v2brkScore).padStart(6, "0"));
    statCell(2, "BEST",  String(v2brkPB).padStart(6, "0"));

    // Balls segment: label + row of small circles
    const ballSegCX   = V2BRK_OX + 3 * segW + segW / 2;
    const ballSpacing = 12;
    const ballsW      = (v2brkBalls - 1) * ballSpacing;
    const ballsStartX = ballSegCX - ballsW / 2;
    const ballsY      = V2BRK_STATS_VAL_Y - 4;

    cx.font      = v2brkFnt(12);
    cx.fillStyle = V2BRK_C_STATS_LBL;
    cx.fillText("BALLS", ballSegCX, V2BRK_STATS_LBL_Y);

    for (let i = 0; i < v2brkBalls; i++) {
        cx.beginPath();
        cx.arc(ballsStartX + i * ballSpacing, ballsY, 4, 0, Math.PI * 2);
        cx.fillStyle   = V2BRK_C_BALL_MAIN;
        cx.fill();
        cx.strokeStyle = V2BRK_C_STATS_LBL;
        cx.lineWidth   = 1;
        cx.stroke();
    }

    cx.textAlign = "left";
}

// Subtle dashed line hinting the start of the drag zone
function v2brkDrawDragHint() {
    const cx = _v2brkCtx;
    cx.save();
    cx.strokeStyle = V2BRK_C_DRAG_LINE;
    cx.lineWidth   = 1;
    cx.setLineDash([8, 8]);
    cx.beginPath();
    cx.moveTo(V2BRK_OX,           V2BRK_DRAG_Y);
    cx.lineTo(V2BRK_OX + V2BRK_PFW, V2BRK_DRAG_Y);
    cx.stroke();
    cx.setLineDash([]);
    cx.restore();
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

function v2brkDraw() {
    const cx = _v2brkCtx;

    // Full canvas background
    cx.fillStyle = V2BRK_C_BG;
    cx.fillRect(0, 0, V2_CW, V2_CH);

    // Play field background (block area + ball travel + just below paddle)
    cx.fillStyle = V2BRK_C_PF_BG;
    cx.fillRect(V2BRK_OX, 0, V2BRK_PFW, V2BRK_PLAY_CLIP_H);

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
            v2brkOverlay("BALL LOST", V2BRK_C_GAMEOVER, null, null);
            break;

        case V2BRK_S_CLEAR:
            v2brkDrawBoard();
            v2brkOverlay("STAGE CLEAR!", V2BRK_C_CLEAR, "+1 BALL", V2BRK_C_OV_SUB);
            break;

        case V2BRK_S_GAMEOVER:
            v2brkOverlay(
                "GAME OVER", V2BRK_C_GAMEOVER,
                v2brkNewBest ? "NEW BEST SCORE!" : "Press RESET to try again",
                v2brkNewBest ? V2BRK_C_NEWBEST : V2BRK_C_OV_SUB
            );
            break;

        case V2BRK_S_COMPLETE:
            v2brkOverlay(
                "YOU WIN!", V2BRK_C_CLEAR,
                v2brkNewBest ? "NEW BEST SCORE!" : "Press RESET to play again",
                v2brkNewBest ? V2BRK_C_NEWBEST : V2BRK_C_OV_SUB
            );
            break;
    }

    cx.restore();   // end play-field clip

    // Stats + drag hint drawn outside clip, only once a game is in progress
    if (v2brkState >= V2BRK_S_READY) {
        v2brkDrawStats();
        v2brkDrawDragHint();
    }
}

// =============================================================================
// GAME INTERFACE
// =============================================================================
const GAME = {
    title:      "Breakout",
    resetLabel: "RESET",

    init(canvas) {
        _v2brkCtx    = canvas.getContext("2d");
        _v2brkCanvas = canvas;
        v2brkPB      = SHELL_getPB(V2BRK_PB_KEY) || 0;
        v2brkState   = V2BRK_S_LOADING;
        v2brkLoadLevels();

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

    // Tap / click — launch ball from READY state.
    // Also re-acquires pointer lock in case player pressed Escape during READY.
    onClick(mx, my) {
        if (v2brkState === V2BRK_S_READY) {
            v2brkLockMouse();
            v2brkLaunch();
        }
    },

    // Drag (touchmove or held mouse via shell) — move paddle.
    // On desktop the pointer-lock path handles free mouse; this covers touch.
    onDrag(mx, my) {
        if (v2brkState === V2BRK_S_READY || v2brkState === V2BRK_S_PLAYING) {
            v2brkPadX = mx;
            v2brkClampPad();
        }
    },

    onSwipe(dir) {}
};
