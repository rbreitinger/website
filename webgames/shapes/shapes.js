// =============================================================================
// shapes.js  —  shell-compatible version  (drag-to-place redesign)
// Drag piece from panel onto board · R / RMB / swipe to rotate
// =============================================================================

// ---------- board geometry ----------
const CELL  = 32;
const BCOLS = 8;
const BROWS = 8;
const BW    = BCOLS * CELL;                                          // 256
const BH    = BROWS * CELL;                                          // 256
const BX    = SHELL_PFX + Math.floor((SHELL_PFW - BW) / 2);          // 68
const BY    = SHELL_PFY + Math.floor((SHELL_PFH - BH) / 2);          // 32

// ---------- sidebar piece boxes ----------
// Active piece: left-aligned  |  Next piece: right-aligned
// Both at the same Y row, MINI_BOX × MINI_BOX each
const MINI_CELL   = 16;
const MINI_BOX    = 4 * MINI_CELL;                                    // 64

const SHP_ACT_X   = SHELL_BTN_X;                                      // 412
const SHP_NXT_X   = SHELL_SBX + SHELL_SBW - 4 - MINI_BOX;             // 492
const SHP_PIECE_Y = SHELL_SBY + 60;                                   // 76

// ---------- sidebar text ----------
const SHP_SCORE_Y = SHELL_SBY + 18;                                   // 34
const SHP_BEST_Y  = SHELL_SBY + 36;                                   // 52

// ---------- colors ----------
const CLR_PF_BG        = "#0b0d10";
const CLR_BOARD_BORDER = "#5c6677";
const CLR_BLOCK_INNER  = "#000000";
const CLR_PREVIEW_OK   = "#ffffff";
const CLR_PREVIEW_BAD  = "#ff0000";
const CLR_ACT_BOX_BG   = "#1a2230";    // active piece box — dark tinted bg
const CLR_ACT_BOX_BDR  = "#4488cc";    // active piece box — blue border = interactive
const CLR_NXT_BOX_BG   = "#111519";    // next piece box   — darker, quieter
const CLR_NXT_BOX_BDR  = "#3a4555";    // next piece box   — muted border
const CLR_OVERLAY_BG   = "#000000";
const CLR_OVERLAY_TXT  = "#ffffff";
const CLR_OVERLAY_SUB  = "#93a0b3";
const CLR_SIDEBAR_TXT  = "#1c2333";

// ---------- piece palette (index 0 = empty) ----------
const PAL = ["#000","#00eac7","#b863f4","#376177","#41e865","#d21fb8","#7d26cd"];

// ---------- 7 tetrominoes in 4×4 local space ----------
const SHAPES = [
    [{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:3,y:0}],  // I
    [{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}],  // O
    [{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:1,y:1}],  // T
    [{x:0,y:0},{x:0,y:1},{x:0,y:2},{x:1,y:2}],  // L
    [{x:1,y:0},{x:1,y:1},{x:1,y:2},{x:0,y:2}],  // J
    [{x:1,y:0},{x:2,y:0},{x:0,y:1},{x:1,y:1}],  // S
    [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:2,y:1}],  // Z
];

const PB_KEY = "shapes_score";

// ---------- state ----------
let shpBoard;
let shpPlaced, shpScore, shpPB;
let shpActive, shpNext;
let shpGameOver;
let shpDragging, shpDragX, shpDragY;
let _cv, _cx;

// =============================================================================
// GAME INTERFACE
// =============================================================================
const GAME = {
    title:    "Shapes",
    subtitle: "Drag to place \u00B7 R / swipe to rotate",

    init(canvas) {
        _cv = canvas;
        _cx = canvas.getContext("2d");
        shpPB       = SHELL_getPB(PB_KEY) || 0;
        shpDragging = false;

        // Suppress RMB context menu on canvas
        _cv.addEventListener("contextmenu", e => e.preventDefault());

        // Mousedown: RMB rotates, LMB starts drag if pointer lands on active piece
        _cv.addEventListener("mousedown", e => {
            if(shellPhase !== "running" || shpGameOver) return;
            if(e.button === 2) { _rotatePiece(); return; }
            if(e.button !== 0) return;
            const rc = _cv.getBoundingClientRect();
            const mx = (e.clientX - rc.left) * (SHELL_CW / rc.width);
            const my = (e.clientY - rc.top)  * (SHELL_CH / rc.height);
            if(_isOnActivePiece(mx, my)) _startDrag(mx, my);
        });

        // Mouseup on document finalizes any active drag — fires even if cursor left canvas
        document.addEventListener("mouseup", () => {
            if(shpDragging) _tryPlace();
        });

        // Keyboard R to rotate
        window.addEventListener("keydown", e => {
            if(shellPhase !== "running" || shpGameOver) return;
            if(e.key === "r" || e.key === "R") _rotatePiece();
        });

        // Touch: detect drag-start on the active piece tile
        _cv.addEventListener("touchstart", e => {
            if(shellPhase !== "running" || shpGameOver) return;
            const rc = _cv.getBoundingClientRect();
            const t  = e.changedTouches[0];
            const mx = (t.clientX - rc.left) * (SHELL_CW / rc.width);
            const my = (t.clientY - rc.top)  * (SHELL_CH / rc.height);
            if(_isOnActivePiece(mx, my)) _startDrag(mx, my);
        }, { passive: true });

        _buildIdleBoard();
    },

    start() { _resetGame(); },
    reset() { _resetGame(); },
    update() {},
    draw()   { _draw(); },

    // Shell fires onClick for: mousedown (desktop, already handled above) and touchend (small move)
    // We only care about the touchend case here: finalize an active drag
    onClick(mx, my) {
        if(shpDragging) _tryPlace();
    },

    // Shell fires onDrag for: mousemove-while-held (desktop) and touchmove (mobile)
    onDrag(mx, my) {
        if(!shpDragging) return;
        shpDragX = mx;
        shpDragY = my;
    },

    // Shell fires onSwipe for touchend with large move
    // If dragging → finalize placement (movement was the drag, not a gesture)
    // Otherwise   → rotate piece
    onSwipe(dir) {
        if(shpDragging) { _tryPlace(); return; }
        if(shellPhase !== "running" || shpGameOver) return;
        _rotatePiece();
    }
};

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
    let bl = SHAPES[piece.shapeIndex];
    for(let i = 0; i < piece.rotation; i++) bl = _rotate90(bl);
    return bl;
}

function _fits(ax, ay, blocks) {
    for(const b of blocks) {
        const gx = ax + b.x, gy = ay + b.y;
        if(gx < 0 || gy < 0 || gx >= BCOLS || gy >= BROWS) return false;
        if(shpBoard[gy][gx] > 0) return false;
    }
    return true;
}

function _hasAnyMove(piece) {
    for(let rot = 0; rot < 4; rot++) {
        let bl = SHAPES[piece.shapeIndex];
        for(let i = 0; i < rot; i++) bl = _rotate90(bl);
        for(let gy = 0; gy < BROWS; gy++)
            for(let gx = 0; gx < BCOLS; gx++)
                if(_fits(gx, gy, bl)) return true;
    }
    return false;
}

function _rotatePiece() {
    shpActive.rotation = (shpActive.rotation + 1) % 4;
}

function _randPiece() {
    return {
        shapeIndex: Math.floor(Math.random() * SHAPES.length),
        rotation:   0,
        colorId:    1 + Math.floor(Math.random() * (PAL.length - 1))
    };
}

// =============================================================================
// DRAG HELPERS
// =============================================================================

// Returns true if (mx, my) lands on any filled cell of the active piece in its sidebar box
function _isOnActivePiece(mx, my) {
    if(!shpActive) return false;
    const blocks = _getBlocks(shpActive);
    for(const b of blocks) {
        const px = SHP_ACT_X + b.x * MINI_CELL;
        const py = SHP_PIECE_Y + b.y * MINI_CELL;
        if(mx >= px && mx < px + MINI_CELL && my >= py && my < py + MINI_CELL) return true;
    }
    return false;
}

function _startDrag(mx, my) {
    shpDragging = true;
    shpDragX    = mx;
    shpDragY    = my;
}

// Returns the board col/row the piece would snap to given current drag position.
// Centers the piece bounding box on the cursor.
function _snapCell() {
    const blocks = _getBlocks(shpActive);
    const minX   = Math.min(...blocks.map(b => b.x));
    const maxX   = Math.max(...blocks.map(b => b.x));
    const minY   = Math.min(...blocks.map(b => b.y));
    const maxY   = Math.max(...blocks.map(b => b.y));
    const col    = Math.round((shpDragX - BX) / CELL - (minX + maxX + 1) / 2);
    const row    = Math.round((shpDragY - BY) / CELL - (minY + maxY + 1) / 2);
    return { col, row };
}

function _tryPlace() {
    shpDragging = false;
    const blocks = _getBlocks(shpActive);
    // Generous hit zone — one CELL margin around board edge
    const nearBoard = shpDragX >= BX - CELL && shpDragX <= BX + BW + CELL &&
                      shpDragY >= BY - CELL && shpDragY <= BY + BH + CELL;
    if(nearBoard) {
        const sc = _snapCell();
        if(_fits(sc.col, sc.row, blocks)) {
            for(const b of blocks) {
                shpBoard[sc.row + b.y][sc.col + b.x] = shpActive.colorId;
            }
            shpPlaced++;
            shpScore += shpPlaced;
            _clearLines();
            shpActive = shpNext;
            shpNext   = _randPiece();
            _checkGameOver();
            return;
        }
    }
    // Piece silently returns to sidebar — no penalty, player tries again
}

// =============================================================================
// GAME LOGIC
// =============================================================================
function _clearLines() {
    for(let gy = 0; gy < BROWS; gy++) {
        if(shpBoard[gy].every(v => v > 0)) {
            shpBoard[gy].fill(0);
            shpScore += 5 * shpPlaced;
        }
    }
    for(let gx = 0; gx < BCOLS; gx++) {
        if(shpBoard.every(row => row[gx] > 0)) {
            shpBoard.forEach(row => row[gx] = 0);
            shpScore += 5 * shpPlaced;
        }
    }
}

function _checkGameOver() {
    shpGameOver = !_hasAnyMove(shpActive);
    if(shpGameOver && shpScore > shpPB) {
        shpPB = shpScore;
        SHELL_setPB(PB_KEY, shpPB);
    }
}

function _buildIdleBoard() {
    shpBoard = [];
    for(let gy = 0; gy < BROWS; gy++) shpBoard.push(new Array(BCOLS).fill(0));
    const pat = [[1,0],[2,0],[3,0],[1,1],[5,1],[6,1],[2,2],[3,2],[5,2],
                 [0,4],[1,4],[4,4],[5,4],[0,5],[4,5],[2,6],[3,6],[5,6]];
    for(const [x, y] of pat) shpBoard[y][x] = (x + y) % 6 + 1;
    shpPlaced = 0; shpScore = 0;
    shpActive = _randPiece(); shpNext = _randPiece();
    shpGameOver = false; shpDragging = false;
}

function _resetGame() {
    shpBoard = [];
    for(let gy = 0; gy < BROWS; gy++) shpBoard.push(new Array(BCOLS).fill(0));
    shpPlaced = 0; shpScore = 0;
    shpActive = _randPiece(); shpNext = _randPiece();
    shpGameOver = false; shpDragging = false;
    _checkGameOver();
}

// =============================================================================
// DRAWING
// =============================================================================
function _uf(sz) { return `${sz}px Consolas,"Lucida Console","Courier New",monospace`; }

// Draw one block. Scales proportionally to cellSize so it looks right at both CELL and MINI_CELL.
function _block(px, py, outer, alpha, cellSz) {
    const m1 = Math.round(cellSz * 0.125);   // outer margin (4px at CELL=32, 2px at MINI_CELL=16)
    const m2 = Math.round(cellSz * 0.3125);  // dot   margin (10px at CELL=32, 5px at MINI_CELL=16)
    _cx.globalAlpha = alpha;
    _cx.fillStyle   = outer;
    _cx.fillRect(px + m1, py + m1, cellSz - m1 * 2, cellSz - m1 * 2);
    _cx.globalAlpha = 1.0;
    _cx.fillStyle   = CLR_BLOCK_INNER;
    _cx.fillRect(px + m2, py + m2, cellSz - m2 * 2, cellSz - m2 * 2);
}

function _drawBoard() {
    _cx.strokeStyle = CLR_BOARD_BORDER;
    _cx.lineWidth   = 1;
    _cx.strokeRect(BX, BY, BW, BH);
    for(let gy = 0; gy < BROWS; gy++)
        for(let gx = 0; gx < BCOLS; gx++) {
            const v = shpBoard[gy][gx];
            if(v > 0) _block(BX + gx * CELL, BY + gy * CELL, PAL[v % PAL.length], 1.0, CELL);
        }
}

function _drawPieceInBox(piece, boxX, boxY) {
    if(!piece) return;
    const blocks = _getBlocks(piece);
    const col    = PAL[piece.colorId % PAL.length];
    for(const b of blocks)
        _block(boxX + b.x * MINI_CELL, boxY + b.y * MINI_CELL, col, 1.0, MINI_CELL);
}

function _drawSidebar() {
    const cx = _cx;
    cx.fillStyle    = CLR_SIDEBAR_TXT;
    cx.font         = _uf(13);
    cx.textAlign    = "left";
    cx.textBaseline = "alphabetic";
    cx.fillText("SCORE: " + String(shpScore).padStart(5, "0"), SHELL_BTN_X, SHP_SCORE_Y);
    cx.fillText("BEST:  " + String(shpPB).padStart(5, "0"),   SHELL_BTN_X, SHP_BEST_Y);

    // Active piece box — blue border signals "this is draggable"
    cx.fillStyle   = CLR_ACT_BOX_BG;
    cx.fillRect(SHP_ACT_X, SHP_PIECE_Y, MINI_BOX, MINI_BOX);
    cx.strokeStyle = CLR_ACT_BOX_BDR;
    cx.lineWidth   = 1;
    cx.strokeRect(SHP_ACT_X, SHP_PIECE_Y, MINI_BOX, MINI_BOX);
    // Hide piece from box while dragging — it's floating under the cursor instead
    if(!shpDragging) _drawPieceInBox(shpActive, SHP_ACT_X, SHP_PIECE_Y);

    // Next piece box — muted, player can see and plan rotation
    cx.fillStyle   = CLR_NXT_BOX_BG;
    cx.fillRect(SHP_NXT_X, SHP_PIECE_Y, MINI_BOX, MINI_BOX);
    cx.strokeStyle = CLR_NXT_BOX_BDR;
    cx.lineWidth   = 1;
    cx.strokeRect(SHP_NXT_X, SHP_PIECE_Y, MINI_BOX, MINI_BOX);
    _drawPieceInBox(shpNext, SHP_NXT_X, SHP_PIECE_Y);
}

// Piece floating under cursor during drag.
// Outside board: floats at CELL size centered on cursor.
// Inside  board: snaps to nearest grid cell, green = fits, red = blocked.
function _drawDragging() {
    if(!shpDragging || !shpActive) return;
    const blocks    = _getBlocks(shpActive);
    const nearBoard = shpDragX >= BX - CELL && shpDragX <= BX + BW + CELL &&
                      shpDragY >= BY - CELL && shpDragY <= BY + BH + CELL;

    if(nearBoard) {
        const sc   = _snapCell();
        const fits = _fits(sc.col, sc.row, blocks);
        for(const b of blocks) {
            _block(BX + (sc.col + b.x) * CELL, BY + (sc.row + b.y) * CELL,
                   fits ? CLR_PREVIEW_OK : CLR_PREVIEW_BAD, 0.85, CELL);
        }
    } else {
        // Center piece bounding box on cursor
        const minX = Math.min(...blocks.map(b => b.x));
        const maxX = Math.max(...blocks.map(b => b.x));
        const minY = Math.min(...blocks.map(b => b.y));
        const maxY = Math.max(...blocks.map(b => b.y));
        const ox   = shpDragX - (minX + maxX + 1) * CELL / 2;
        const oy   = shpDragY - (minY + maxY + 1) * CELL / 2;
        for(const b of blocks)
            _block(ox + b.x * CELL, oy + b.y * CELL,
                   PAL[shpActive.colorId % PAL.length], 0.85, CELL);
    }
}

function _drawGameOver() {
    if(!shpGameOver) return;
    _cx.globalAlpha = 0.75;
    _cx.fillStyle   = CLR_OVERLAY_BG;
    _cx.fillRect(BX, BY, BW, BH);
    _cx.globalAlpha = 1.0;
    _cx.textAlign   = "center";
    _cx.fillStyle   = CLR_OVERLAY_TXT;
    _cx.font        = _uf(28);
    _cx.fillText("GAME OVER",              BX + BW / 2, BY + BH / 2 - 6);
    _cx.fillStyle   = CLR_OVERLAY_SUB;
    _cx.font        = _uf(14);
    _cx.fillText("Press RESET to play again", BX + BW / 2, BY + BH / 2 + 20);
    _cx.textAlign   = "left";
}

function _drawIdleOverlay() {
    _cx.globalAlpha = 0.75;
    _cx.fillStyle   = CLR_OVERLAY_BG;
    _cx.fillRect(BX, BY, BW, BH);
    _cx.globalAlpha = 1.0;
    _cx.textAlign   = "center";
    _cx.fillStyle   = CLR_OVERLAY_TXT;
    _cx.font        = _uf(22);
    _cx.fillText("SHAPES",                          BX + BW / 2, BY + BH / 2 - 20);
    _cx.fillStyle   = CLR_OVERLAY_SUB;
    _cx.font        = _uf(12);
    _cx.fillText("Place tetrominoes on the board",   BX + BW / 2, BY + BH / 2 + 2);
    _cx.fillText("Full rows or cols get cleared",    BX + BW / 2, BY + BH / 2 + 18);
    _cx.fillText("Drag piece to board \u00B7 R to rotate", BX + BW / 2, BY + BH / 2 + 34);
    _cx.textAlign   = "left";
}

function _draw() {
    _cx.fillStyle = CLR_BG;
    _cx.fillRect(0, 0, SHELL_CW, SHELL_CH);

    _cx.fillStyle = CLR_PF_BG;
    _cx.fillRect(SHELL_PFX, SHELL_PFY, SHELL_PFW, SHELL_PFH);

    _drawBoard();
    _drawSidebar();

    if(shellPhase === "idle") {
        _drawIdleOverlay();
    } else {
        _drawDragging();
        _drawGameOver();
    }
}
