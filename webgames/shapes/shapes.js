// =============================================================================
// shapes.js  —  v2 desktop / tablet  (960 × 640)
// Drag to place · ↻ button to rotate · 4-piece preview tray
// =============================================================================

// V2_CW = 960  and  V2_CH = 640  are injected globally by game-v2.html

// ---------- grid — change these to tune feel ----------
const SHP_CELL  = 44;
const SHP_BCOLS = 10;
const SHP_BROWS = 10;
const SHP_BW    = SHP_BCOLS * SHP_CELL;   // 440
const SHP_BH    = SHP_BROWS * SHP_CELL;   // 440

// ---------- HUD strip ----------
const SHP_HUD_H     = 44;
const SHP_BOARD_PAD = 14;     // gap between HUD bottom and board top

// ---------- board position (centred horizontally) ----------
const SHP_BX = Math.floor((V2_CW - SHP_BW) / 2);   // 260
const SHP_BY = SHP_HUD_H + SHP_BOARD_PAD;            // 58

// ---------- tray  (rotate btn · active · next×3) ----------
const SHP_MINI_CELL = 22;
const SHP_MINI_BOX  = 4 * SHP_MINI_CELL;    // 88  (fits any tetromino at mini scale)
const SHP_TRAY_GAP  = 10;
const SHP_ROT_W     = 60;
const SHP_ROT_H     = SHP_MINI_BOX;   // full tray height — flush with piece boxes
// total row:  [ROT_BTN] [gap] [act] [gap] [n1] [gap] [n2] [gap] [n3]
//              60     +  10  +  88 +  10 +  88 +  10 +  88 +  10 +  88 = 452
const SHP_TRAY_W    = SHP_ROT_W + SHP_TRAY_GAP
                    + (SHP_MINI_BOX + SHP_TRAY_GAP) * 3
                    + SHP_MINI_BOX;
const SHP_TRAY_X0   = Math.floor((V2_CW - SHP_TRAY_W) / 2);   // 254
const SHP_TRAY_Y    = SHP_BY + SHP_BH + 18;                    // 516
const SHP_ROT_X     = SHP_TRAY_X0;
const SHP_ROT_Y     = SHP_TRAY_Y;     // flush with tray top
const SHP_ACT_X     = SHP_TRAY_X0 + SHP_ROT_W + SHP_TRAY_GAP;    // 324
const SHP_NXT1_X    = SHP_ACT_X  + SHP_MINI_BOX + SHP_TRAY_GAP;  // 422
const SHP_NXT2_X    = SHP_NXT1_X + SHP_MINI_BOX + SHP_TRAY_GAP;  // 520
const SHP_NXT3_X    = SHP_NXT2_X + SHP_MINI_BOX + SHP_TRAY_GAP;  // 618

// ---------- line-clear animation ----------
const SHP_CLEAR_DUR = 380;    // ms total — tune freely

// ---------- colours ----------
const SHP_CLR_BG         = "#0a0c0f";
const SHP_CLR_HUD_BG     = "#181830";
const SHP_CLR_HUD_SEP    = "#2a2a55";
const SHP_CLR_HUD_LBL    = "#7777aa";
const SHP_CLR_HUD_VAL    = "#ffffff";
const SHP_CLR_HUD_PB_HI  = "#60ff60";
const SHP_CLR_PF_BG      = "rgba(11,13,16,0.86)";   // semi-transparent — bg bleeds through
const SHP_CLR_GRID       = "rgba(255,255,255,0.04)";
const SHP_CLR_BORDER     = "#5c6677";
const SHP_CLR_PREV_BAD   = "#ff4444";
const SHP_CLR_ACT_BG     = "rgba(26,34,48,0.88)";
const SHP_CLR_ACT_BDR    = "#4488cc";
const SHP_CLR_NXT_BG     = "rgba(17,21,25,0.88)";
const SHP_CLR_NXT_BDR    = "#3a4555";
const SHP_CLR_ROT_BG     = "rgba(15,31,15,0.88)";
const SHP_CLR_ROT_BG_HV  = "rgba(26,58,26,0.90)";
const SHP_CLR_ROT_BDR    = "#50c050";
const SHP_CLR_ROT_TXT    = "#90e890";
const SHP_CLR_OVR        = "rgba(8,8,24,0.88)";
const SHP_CLR_OVR_HDL    = "#ffffff";
const SHP_CLR_OVR_LBL    = "#8888cc";
const SHP_CLR_OVR_SCR    = "#f0d020";
const SHP_CLR_OVR_PB_HI  = "#60ff60";
const SHP_CLR_OVR_PB     = "#6666aa";
const SHP_CLR_BTN_OFF_BG = "#222222";
const SHP_CLR_BTN_OFF_BD = "#555555";
const SHP_CLR_BTN_ON_BG  = "#1a5a1a";
const SHP_CLR_BTN_ON_BD  = "#50c050";
const SHP_CLR_BTN_TXT    = "#ffffff";
const SHP_CLR_COMBO_GOLD = "#f0d020";   // 2–3 lines cleared at once
const SHP_CLR_COMBO_GRN  = "#60ff60";   // 4+  lines cleared at once

// ---------- palette  (index 0 = empty, all 6-digit hex) ----------
const SHP_PAL = [
    "#000000",
    "#00eac7", "#b863f4", "#376177",
    "#41e865", "#d21fb8", "#7d26cd"
];

// ---------- tetrominoes in 4×4 local space ----------
const SHP_SHAPES = [
    [{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:3,y:0}],  // I
    [{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}],  // O
    [{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:1,y:1}],  // T
    [{x:0,y:0},{x:0,y:1},{x:0,y:2},{x:1,y:2}],  // L
    [{x:1,y:0},{x:1,y:1},{x:1,y:2},{x:0,y:2}],  // J
    [{x:1,y:0},{x:2,y:0},{x:0,y:1},{x:1,y:1}],  // S
    [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:2,y:1}],  // Z
];

const SHP_PB_KEY = "shpv2_score";

// ---------- background image ----------
const SHP_BG     = new Image();
let   shpBgReady = false;
SHP_BG.onload    = () => { shpBgReady = true; };
SHP_BG.src       = "shapes/bg.jpg";

// ---------- sound effects ----------
// Drop these .ogg files into webgames/shapes/ :
//   snd_rotate.ogg  snd_grab.ogg    snd_invalid.ogg  snd_place.ogg
//   snd_clear1.ogg  snd_clear2.ogg  snd_clear3.ogg   snd_clear4.ogg
//   snd_gameover.ogg
const SHP_SND_ROTATE   = new Audio("shapes/snd_rotate.ogg");
const SHP_SND_GRAB     = new Audio("shapes/snd_grab.ogg");
const SHP_SND_INVALID  = new Audio("shapes/snd_invalid.ogg");
const SHP_SND_PLACE    = new Audio("shapes/snd_place.ogg");
const SHP_SND_CLEAR1   = new Audio("shapes/snd_clear1.ogg");
const SHP_SND_CLEAR2   = new Audio("shapes/snd_clear2.ogg");
const SHP_SND_CLEAR3   = new Audio("shapes/snd_clear3.ogg");
const SHP_SND_CLEAR4   = new Audio("shapes/snd_clear4.ogg");
const SHP_SND_GAMEOVER = new Audio("shapes/snd_gameover.ogg");

function _shpSfx(snd) {
    if(SHELL_isMuted()) return;
    snd.currentTime = 0;
    snd.play().catch(() => {});
}

// ---------- state ----------
let shpBoard;
let shpPlaced, shpScore, shpPB;
let shpActive, shpNext1, shpNext2, shpNext3;
let shpPhase;          // "playing" | "clearing" | "over"
let shpClearList;      // [{type:"row"|"col", idx:N}, ...]
let shpClearTimer;     // ms elapsed in current clearing phase
let shpOverLockMs;     // ms elapsed since game over  (1 s button lock)
let shpDragging, shpDragX, shpDragY;
let shpRotHover;
let _cv, _cx;

// =============================================================================
// GAME INTERFACE
// =============================================================================
const GAME = {
    title:      "Shapes",
    resetLabel: "RESET",

    init(canvas) {
        _cv = canvas;
        _cx = canvas.getContext("2d");
        shpPB       = parseInt(localStorage.getItem(SHP_PB_KEY)) || 0;
        shpDragging = false;
        shpRotHover = false;
        shpPhase    = "playing";   // safe default; shell calls start() immediately

        _cv.addEventListener("contextmenu", e => e.preventDefault());

        _cv.addEventListener("mousedown", e => {
            if(shpPhase !== "playing") return;
            const [mx, my] = _cvXY(e.clientX, e.clientY);
            if(e.button === 2)               { _rotatePiece(); return; }
            if(e.button !== 0)               return;
            if(_hitRotBtn(mx, my))           { _rotatePiece(); return; }
            if(_hitActiveTray(mx, my))       _startDrag(mx, my);
        });

        // Finalise drag even when cursor leaves canvas
        document.addEventListener("mouseup", () => {
            if(shpDragging) _tryPlace();
        });

        _cv.addEventListener("mousemove", e => {
            const [mx, my] = _cvXY(e.clientX, e.clientY);
            shpRotHover = shpPhase === "playing" && _hitRotBtn(mx, my);
            if(shpDragging) {
                shpDragX = mx;
                shpDragY = my;
                _cv.style.cursor = "grabbing";
            } else if(shpPhase === "playing" && _hitActiveTray(mx, my)) {
                _cv.style.cursor = "grab";
            } else if(shpRotHover) {
                _cv.style.cursor = "pointer";
            } else {
                _cv.style.cursor = "";
            }
        });

        _cv.addEventListener("mouseleave", () => { shpRotHover = false; });

        _cv.addEventListener("touchstart", e => {
            if(shpPhase !== "playing") return;
            const t = e.changedTouches[0];
            const [mx, my] = _cvXY(t.clientX, t.clientY);
            if(_hitRotBtn(mx, my))     { _rotatePiece(); return; }
            if(_hitActiveTray(mx, my)) _startDrag(mx, my);
        }, { passive: true });

        window.addEventListener("keydown", e => {
            if(shpPhase !== "playing") return;
            if(e.key === "r" || e.key === "R") _rotatePiece();
        });
    },

    start() { _resetGame(); },
    reset() { _resetGame(); },

    update(dt) {
        dt = dt || 16;
        if(shpPhase === "clearing") {
            shpClearTimer += dt;
            if(shpClearTimer >= SHP_CLEAR_DUR) _finishClear();
        } else if(shpPhase === "over") {
            shpOverLockMs += dt;
        }
    },

    draw() { _draw(); },

    onClick(mx, my) {
        if(shpPhase === "playing") {
            // Note: rotate button is handled in mousedown + touchstart.
            // Do NOT call _rotatePiece() here — shell fires onClick AND mousedown
            // on desktop, which would double-rotate and appear to skip states.
            if(shpDragging) { _tryPlace(); return; }
        }
        if(shpPhase === "over" && shpOverLockMs >= 1000) {
            const bx = Math.floor(V2_CW / 2) - 100;
            const by = Math.floor(V2_CH / 2) + 68;
            if(mx >= bx && mx <= bx + 200 && my >= by && my <= by + 52) GAME.start();
        }
    },

    onDrag(mx, my) {
        if(shpDragging) { shpDragX = mx; shpDragY = my; }
    },

    // Swipe: finalise drag if one is live, otherwise rotate (power-user shortcut)
    onSwipe() {
        if(shpDragging)            { _tryPlace(); return; }
        if(shpPhase === "playing") _rotatePiece();
    }
};

// =============================================================================
// INPUT HELPERS
// =============================================================================
function _cvXY(cx, cy) {
    const rc = _cv.getBoundingClientRect();
    return [
        (cx - rc.left) * (V2_CW / rc.width),
        (cy - rc.top)  * (V2_CH / rc.height)
    ];
}

function _hitRotBtn(mx, my) {
    return mx >= SHP_ROT_X && mx <= SHP_ROT_X + SHP_ROT_W &&
           my >= SHP_ROT_Y && my <= SHP_ROT_Y + SHP_ROT_H;
}

// Whole active-piece box is a valid drag-start zone
function _hitActiveTray(mx, my) {
    return mx >= SHP_ACT_X && mx <= SHP_ACT_X + SHP_MINI_BOX &&
           my >= SHP_TRAY_Y && my <= SHP_TRAY_Y + SHP_MINI_BOX;
}

// =============================================================================
// PIECE HELPERS
// =============================================================================
function _rotate90(blocks) {
    const rot  = blocks.map(b => ({ x: -b.y, y: b.x }));
    const minX = Math.min(...rot.map(b => b.x));
    const minY = Math.min(...rot.map(b => b.y));
    return rot.map(b => ({ x: b.x - minX, y: b.y - minY }));
}

function _getBlocks(piece) {
    let bl = SHP_SHAPES[piece.shapeIndex];
    for(let i = 0; i < piece.rotation; i++) bl = _rotate90(bl);
    return bl;
}

function _fits(ax, ay, blocks) {
    for(const b of blocks) {
        const gx = ax + b.x, gy = ay + b.y;
        if(gx < 0 || gy < 0 || gx >= SHP_BCOLS || gy >= SHP_BROWS) return false;
        if(shpBoard[gy][gx] > 0) return false;
    }
    return true;
}

function _hasAnyMove(piece) {
    for(let rot = 0; rot < 4; rot++) {
        let bl = SHP_SHAPES[piece.shapeIndex];
        for(let i = 0; i < rot; i++) bl = _rotate90(bl);
        for(let gy = 0; gy < SHP_BROWS; gy++)
            for(let gx = 0; gx < SHP_BCOLS; gx++)
                if(_fits(gx, gy, bl)) return true;
    }
    return false;
}

function _rotatePiece() {
    shpActive.rotation = (shpActive.rotation + 1) % 4;
    _shpSfx(SHP_SND_ROTATE);
}

function _randPiece() {
    return {
        shapeIndex: Math.floor(Math.random() * SHP_SHAPES.length),
        rotation:   0,
        colorId:    1 + Math.floor(Math.random() * (SHP_PAL.length - 1))
    };
}

// =============================================================================
// DRAG
// =============================================================================
function _startDrag(mx, my) {
    shpDragging = true;
    shpDragX    = mx;
    shpDragY    = my;
    _shpSfx(SHP_SND_GRAB);
}

// Returns the board col/row that local block (0,0) should land on,
// given that the whole piece bounding box is centred on the cursor.
// Must receive the current blocks so it can compute the centering offset.
function _snapCell(blocks) {
    const minX = Math.min(...blocks.map(b => b.x));
    const maxX = Math.max(...blocks.map(b => b.x));
    const minY = Math.min(...blocks.map(b => b.y));
    const maxY = Math.max(...blocks.map(b => b.y));
    // ox/oy: pixel position of local (0,0) — same formula as _drawDragging
    const ox = shpDragX - (minX + maxX + 1) * SHP_CELL / 2;
    const oy = shpDragY - (minY + maxY + 1) * SHP_CELL / 2;
    return {
        col: Math.round((ox - SHP_BX) / SHP_CELL),
        row: Math.round((oy - SHP_BY) / SHP_CELL)
    };
}

function _tryPlace() {
    shpDragging      = false;
    _cv.style.cursor = "";
    const blocks     = _getBlocks(shpActive);
    const nearBoard  = shpDragX >= SHP_BX - SHP_CELL && shpDragX <= SHP_BX + SHP_BW + SHP_CELL &&
                       shpDragY >= SHP_BY - SHP_CELL && shpDragY <= SHP_BY + SHP_BH + SHP_CELL;
    if(!nearBoard) return;

    const sc = _snapCell(blocks);
    if(!_fits(sc.col, sc.row, blocks)) { _shpSfx(SHP_SND_INVALID); return; }

    // Commit placement
    for(const b of blocks) shpBoard[sc.row + b.y][sc.col + b.x] = shpActive.colorId;
    shpPlaced++;
    shpScore += shpPlaced;

    // Advance queue
    shpActive = shpNext1;
    shpNext1  = shpNext2;
    shpNext2  = shpNext3;
    shpNext3  = _randPiece();

    // Enter clearing phase if any lines completed, otherwise check game over
    shpClearList = _findClears();
    if(shpClearList.length > 0) {
        const n = shpClearList.length;
        _shpSfx(n >= 4 ? SHP_SND_CLEAR4 : n === 3 ? SHP_SND_CLEAR3 : n === 2 ? SHP_SND_CLEAR2 : SHP_SND_CLEAR1);
        shpPhase      = "clearing";
        shpClearTimer = 0;
    } else {
        _shpSfx(SHP_SND_PLACE);
        _checkGameOver();
    }
}

// =============================================================================
// GAME LOGIC
// =============================================================================
function _findClears() {
    const found = [];
    for(let gy = 0; gy < SHP_BROWS; gy++)
        if(shpBoard[gy].every(v => v > 0)) found.push({ type: "row", idx: gy });
    for(let gx = 0; gx < SHP_BCOLS; gx++)
        if(shpBoard.every(row => row[gx] > 0)) found.push({ type: "col", idx: gx });
    return found;
}

function _applyClears() {
    for(const cl of shpClearList) {
        if(cl.type === "row") shpBoard[cl.idx].fill(0);
        else                   shpBoard.forEach(row => row[cl.idx] = 0);
    }
    // Combo bonus multiplier: 1× / 2× / 4× / 6×
    const n     = shpClearList.length;
    const bonus = n >= 4 ? 6 : n === 3 ? 4 : n === 2 ? 2 : 1;
    shpScore   += 5 * shpPlaced * bonus;
}

function _finishClear() {
    _applyClears();
    _checkGameOver();
}

function _checkGameOver() {
    if(!_hasAnyMove(shpActive)) {
        shpPhase      = "over";
        shpOverLockMs = 0;
        if(shpScore > shpPB) {
            shpPB = shpScore;
            localStorage.setItem(SHP_PB_KEY, shpPB);
        }
        _shpSfx(SHP_SND_GAMEOVER);
    } else {
        shpPhase = "playing";
    }
}

function _resetGame() {
    shpBoard = [];
    for(let gy = 0; gy < SHP_BROWS; gy++) shpBoard.push(new Array(SHP_BCOLS).fill(0));
    shpPlaced     = 0;
    shpScore      = 0;
    shpClearList  = [];
    shpClearTimer = 0;
    shpOverLockMs = 0;
    shpActive     = _randPiece();
    shpNext1      = _randPiece();
    shpNext2      = _randPiece();
    shpNext3      = _randPiece();
    shpDragging   = false;
    _cv.style.cursor = "";
    shpPhase = "playing";
    if(!_hasAnyMove(shpActive)) { shpPhase = "over"; }
}

// =============================================================================
// DRAW UTILITIES
// =============================================================================
function _mf(sz)  { return `${sz}px Consolas,"Lucida Console","Courier New",monospace`; }
function _mbf(sz) { return `bold ${sz}px Consolas,"Lucida Console","Courier New",monospace`; }
function _msf(sz) { return `bold ${sz}px sans-serif`; }

function _rrect(cx, x, y, w, h, r) {
    cx.beginPath();
    cx.moveTo(x + r, y);
    cx.lineTo(x + w - r, y);
    cx.quadraticCurveTo(x + w, y,     x + w, y + r);
    cx.lineTo(x + w, y + h - r);
    cx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    cx.lineTo(x + r, y + h);
    cx.quadraticCurveTo(x,     y + h, x, y + h - r);
    cx.lineTo(x, y + r);
    cx.quadraticCurveTo(x,     y,     x + r, y);
    cx.closePath();
}

// Draw one gradient-filled block.
// baseHex: 6-digit hex.  alpha: overall opacity.
// flashT:  0 = normal 3-D render,  0..1 = lerp toward white (clear animation).
function _block(px, py, baseHex, alpha, cellSz, flashT) {
    const cx  = _cx;
    const mgn = Math.round(cellSz * 0.09);
    const bx  = px + mgn;
    const by  = py + mgn;
    const bw  = cellSz - mgn * 2;
    const bh  = cellSz - mgn * 2;
    const rad = Math.round(cellSz * 0.12);

    cx.globalAlpha = alpha;

    if(flashT > 0) {
        // Blend base colour toward white as lines clear
        cx.fillStyle = baseHex;
        _rrect(cx, bx, by, bw, bh, rad);
        cx.fill();
        cx.globalAlpha = alpha * flashT;
        cx.fillStyle   = "#ffffff";
        _rrect(cx, bx, by, bw, bh, rad);
        cx.fill();
    } else {
        // Solid base
        cx.fillStyle = baseHex;
        _rrect(cx, bx, by, bw, bh, rad);
        cx.fill();

        // Highlight: top-left bright → centre transparent  (lit face)
        const hiGrad = cx.createLinearGradient(bx, by, bx + bw * 0.7, by + bh * 0.7);
        hiGrad.addColorStop(0, "rgba(255,255,255,0.30)");
        hiGrad.addColorStop(1, "rgba(255,255,255,0.00)");
        cx.fillStyle = hiGrad;
        _rrect(cx, bx, by, bw, bh, rad);
        cx.fill();

        // Shadow: bottom-right dark → centre transparent
        const shGrad = cx.createLinearGradient(bx + bw, by + bh, bx + bw * 0.3, by + bh * 0.3);
        shGrad.addColorStop(0, "rgba(0,0,0,0.40)");
        shGrad.addColorStop(1, "rgba(0,0,0,0.00)");
        cx.fillStyle = shGrad;
        _rrect(cx, bx, by, bw, bh, rad);
        cx.fill();
    }

    cx.globalAlpha = 1.0;
}

// Draw a diagonal cross over a bad (colliding) preview subtile.
// Called on top of _block() so the rounded shape is already painted.
function _blockBad(px, py, cellSz) {
    const cx  = _cx;
    const mgn = Math.round(cellSz * 0.18);
    const x1  = px + mgn;
    const y1  = py + mgn;
    const x2  = px + cellSz - mgn;
    const y2  = py + cellSz - mgn;
    cx.save();
    cx.globalAlpha = 0.70;
    cx.strokeStyle = "#ffffff";
    cx.lineWidth   = Math.max(1.5, cellSz * 0.055);
    cx.lineCap     = "round";
    cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.stroke();
    cx.restore();
}

// =============================================================================
// DRAW FUNCTIONS
// =============================================================================
function _drawHUD() {
    const cx = _cx;
    cx.fillStyle = SHP_CLR_HUD_BG;
    cx.fillRect(0, 0, V2_CW, SHP_HUD_H);
    cx.fillStyle = SHP_CLR_HUD_SEP;
    cx.fillRect(0, SHP_HUD_H - 1, V2_CW, 1);

    cx.textBaseline = "alphabetic";

    // Score — left
    cx.font      = _mf(11);
    cx.fillStyle = SHP_CLR_HUD_LBL;
    cx.textAlign = "left";
    cx.fillText("SCORE", 24, 16);
    cx.font      = _mbf(22);
    cx.fillStyle = SHP_CLR_HUD_VAL;
    cx.fillText(String(shpScore).padStart(7, "0"), 24, 38);

    // Best — right  (green when current score reaches or beats PB)
    const pbHi = shpPB > 0 && shpScore >= shpPB;
    cx.font      = _mf(11);
    cx.fillStyle = SHP_CLR_HUD_LBL;
    cx.textAlign = "right";
    cx.fillText("BEST", V2_CW - 24, 16);
    cx.font      = _mbf(22);
    cx.fillStyle = pbHi ? SHP_CLR_HUD_PB_HI : SHP_CLR_HUD_VAL;
    cx.fillText(String(shpPB).padStart(7, "0"), V2_CW - 24, 38);
}

function _drawGrid() {
    const cx = _cx;
    cx.strokeStyle = SHP_CLR_GRID;
    cx.lineWidth   = 1;
    for(let gx = 1; gx < SHP_BCOLS; gx++) {
        const xp = SHP_BX + gx * SHP_CELL;
        cx.beginPath(); cx.moveTo(xp, SHP_BY); cx.lineTo(xp, SHP_BY + SHP_BH); cx.stroke();
    }
    for(let gy = 1; gy < SHP_BROWS; gy++) {
        const yp = SHP_BY + gy * SHP_CELL;
        cx.beginPath(); cx.moveTo(SHP_BX, yp); cx.lineTo(SHP_BX + SHP_BW, yp); cx.stroke();
    }
}

function _isClearCell(gx, gy) {
    for(const cl of shpClearList) {
        if(cl.type === "row" && cl.idx === gy) return true;
        if(cl.type === "col" && cl.idx === gx) return true;
    }
    return false;
}

function _drawBoard() {
    const cx     = _cx;
    // flashT ramps 0 → 1 over 72 % of the clear duration, then holds at 1
    const flashT = shpPhase === "clearing"
                 ? Math.min(1, shpClearTimer / (SHP_CLEAR_DUR * 0.72))
                 : 0;

    cx.strokeStyle = SHP_CLR_BORDER;
    cx.lineWidth   = 1;
    cx.strokeRect(SHP_BX, SHP_BY, SHP_BW, SHP_BH);

    for(let gy = 0; gy < SHP_BROWS; gy++) {
        for(let gx = 0; gx < SHP_BCOLS; gx++) {
            const v = shpBoard[gy][gx];
            if(v === 0) continue;
            const ft = _isClearCell(gx, gy) ? flashT : 0;
            _block(SHP_BX + gx * SHP_CELL, SHP_BY + gy * SHP_CELL,
                   SHP_PAL[v % SHP_PAL.length], 1.0, SHP_CELL, ft);
        }
    }
}

// greyed: draw in desaturated grey to signal "not yet active"
function _drawPieceInBox(piece, boxX, boxY, greyed) {
    if(!piece) return;
    const blocks = _getBlocks(piece);
    const col    = greyed ? "#555566" : SHP_PAL[piece.colorId % SHP_PAL.length];

    // Centre the piece bounding box within SHP_MINI_BOX × SHP_MINI_BOX
    const minX  = Math.min(...blocks.map(b => b.x));
    const maxX  = Math.max(...blocks.map(b => b.x));
    const minY  = Math.min(...blocks.map(b => b.y));
    const maxY  = Math.max(...blocks.map(b => b.y));
    const offX  = Math.floor((SHP_MINI_BOX - (maxX - minX + 1) * SHP_MINI_CELL) / 2) - minX * SHP_MINI_CELL;
    const offY  = Math.floor((SHP_MINI_BOX - (maxY - minY + 1) * SHP_MINI_CELL) / 2) - minY * SHP_MINI_CELL;

    for(const b of blocks)
        _block(boxX + offX + b.x * SHP_MINI_CELL, boxY + offY + b.y * SHP_MINI_CELL,
               col, 1.0, SHP_MINI_CELL, 0);
}

function _drawTray() {
    const cx = _cx;

    // Rotate button
    cx.fillStyle = shpRotHover ? SHP_CLR_ROT_BG_HV : SHP_CLR_ROT_BG;
    _rrect(cx, SHP_ROT_X, SHP_ROT_Y, SHP_ROT_W, SHP_ROT_H, 8);
    cx.fill();
    cx.strokeStyle  = SHP_CLR_ROT_BDR;
    cx.lineWidth    = 1.5;
    _rrect(cx, SHP_ROT_X, SHP_ROT_Y, SHP_ROT_W, SHP_ROT_H, 8);
    cx.stroke();
    cx.font         = _mf(22);
    cx.fillStyle    = SHP_CLR_ROT_TXT;
    cx.textAlign    = "center";
    cx.textBaseline = "middle";
    cx.fillText("\u21BB", SHP_ROT_X + SHP_ROT_W / 2, SHP_ROT_Y + SHP_ROT_H / 2);
    cx.textBaseline = "alphabetic";

    // Piece slots
    const slots = [
        { xp: SHP_ACT_X,  active: true  },
        { xp: SHP_NXT1_X, active: false },
        { xp: SHP_NXT2_X, active: false },
        { xp: SHP_NXT3_X, active: false }
    ];
    for(const s of slots) {
        cx.fillStyle   = s.active ? SHP_CLR_ACT_BG  : SHP_CLR_NXT_BG;
        cx.fillRect(s.xp, SHP_TRAY_Y, SHP_MINI_BOX, SHP_MINI_BOX);
        cx.strokeStyle = s.active ? SHP_CLR_ACT_BDR : SHP_CLR_NXT_BDR;
        cx.lineWidth   = 1;
        cx.strokeRect(s.xp, SHP_TRAY_Y, SHP_MINI_BOX, SHP_MINI_BOX);
    }

    // Hide active piece from box while dragging — it floats under cursor instead
    if(!shpDragging) _drawPieceInBox(shpActive, SHP_ACT_X,  SHP_TRAY_Y, false);
    _drawPieceInBox(shpNext1, SHP_NXT1_X, SHP_TRAY_Y, true);
    _drawPieceInBox(shpNext2, SHP_NXT2_X, SHP_TRAY_Y, true);
    _drawPieceInBox(shpNext3, SHP_NXT3_X, SHP_TRAY_Y, true);
}

function _drawDragging() {
    if(!shpDragging || !shpActive) return;
    const blocks    = _getBlocks(shpActive);
    const col       = SHP_PAL[shpActive.colorId % SHP_PAL.length];

    // Pixel offset: piece bounding box centred on cursor — used everywhere
    const minX = Math.min(...blocks.map(b => b.x));
    const maxX = Math.max(...blocks.map(b => b.x));
    const minY = Math.min(...blocks.map(b => b.y));
    const maxY = Math.max(...blocks.map(b => b.y));
    const ox   = shpDragX - (minX + maxX + 1) * SHP_CELL / 2;
    const oy   = shpDragY - (minY + maxY + 1) * SHP_CELL / 2;

    const nearBoard = shpDragX >= SHP_BX - SHP_CELL && shpDragX <= SHP_BX + SHP_BW + SHP_CELL &&
                      shpDragY >= SHP_BY - SHP_CELL && shpDragY <= SHP_BY + SHP_BH + SHP_CELL;

    if(nearBoard) {
        // Draw at pixel position but colour each subtile by whether its
        // snapped grid cell is valid — gives fit feedback without snapping visually
        const sc = _snapCell(blocks);
        for(const b of blocks) {
            const gx  = sc.col + b.x;
            const gy  = sc.row + b.y;
            const bad = gx < 0 || gy < 0 || gx >= SHP_BCOLS || gy >= SHP_BROWS
                     || shpBoard[gy][gx] > 0;
            const px  = ox + b.x * SHP_CELL;
            const py  = oy + b.y * SHP_CELL;
            _block(px, py, bad ? SHP_CLR_PREV_BAD : col, 0.80, SHP_CELL, 0);
            if(bad) _blockBad(px, py, SHP_CELL);
        }
    } else {
        // Outside board — float freely, no collision colouring
        for(const b of blocks)
            _block(ox + b.x * SHP_CELL, oy + b.y * SHP_CELL, col, 0.85, SHP_CELL, 0);
    }
}

// Combo label shown mid-board while clearing 2+ lines at once
function _drawComboLabel() {
    if(shpPhase !== "clearing" || shpClearList.length < 2) return;
    const n   = shpClearList.length;
    const txt = n >= 4 ? "4\u00D7 PERFECT!" : `${n}\u00D7 CLEAR!`;
    const col = n >= 4 ? SHP_CLR_COMBO_GRN : SHP_CLR_COMBO_GOLD;
    const yp  = SHP_BY + Math.round(SHP_BH / 3);
    const cx  = _cx;
    cx.font         = _msf(30);
    cx.textAlign    = "center";
    cx.textBaseline = "middle";
    cx.lineWidth    = 4;
    cx.strokeStyle  = "rgba(0,0,0,0.75)";
    cx.strokeText(txt, SHP_BX + SHP_BW / 2, yp);
    cx.fillStyle    = col;
    cx.fillText(txt, SHP_BX + SHP_BW / 2, yp);
    cx.textBaseline = "alphabetic";
}

function _drawGameOver() {
    const cx   = _cx;
    const midX = Math.floor(V2_CW / 2);
    const midY = Math.floor(V2_CH / 2);

    // Full-canvas overlay
    cx.fillStyle = SHP_CLR_OVR;
    cx.fillRect(0, 0, V2_CW, V2_CH);

    cx.textAlign    = "center";
    cx.textBaseline = "alphabetic";

    cx.font      = _msf(34);
    cx.fillStyle = SHP_CLR_OVR_HDL;
    cx.fillText("BOARD FULL!", midX, midY - 72);

    cx.font      = _mf(14);
    cx.fillStyle = SHP_CLR_OVR_LBL;
    cx.fillText("FINAL SCORE", midX, midY - 28);

    cx.font      = _mbf(52);
    cx.fillStyle = SHP_CLR_OVR_SCR;
    cx.fillText(String(shpScore).padStart(7, "0"), midX, midY + 26);

    if(shpPB > 0) {
        const isNew = shpScore >= shpPB;
        cx.font      = isNew ? _mbf(14) : _mf(12);
        cx.fillStyle = isNew ? SHP_CLR_OVR_PB_HI : SHP_CLR_OVR_PB;
        cx.fillText(
            isNew ? "NEW BEST! \u2B50" : "BEST: " + String(shpPB).padStart(7, "0"),
            midX, midY + 50
        );
    }

    // PLAY AGAIN button  (locked / grey for first 1000 ms)
    const locked = shpOverLockMs < 1000;
    const btnX   = midX - 100;
    const btnY   = midY + 68;
    cx.fillStyle   = locked ? SHP_CLR_BTN_OFF_BG : SHP_CLR_BTN_ON_BG;
    _rrect(cx, btnX, btnY, 200, 52, 14);
    cx.fill();
    cx.strokeStyle  = locked ? SHP_CLR_BTN_OFF_BD : SHP_CLR_BTN_ON_BD;
    cx.lineWidth    = 2;
    _rrect(cx, btnX, btnY, 200, 52, 14);
    cx.stroke();
    cx.font         = _msf(20);
    cx.fillStyle    = SHP_CLR_BTN_TXT;
    cx.textBaseline = "middle";
    cx.fillText(locked ? "WAIT..." : "PLAY AGAIN", midX, btnY + 26);
    cx.textBaseline = "alphabetic";
    cx.textAlign    = "left";
}

function _draw() {
    const cx = _cx;

    // Solid base (always — fallback when bg disabled or not yet loaded)
    cx.fillStyle = SHP_CLR_BG;
    cx.fillRect(0, 0, V2_CW, V2_CH);

    // Background image — cover-cropped below HUD strip
    if(SHELL_isBgEnabled() && shpBgReady) {
        const areaW  = V2_CW;
        const areaH  = V2_CH - SHP_HUD_H;
        const scl    = Math.max(areaW / SHP_BG.naturalWidth, areaH / SHP_BG.naturalHeight);
        const dw     = SHP_BG.naturalWidth  * scl;
        const dh     = SHP_BG.naturalHeight * scl;
        const ddx    = (areaW - dw) / 2;
        const ddy    = SHP_HUD_H + (areaH - dh) / 2;
        cx.drawImage(SHP_BG, ddx, ddy, dw, dh);
    }

    // HUD drawn on top of bg — game-over overlay will paint over everything later
    _drawHUD();

    // Play field
    cx.fillStyle = SHP_CLR_PF_BG;
    cx.fillRect(SHP_BX, SHP_BY, SHP_BW, SHP_BH);

    _drawGrid();
    _drawBoard();
    _drawTray();

    // Floating drag piece — suppressed while clearing (piece already placed)
    if(shpPhase === "playing") _drawDragging();

    // In-field feedback
    _drawComboLabel();

    // Game-over overlay — covers everything including HUD
    if(shpPhase === "over") _drawGameOver();
}
