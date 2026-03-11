// =============================================================================
// breakout.js  —  shell-compatible Breakout port
// Place at:  ./webgames/breakout/breakout.js
// Levels at: ./webgames/breakout/breakout.lev
// Sounds at: ./webgames/breakout/*.ogg
// =============================================================================

// ---------- grid ----------
const BRK_COLS        = 10;
const BRK_ROWS        = 10;
const BRK_BW          = 36;                              // block width  px
const BRK_BH          = 18;                              // block height px
const BRK_OX          = SHELL_PFX;                       // block grid origin x (16)
const BRK_OY          = SHELL_PFY;                       // block grid origin y (16)

// ---------- ball ----------
const BRK_BALL_R      = 5;                               // radius px
const BRK_SPEED       = 3.0;                             // px per update step
const BRK_DELTA_MAX   = 1.8;                             // max dx / dy component
const BRK_LAUNCH_SPREAD = 0.5;                           // ± radians from straight up

// ---------- paddle ----------
const BRK_PAD_W       = 45;                              // width  px
const BRK_PAD_H       = 9;                               // height px
const BRK_PAD_Y       = SHELL_PFY + SHELL_PFH - BRK_PAD_H - 4;  // 291
const BRK_PAD_EDGE    = 5;                               // min gap from play-field wall
const BRK_PAD_INF     = 0.05;                            // paddle-offset influence on ball dx

// ---------- game limits ----------
const BRK_MAX_STAGES  = 32;
const BRK_INIT_BALLS  = 3;
const BRK_MAX_BALLS   = 10;
const BRK_MAX_PARTS   = 15;
const BRK_STUCK_MS    = 12000;                           // stuck-ball timeout

// ---------- particles ----------
const BRK_PT_FALL     = 1.8;                             // fall speed px per step
const BRK_PT_AMP      = 10;                              // sinusoidal side drift amplitude px
const BRK_PT_FREQ     = 0.12;                            // drift frequency radians per age step

// ---------- state timers ----------
const BRK_BALLLOST_MS = 1200;
const BRK_CLEAR_MS    = 2000;

// ---------- scoring ----------
const BRK_SCORE_BASE  = 5;                               // score = BASE * blockVal * combo
const BRK_COMBO1_AT   = 2;                               // play combo1 sound at this count
const BRK_COMBO2_AT   = 6;                               // play combo2 sound at this count

// ---------- PB key ----------
const BRK_PB_KEY      = "breakout_score";

// ---------- sidebar y positions ----------
const BRK_SB_STAGE_Y  = SHELL_SBY + 18;
const BRK_SB_SCORE_Y  = SHELL_SBY + 36;
const BRK_SB_BEST_Y   = SHELL_SBY + 54;
const BRK_SB_BALLS_Y  = SHELL_SBY + 72;
const BRK_SB_COMBO_Y  = SHELL_SBY + 90;

// ---------- states ----------
const BRK_S_LOADING   = 0;
const BRK_S_IDLE      = 1;
const BRK_S_READY     = 2;
const BRK_S_PLAYING   = 3;
const BRK_S_BALLLOST  = 4;
const BRK_S_CLEAR     = 5;
const BRK_S_GAMEOVER  = 6;
const BRK_S_COMPLETE  = 7;

// ---------- block color palette  [shadow, face]  index = block value ----------
const BRK_BLOCK_CLR = [
    ["#000000", "#000000"],   // 0  empty
    ["#0000AA", "#5555FF"],   // 1
    ["#00AA00", "#55FF55"],   // 2
    ["#AA0000", "#FF5555"],   // 3
    ["#AA00AA", "#FF55FF"],   // 4
    ["#AA5500", "#FFFF55"],   // 5
    ["#00AAAA", "#55FFFF"],   // 6
    ["#555555", "#AAAAAA"],   // 7  solid / indestructible
];

// ---------- other colors ----------
const BRK_C_PF_BG      = "#000000";
const BRK_C_PAD_DARK   = "#006400";
const BRK_C_PAD_MID    = "#00AA00";
const BRK_C_PAD_MAIN   = "#00CC00";
const BRK_C_PAD_LIGHT  = "#88FF88";
const BRK_C_PAD_SHINE  = "#CCFFCC";
const BRK_C_BALL_SHAD  = "#888888";
const BRK_C_BALL_MAIN  = "#FFFF88";
const BRK_C_BALL_SHINE = "#FFFFFF";
const BRK_C_OV_BG      = "#000000";
const BRK_C_OV_TXT     = "#FFFFFF";
const BRK_C_OV_SUB     = "#93A0B3";
const BRK_C_GAMEOVER   = "#FF5555";
const BRK_C_CLEAR      = "#55FF55";
const BRK_C_NEWBEST    = "#FFFF55";
const BRK_C_SB_TXT     = "#1C2333";
const BRK_C_COMBO_TXT  = "#AADE55";

// ---------- sounds ----------
const BRK_SND_LAUNCH   = new Audio("breakout/launch.ogg");
const BRK_SND_RELAUNCH = new Audio("breakout/relaunch.ogg");
const BRK_SND_BOUNCE   = new Audio("breakout/bounce.ogg");
const BRK_SND_BREAK    = new Audio("breakout/break.ogg");
const BRK_SND_COMBO1   = new Audio("breakout/combo1.ogg");
const BRK_SND_COMBO2   = new Audio("breakout/combo2.ogg");
const BRK_SND_SOLID    = new Audio("breakout/solid.ogg");
const BRK_SND_MISS     = new Audio("breakout/miss.ogg");
const BRK_SND_GAMEOVER = new Audio("breakout/gameover.ogg");
const BRK_SND_CLEAR    = new Audio("breakout/clear.ogg");
const BRK_SND_HISCORE  = new Audio("breakout/hiscore.ogg");

function brkSnd(snd) {
    if (!SHELL_isMuted()) { snd.currentTime = 0; snd.play().catch(() => {}); }
}

// =============================================================================
// LEVEL DATA
// =============================================================================
// brkStages[stageIndex][row][col]  — working template, never modified during play
// brkGrid[row][col]                — live copy for the current stage

let brkStages      = null;   // loaded async; null = still loading
let brkTotalStages = 0;
let brkGrid        = [];

function brkLoadLevels() {
    fetch("breakout/breakout.lev")
        .then(r => r.text())
        .then(txt => {
            const nums = txt.trim().split(/\s+/).map(Number);
            brkStages = [];
            let idx = 0;
            for (let st = 0; st < BRK_MAX_STAGES; st++) {
                brkStages[st] = [];
                for (let row = 0; row < BRK_ROWS; row++) {
                    brkStages[st][row] = new Uint8Array(BRK_COLS);
                    for (let col = 0; col < BRK_COLS; col++) {
                        brkStages[st][row][col] = nums[idx++] || 0;
                    }
                }
            }
            // count stages that have at least one destructible block
            brkTotalStages = 0;
            for (let st = 0; st < BRK_MAX_STAGES; st++) {
                outer: for (let row = 0; row < BRK_ROWS; row++) {
                    for (let col = 0; col < BRK_COLS; col++) {
                        if (brkStages[st][row][col] > 0) { brkTotalStages++; break outer; }
                    }
                }
            }
            if (brkState === BRK_S_LOADING) brkState = BRK_S_IDLE;
        })
        .catch(() => {
            // fallback: simple placeholder level set
            brkStages = [];
            for (let st = 0; st < BRK_MAX_STAGES; st++) {
                brkStages[st] = [];
                for (let row = 0; row < BRK_ROWS; row++) {
                    brkStages[st][row] = new Uint8Array(BRK_COLS);
                    if (row < 5) {
                        for (let col = 0; col < BRK_COLS; col++) {
                            brkStages[st][row][col] = (row % 6) + 1;
                        }
                    }
                }
            }
            brkTotalStages = BRK_MAX_STAGES;
            if (brkState === BRK_S_LOADING) brkState = BRK_S_IDLE;
        });
}

function brkLoadGrid(stIdx) {
    brkGrid = [];
    for (let row = 0; row < BRK_ROWS; row++) {
        brkGrid[row] = new Uint8Array(BRK_COLS);
        for (let col = 0; col < BRK_COLS; col++) {
            brkGrid[row][col] = brkStages[stIdx][row][col];
        }
    }
}

function brkStageClear() {
    for (let row = 0; row < BRK_ROWS; row++)
        for (let col = 0; col < BRK_COLS; col++)
            if (brkGrid[row][col] > 0 && brkGrid[row][col] < 7) return false;
    return true;
}

// =============================================================================
// GAME STATE
// =============================================================================
let brkState      = BRK_S_LOADING;
let brkStateTmr   = 0;        // ms countdown for timed state transitions

let brkStageIdx   = 0;
let brkScore      = 0;
let brkPB         = 0;
let brkBalls      = BRK_INIT_BALLS;
let brkCombo      = 0;
let brkStuckMs    = 0;
let brkNewBest    = false;

// paddle
let brkPadX       = SHELL_PFX + SHELL_PFW / 2;

// ball — position, previous position, velocity components
let brkBX         = 0;
let brkBY         = 0;
let brkBPX        = 0;
let brkBPY        = 0;
let brkBDX        = 0;
let brkBDY        = 0;

// particles  { bx, y, col, age, ph }
let brkParts      = [];

// canvas / context set in init()
let _brkCtx       = null;
let _brkCanvas    = null;

// pointer lock state
let _brkLocked    = false;

// =============================================================================
// POINTER LOCK — free mouse tracking
// =============================================================================

// Called by the browser whenever pointer lock status changes.
function brkOnLockChange() {
    _brkLocked = (document.pointerLockElement === _brkCanvas);
}

// Receives every raw mousemove event.
// When locked, uses movementX (relative delta, CSS pixels) to drive the paddle.
// Scale factor converts from CSS-pixel movement into logical canvas units.
function brkOnFreeMouse(e) {
    if (!_brkLocked) return;
    if (brkState !== BRK_S_READY && brkState !== BRK_S_PLAYING) return;
    const rc    = _brkCanvas.getBoundingClientRect();
    const scale = SHELL_CW / rc.width;
    brkPadX += e.movementX * scale;
    brkClampPad();
}

// Request pointer lock — must be called from inside a user-gesture handler.
function brkLockMouse() {
    if (_brkCanvas && !_brkLocked) _brkCanvas.requestPointerLock();
}

// Release pointer lock.
function brkUnlockMouse() {
    if (_brkLocked) document.exitPointerLock();
}

// =============================================================================
// HELPERS
// =============================================================================
function brkFnt(sz) { return `${sz}px Consolas,"Lucida Console","Courier New",monospace`; }

function brkPadLeft()  { return brkPadX - BRK_PAD_W / 2; }
function brkPadRight() { return brkPadX + BRK_PAD_W / 2; }
function brkBallSitY() { return BRK_PAD_Y - BRK_BALL_R - 1; }

function brkClampPad() {
    const lo = SHELL_PFX + BRK_PAD_W / 2 + BRK_PAD_EDGE;
    const hi = SHELL_PFX + SHELL_PFW - BRK_PAD_W / 2 - BRK_PAD_EDGE;
    if (brkPadX < lo) brkPadX = lo;
    if (brkPadX > hi) brkPadX = hi;
}

function brkCapDelta() {
    if (brkBDX < -BRK_DELTA_MAX) brkBDX = -BRK_DELTA_MAX;
    if (brkBDX >  BRK_DELTA_MAX) brkBDX =  BRK_DELTA_MAX;
    if (brkBDY < -BRK_DELTA_MAX) brkBDY = -BRK_DELTA_MAX;
    if (brkBDY >  BRK_DELTA_MAX) brkBDY =  BRK_DELTA_MAX;
}

// =============================================================================
// STATE MACHINE
// =============================================================================
function brkEnter(s) {
    brkState    = s;
    brkStateTmr = 0;

    if (s === BRK_S_READY) {
        brkBX    = brkPadX;
        brkBY    = brkBallSitY();
        brkBDX   = 0;
        brkBDY   = 0;
        brkParts = [];
    }

    if (s === BRK_S_CLEAR) {
        brkStateTmr = BRK_CLEAR_MS;
        if (brkBalls < BRK_MAX_BALLS) brkBalls++;
        brkSnd(BRK_SND_CLEAR);
    }

    if (s === BRK_S_BALLLOST) {
        brkStateTmr = BRK_BALLLOST_MS;
        brkSnd(BRK_SND_MISS);
    }

    if (s === BRK_S_GAMEOVER) {
        brkSnd(BRK_SND_GAMEOVER);
        brkCheckBest();
        brkUnlockMouse();   // release pointer lock — game is over
    }

    if (s === BRK_S_COMPLETE) {
        brkCheckBest();
        brkUnlockMouse();   // release pointer lock — game is over
    }
}

function brkCheckBest() {
    if (brkScore > brkPB) {
        brkPB = brkScore;
        SHELL_setPB(BRK_PB_KEY, brkPB);
        brkSnd(BRK_SND_HISCORE);
        brkNewBest = true;
    }
}

function brkStartGame() {
    brkStageIdx = 0;
    brkScore    = 0;
    brkBalls    = BRK_INIT_BALLS;
    brkCombo    = 0;
    brkNewBest  = false;
    brkLoadGrid(0);
    brkEnter(BRK_S_READY);
}

// =============================================================================
// LAUNCH
// =============================================================================
function brkLaunch() {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * BRK_LAUNCH_SPREAD;
    brkBDX     = Math.cos(angle);
    brkBDY     = Math.sin(angle);   // negative = upward
    brkStuckMs = 0;
    brkCombo   = 0;
    brkSnd(BRK_SND_LAUNCH);
    brkEnter(BRK_S_PLAYING);
}

// =============================================================================
// COLLISION  — fixed: collect all contacts first, reflect each axis once only
// =============================================================================
function brkCircVsRect(cx, cy, r, rx, ry, rw, rh) {
    const nearX = Math.max(rx, Math.min(cx, rx + rw));
    const nearY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nearX, dy = cy - nearY;
    return dx * dx + dy * dy < r * r;
}

// Determine which axis the ball was approaching from, using prev position.
// Falls back to normalized block-center distance when already overlapping.
function brkContactFace(cx, cy, px, py, rx, ry, rw, rh) {
    const wasLeft  = px + BRK_BALL_R <= rx;
    const wasRight = px - BRK_BALL_R >= rx + rw;
    const wasAbove = py + BRK_BALL_R <= ry;
    const wasBelow = py - BRK_BALL_R >= ry + rh;
    let hitX = wasLeft || wasRight;
    let hitY = wasAbove || wasBelow;

    if (!hitX && !hitY) {
        // Ball was already overlapping (tunnelled slightly) — use block-center ratio
        const bCX = rx + rw * 0.5, bCY = ry + rh * 0.5;
        const nDX = Math.abs(cx - bCX) / (rw * 0.5);
        const nDY = Math.abs(cy - bCY) / (rh * 0.5);
        hitX = nDX >= nDY;
        hitY = nDY >= nDX;
    }
    return { hitX, hitY };
}

function brkCollideBlocks() {
    // Narrow-phase row/col range around ball bounding box
    const rowLo = Math.max(0,          Math.floor((brkBY - BRK_BALL_R - BRK_OY) / BRK_BH));
    const rowHi = Math.min(BRK_ROWS-1, Math.floor((brkBY + BRK_BALL_R - BRK_OY) / BRK_BH));
    const colLo = Math.max(0,          Math.floor((brkBX - BRK_BALL_R - BRK_OX) / BRK_BW));
    const colHi = Math.min(BRK_COLS-1, Math.floor((brkBX + BRK_BALL_R - BRK_OX) / BRK_BW));

    let anyX = false, anyY = false;
    const hits = [];

    for (let row = rowLo; row <= rowHi; row++) {
        for (let col = colLo; col <= colHi; col++) {
            const val = brkGrid[row][col];
            if (val === 0) continue;
            const rx = BRK_OX + col * BRK_BW, ry = BRK_OY + row * BRK_BH;
            if (!brkCircVsRect(brkBX, brkBY, BRK_BALL_R, rx, ry, BRK_BW, BRK_BH)) continue;
            const face = brkContactFace(brkBX, brkBY, brkBPX, brkBPY, rx, ry, BRK_BW, BRK_BH);
            if (face.hitX) anyX = true;
            if (face.hitY) anyY = true;
            hits.push({ row, col, val });
        }
    }

    if (!hits.length) return;

    // Reflect each axis at most once — the original bug fix
    const nudge = () => (Math.random() - 0.5) * 0.2;
    if (anyX) brkBDX = -brkBDX + nudge();
    if (anyY) brkBDY = -brkBDY + nudge();

    // Process every hit block
    for (const h of hits) {
        if (h.val < 7) {
            // Destructible: degrade or destroy
            brkGrid[h.row][h.col] = h.val <= 4 ? 0 : h.val - 1;
            brkCombo++;
            brkScore   += BRK_SCORE_BASE * h.val * brkCombo;
            brkStuckMs  = 0;

            // Spawn particle
            if (brkParts.length < BRK_MAX_PARTS) {
                brkParts.push({
                    bx:  BRK_OX + h.col * BRK_BW,
                    y:   BRK_OY + h.row * BRK_BH,
                    col: h.val,
                    age: 0,
                    ph:  Math.random() * Math.PI * 2
                });
            }

            if      (brkCombo === BRK_COMBO1_AT) brkSnd(BRK_SND_COMBO1);
            else if (brkCombo === BRK_COMBO2_AT) brkSnd(BRK_SND_COMBO2);
            else                                  brkSnd(BRK_SND_BREAK);
        } else {
            // Solid block — bounce only, no score
            brkSnd(BRK_SND_SOLID);
        }
    }
}

// =============================================================================
// UPDATE — PLAYING state
// =============================================================================
function brkUpdatePlaying(dt) {
    brkStuckMs += dt;
    if (brkStuckMs >= BRK_STUCK_MS) {
        // Ball stuck in unreachable cycle — relaunch without life penalty
        brkSnd(BRK_SND_RELAUNCH);
        brkEnter(BRK_S_READY);
        return;
    }

    brkCapDelta();

    // Store previous position before moving
    brkBPX = brkBX;
    brkBPY = brkBY;
    brkBX += brkBDX * BRK_SPEED;
    brkBY += brkBDY * BRK_SPEED;

    // Left / right walls
    if (brkBX < SHELL_PFX + BRK_BALL_R) {
        brkBX  = SHELL_PFX + BRK_BALL_R;
        brkBDX = Math.abs(brkBDX);
        brkSnd(BRK_SND_BOUNCE);
    } else if (brkBX > SHELL_PFX + SHELL_PFW - BRK_BALL_R) {
        brkBX  = SHELL_PFX + SHELL_PFW - BRK_BALL_R;
        brkBDX = -Math.abs(brkBDX);
        brkSnd(BRK_SND_BOUNCE);
    }

    // Ceiling
    if (brkBY < SHELL_PFY + BRK_BALL_R) {
        brkBY  = SHELL_PFY + BRK_BALL_R;
        brkBDY = Math.abs(brkBDY);
        brkSnd(BRK_SND_BOUNCE);
    }

    // Block collision (skip if ball is clearly below block area)
    if (brkBY < BRK_OY + BRK_ROWS * BRK_BH + BRK_BALL_R) {
        brkCollideBlocks();
    }

    // Paddle collision
    if (brkBY + BRK_BALL_R >= BRK_PAD_Y  &&
        brkBY - BRK_BALL_R <= BRK_PAD_Y + BRK_PAD_H &&
        brkBX  >= brkPadLeft()  - BRK_BALL_R &&
        brkBX  <= brkPadRight() + BRK_BALL_R) {
        brkBY       = BRK_PAD_Y - BRK_BALL_R - 1;
        brkBDY      = -Math.abs(brkBDY);                            // always bounce upward
        brkBDX     += (brkBX - brkPadX) * BRK_PAD_INF;             // offset steers ball
        brkCombo    = 0;
        brkStuckMs  = 0;
        brkSnd(BRK_SND_BOUNCE);
    }

    // Ball lost — fell below play field
    if (brkBY > SHELL_PFY + SHELL_PFH + BRK_BALL_R * 2) {
        brkBalls--;
        if (brkBalls > 0) brkEnter(BRK_S_BALLLOST);
        else               brkEnter(BRK_S_GAMEOVER);
        return;
    }

    // Stage clear check
    if (brkStageClear()) {
        brkEnter(BRK_S_CLEAR);
        return;
    }

    // Age particles
    for (let i = brkParts.length - 1; i >= 0; i--) {
        const p = brkParts[i];
        p.age++;
        p.y += BRK_PT_FALL;
        if (p.y > SHELL_PFY + SHELL_PFH + BRK_BH) brkParts.splice(i, 1);
    }
}

// =============================================================================
// DRAW
// =============================================================================
function brkDrawBoard() {
    for (let row = 0; row < BRK_ROWS; row++) {
        for (let col = 0; col < BRK_COLS; col++) {
            const val = brkGrid[row][col];
            if (!val) continue;
            const x = BRK_OX + col * BRK_BW;
            const y = BRK_OY + row * BRK_BH;
            const [shd, face] = BRK_BLOCK_CLR[val];
            // shadow offset (2 px down-right), then face on top
            _brkCtx.fillStyle = shd;
            _brkCtx.fillRect(x + 2, y + 2, BRK_BW, BRK_BH);
            _brkCtx.fillStyle = face;
            _brkCtx.fillRect(x, y, BRK_BW - 2, BRK_BH - 2);
        }
    }
}

function brkDrawParts() {
    _brkCtx.lineWidth = 1;
    for (const p of brkParts) {
        const drawX  = p.bx + Math.sin(p.age * BRK_PT_FREQ + p.ph) * BRK_PT_AMP;
        const [shd, face] = BRK_BLOCK_CLR[p.col];
        // shadow outline, then face outline — mirrors the filled block style
        _brkCtx.strokeStyle = shd;
        _brkCtx.strokeRect(drawX + 2, p.y + 2, BRK_BW - 4, BRK_BH - 4);
        _brkCtx.strokeStyle = face;
        _brkCtx.strokeRect(drawX, p.y, BRK_BW - 4, BRK_BH - 4);
    }
}

function brkDrawPaddle() {
    const px = Math.round(brkPadX);
    const py = BRK_PAD_Y;
    const hw = Math.floor(BRK_PAD_W / 2);
    // Three-layer offset shadow matching the original primitive style
    _brkCtx.fillStyle = BRK_C_PAD_DARK;
    _brkCtx.fillRect(px - hw + 4, py + 4, BRK_PAD_W, BRK_PAD_H);
    _brkCtx.fillStyle = BRK_C_PAD_MID;
    _brkCtx.fillRect(px - hw + 2, py + 2, BRK_PAD_W, BRK_PAD_H);
    _brkCtx.fillStyle = BRK_C_PAD_MAIN;
    _brkCtx.fillRect(px - hw, py, BRK_PAD_W, BRK_PAD_H);
    // highlight face and shine line
    _brkCtx.fillStyle = BRK_C_PAD_LIGHT;
    _brkCtx.fillRect(px - hw, py, BRK_PAD_W - 2, BRK_PAD_H - 2);
    _brkCtx.fillStyle = BRK_C_PAD_SHINE;
    _brkCtx.fillRect(px - hw + 1, py + 2, BRK_PAD_W - 2, 2);
}

function brkDrawBall() {
    const bx = Math.round(brkBX);
    const by = Math.round(brkBY);
    const r  = BRK_BALL_R;
    const sh = Math.floor(r / 2);
    const sp = Math.floor(r / 3);
    // shadow circle offset
    _brkCtx.beginPath();
    _brkCtx.arc(bx + sh, by + sh, r, 0, Math.PI * 2);
    _brkCtx.fillStyle = BRK_C_BALL_SHAD;
    _brkCtx.fill();
    // main ball
    _brkCtx.beginPath();
    _brkCtx.arc(bx, by, r, 0, Math.PI * 2);
    _brkCtx.fillStyle = BRK_C_BALL_MAIN;
    _brkCtx.fill();
    // shine spot
    _brkCtx.beginPath();
    _brkCtx.arc(bx - sp, by - sp, sp, 0, Math.PI * 2);
    _brkCtx.fillStyle = BRK_C_BALL_SHINE;
    _brkCtx.fill();
}

function brkDrawSidebar() {
    const cx = _brkCtx;
    cx.fillStyle    = BRK_C_SB_TXT;
    cx.font         = brkFnt(13);
    cx.textAlign    = "left";
    cx.textBaseline = "alphabetic";
    cx.fillText("STAGE: " + (brkStageIdx + 1) + "/" + brkTotalStages,  SHELL_BTN_X, BRK_SB_STAGE_Y);
    cx.fillText("SCORE: " + String(brkScore).padStart(6, "0"),          SHELL_BTN_X, BRK_SB_SCORE_Y);
    cx.fillText("BEST:  " + String(brkPB).padStart(6, "0"),             SHELL_BTN_X, BRK_SB_BEST_Y);
    cx.fillText("BALLS:",                                                SHELL_BTN_X, BRK_SB_BALLS_Y);
    // draw one small circle per remaining ball
    for (let i = 0; i < brkBalls; i++) {
        cx.beginPath();
        cx.arc(SHELL_BTN_X + 52 + i * 9, BRK_SB_BALLS_Y - 4, 3, 0, Math.PI * 2);
        cx.fillStyle   = BRK_C_BALL_MAIN;
        cx.fill();
        cx.strokeStyle = BRK_C_SB_TXT;
        cx.lineWidth   = 1;
        cx.stroke();
    }
    cx.fillStyle = BRK_C_SB_TXT;
}

// Semi-transparent overlay with up to two text lines
function brkOverlay(line1, col1, line2, col2) {
    const cx = _brkCtx;
    const ox = SHELL_PFX + SHELL_PFW / 2;
    const oy = SHELL_PFY + SHELL_PFH / 2;
    cx.globalAlpha = 0.55;
    cx.fillStyle   = BRK_C_OV_BG;
    cx.fillRect(SHELL_PFX, SHELL_PFY, SHELL_PFW, SHELL_PFH);
    cx.globalAlpha = 1.0;
    cx.textAlign   = "center";
    if (line1) {
        cx.fillStyle = col1;
        cx.font      = brkFnt(22);
        cx.fillText(line1, ox, oy - (line2 ? 12 : 0));
    }
    if (line2) {
        cx.fillStyle = col2;
        cx.font      = brkFnt(13);
        cx.fillText(line2, ox, oy + 14);
    }
    cx.textAlign = "left";
}

function brkDraw() {
    const cx = _brkCtx;

    // Canvas background
    cx.fillStyle = CLR_BG;
    cx.fillRect(0, 0, SHELL_CW, SHELL_CH);

    // Play-field background
    cx.fillStyle = BRK_C_PF_BG;
    cx.fillRect(SHELL_PFX, SHELL_PFY, SHELL_PFW, SHELL_PFH);

    // Clip all in-field drawing to the play field rect
    cx.save();
    cx.beginPath();
    cx.rect(SHELL_PFX, SHELL_PFY, SHELL_PFW, SHELL_PFH);
    cx.clip();

    switch (brkState) {

        case BRK_S_LOADING:
            cx.fillStyle    = BRK_C_OV_TXT;
            cx.font         = brkFnt(14);
            cx.textAlign    = "center";
            cx.textBaseline = "middle";
            cx.fillText("LOADING...", SHELL_PFX + SHELL_PFW / 2, SHELL_PFY + SHELL_PFH / 2);
            cx.textAlign    = "left";
            cx.textBaseline = "alphabetic";
            break;

        case BRK_S_IDLE:
            brkOverlay("BREAKOUT", BRK_C_OV_TXT, "Press START to play", BRK_C_OV_SUB);
            break;

        case BRK_S_READY:
            brkDrawBoard();
            brkDrawPaddle();
            brkDrawBall();
            cx.fillStyle = BRK_C_OV_SUB;
            cx.font      = brkFnt(11);
            cx.textAlign = "center";
            cx.fillText("click or tap to launch", SHELL_PFX + SHELL_PFW / 2, SHELL_PFY + SHELL_PFH - 6);
            cx.textAlign = "left";
            break;

        case BRK_S_PLAYING:
            brkDrawBoard();
            brkDrawParts();
            brkDrawPaddle();
            brkDrawBall();
            if (brkCombo > 1) {
                const cTxt = "COMBO x" + brkCombo;
                const cX   = SHELL_PFX + SHELL_PFW / 2;
                const cY   = SHELL_PFY + SHELL_PFH / 2;
                cx.font         = brkFnt(22);
                cx.textAlign    = "center";
                cx.textBaseline = "middle";
                // drop shadow for legibility over the blocks
                cx.fillStyle = "#000000";
                cx.fillText(cTxt, cX + 2, cY + 2);
                cx.fillStyle = BRK_C_COMBO_TXT;
                cx.fillText(cTxt, cX, cY);
                cx.textAlign    = "left";
                cx.textBaseline = "alphabetic";
            }
            break;

        case BRK_S_BALLLOST:
            brkDrawBoard();
            brkDrawPaddle();
            brkOverlay("BALL LOST", BRK_C_GAMEOVER, null, null);
            break;

        case BRK_S_CLEAR:
            brkDrawBoard();
            brkOverlay("STAGE CLEAR!", BRK_C_CLEAR, "+1 BALL", BRK_C_OV_SUB);
            break;

        case BRK_S_GAMEOVER:
            brkOverlay(
                "GAME OVER", BRK_C_GAMEOVER,
                brkNewBest ? "NEW BEST SCORE!" : "Press RESET to try again",
                brkNewBest ? BRK_C_NEWBEST : BRK_C_OV_SUB
            );
            break;

        case BRK_S_COMPLETE:
            brkOverlay(
                "YOU WIN!", BRK_C_CLEAR,
                brkNewBest ? "NEW BEST SCORE!" : "Press RESET to play again",
                brkNewBest ? BRK_C_NEWBEST : BRK_C_OV_SUB
            );
            break;
    }

    cx.restore();  // end play-field clip

    // Sidebar drawn outside clip, only once game has started
    if (brkState > BRK_S_IDLE) brkDrawSidebar();
}

// =============================================================================
// GAME INTERFACE
// =============================================================================
const GAME = {
    title:    "Breakout",
    subtitle: "Mouse to aim \u00b7 Click to launch",

    init(canvas) {
        _brkCtx    = canvas.getContext("2d");
        _brkCanvas = canvas;
        brkPB      = SHELL_getPB(BRK_PB_KEY) || 0;
        brkLoadLevels();
        // Register pointer-lock and free-mouse listeners once, for the lifetime
        // of this game session.  document-level so they fire regardless of focus.
        document.addEventListener("pointerlockchange", brkOnLockChange);
        document.addEventListener("mousemove",         brkOnFreeMouse);
    },

    start() {
        if (!brkStages) return;   // levels not ready yet
        brkStartGame();
        brkLockMouse();           // capture mouse — user clicked START (valid gesture)
    },

    reset() {
        if (!brkStages) return;
        brkStartGame();
        brkLockMouse();           // re-capture mouse — user clicked RESET (valid gesture)
    },

    update(dt) {
        // Nothing to do while loading or showing idle splash
        if (brkState <= BRK_S_IDLE) return;

        // Timed state transitions (BALLLOST, CLEAR)
        if (brkStateTmr > 0) {
            brkStateTmr -= dt;
            if (brkStateTmr <= 0) {
                brkStateTmr = 0;
                if (brkState === BRK_S_BALLLOST) {
                    brkEnter(BRK_S_READY);
                } else if (brkState === BRK_S_CLEAR) {
                    brkStageIdx++;
                    if (brkStageIdx >= brkTotalStages) {
                        brkEnter(BRK_S_COMPLETE);
                    } else {
                        brkLoadGrid(brkStageIdx);
                        brkEnter(BRK_S_READY);
                    }
                }
            }
            return;
        }

        // READY — keep ball glued to paddle top
        if (brkState === BRK_S_READY) {
            brkBX = brkPadX;
            brkBY = brkBallSitY();
        }

        // PLAYING — full physics
        if (brkState === BRK_S_PLAYING) brkUpdatePlaying(dt);
    },

    draw() { brkDraw(); },

    // Tap / click — launch ball from READY state.
    // Also re-acquires pointer lock here in case the player pressed Escape
    // to exit lock during READY, then clicked to launch.
    onClick(mx, my) {
        if (brkState === BRK_S_READY) {
            brkLockMouse();
            brkLaunch();
        }
    },

    // Drag (touchmove, or held-mousemove on touch devices) — move paddle.
    // On desktop the pointer-lock path above takes over, so onDrag is
    // primarily for touch now.
    onDrag(mx, my) {
        brkPadX = mx;
        brkClampPad();
    },

    onSwipe(dir) {}
};
