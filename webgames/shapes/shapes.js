// =============================================================================
// shapes.js  —  shell-compatible version
// LMB place piece · RMB / R rotate · Shell owns START / RESET
// =============================================================================

// ---------- board geometry (built on top of shell constants) ----------
const CELL  = 32;
const BCOLS = 8;
const BROWS = 8;
const BW    = BCOLS * CELL;                               // 256
const BH    = BROWS * CELL;                               // 256
const BX    = SHELL_PFX + Math.floor((SHELL_PFW - BW) / 2);
const BY    = SHELL_PFY + Math.floor((SHELL_PFH - BH) / 2);

// ---------- sidebar layout (all relative to shell constants) ----------
const MINI_CELL     = 16;
const SB_SCORE_Y    = SHELL_SBY + 18;
const SB_CLEAR_Y    = SHELL_SBY + 36;
const SB_BEST_Y     = SHELL_SBY + 54;
const SB_NEXT_LBL_Y = SHELL_SBY + 92;
const SB_NEXT_BOX_Y = SHELL_SBY + 104;

// ---------- game colors ----------
const CLR_PF_BG        = "#0b0d10";
const CLR_BOARD_BORDER = "#5c6677";
const CLR_BLOCK_INNER  = "#000000";
const CLR_PREVIEW_OK   = "#ffffff";
const CLR_PREVIEW_BAD  = "#ff0000";
const CLR_NEXT_BG      = "#a5a9ac";
const CLR_NEXT_CELL    = "#d7dde5";
const CLR_OVERLAY_BG   = "#000000";
const CLR_OVERLAY_TXT  = "#ffffff";
const CLR_OVERLAY_SUB  = "#93a0b3";
const CLR_SIDEBAR_TXT  = "#000000";

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
let board;
let placedTiles, clearedLines, score, pb;
let currentPiece, nextPiece;
let gameOver;
let hoverX, hoverY;
let _cv, _cx;

// =============================================================================
// GAME INTERFACE
// =============================================================================
const GAME = {
    title:    "Shapes",
    subtitle: "LMB place \u00B7 RMB / R rotate",

    init(canvas){
        _cv = canvas;
        _cx = canvas.getContext("2d");
        hoverX = 0; hoverY = 0;
        pb = SHELL_getPB(PB_KEY) || 0;
        _buildIdleBoard();
        _cv.addEventListener("mousemove",   _onMouseMove);
        _cv.addEventListener("mousedown",   _onMouseDown);
        _cv.addEventListener("contextmenu", e => e.preventDefault());
        window.addEventListener("keydown",  _onKey);
    },

    start(){ _resetGame(); },
    reset(){ _resetGame(); },
    update(){ /* purely reactive — no tick needed */ },
    draw(){ _draw(); }
};

// =============================================================================
// BOARD / PIECE HELPERS
// =============================================================================
function _makeBoard(){
    const b = [];
    for(let y = 0; y < BROWS; y++) b.push(new Array(BCOLS).fill(0));
    return b;
}

function _buildIdleBoard(){
    board = _makeBoard();
    const pat = [[1,0],[2,0],[3,0],[1,1],[5,1],[6,1],[2,2],[3,2],[5,2],
                 [0,4],[1,4],[4,4],[5,4],[0,5],[4,5],[2,6],[3,6],[5,6]];
    for(const [x, y] of pat) board[y][x] = (x + y) % 6 + 1;
    placedTiles = 0; clearedLines = 0; score = 0;
    currentPiece = _randPiece(); nextPiece = _randPiece();
    gameOver = false;
}

function _resetGame(){
    board = _makeBoard();
    placedTiles = 0; clearedLines = 0; score = 0;
    currentPiece = _randPiece(); nextPiece = _randPiece();
    gameOver = false;
    _checkGameOver();
}

function _randPiece(){
    return {
        shapeIndex: Math.floor(Math.random() * SHAPES.length),
        rotation:   0,
        colorId:    1 + Math.floor(Math.random() * 6)
    };
}

function _rotate90(blocks){
    const r    = blocks.map(b => ({x: -b.y, y: b.x}));
    const minX = Math.min(...r.map(b => b.x));
    const minY = Math.min(...r.map(b => b.y));
    return r.map(b => ({x: b.x - minX, y: b.y - minY}));
}

function _getBlocks(piece){
    let bl = SHAPES[piece.shapeIndex];
    for(let i = 0; i < piece.rotation; i++) bl = _rotate90(bl);
    return bl;
}

function _fits(ax, ay, blocks){
    for(const b of blocks){
        const gx = ax + b.x, gy = ay + b.y;
        if(gx < 0 || gy < 0 || gx >= BCOLS || gy >= BROWS) return false;
        if(board[gy][gx] > 0) return false;
    }
    return true;
}

function _hasAnyMove(piece){
    for(let rot = 0; rot < 4; rot++){
        let bl = SHAPES[piece.shapeIndex];
        for(let i = 0; i < rot; i++) bl = _rotate90(bl);
        for(let y = 0; y < BROWS; y++)
            for(let x = 0; x < BCOLS; x++)
                if(_fits(x, y, bl)) return true;
    }
    return false;
}

function _checkGameOver(){
    gameOver = !_hasAnyMove(currentPiece);
    if(gameOver && score > pb){
        pb = score;
        SHELL_setPB(PB_KEY, pb);
    }
}

function _place(ax, ay, blocks, colorId){
    for(const b of blocks){
        const gx = ax + b.x, gy = ay + b.y;
        if(gx >= 0 && gy >= 0 && gx < BCOLS && gy < BROWS && board[gy][gx] === 0)
            board[gy][gx] = colorId;
    }
}

function _clearLines(){
    for(let y = 0; y < BROWS; y++){
        if(board[y].every(v => v > 0)){
            board[y].fill(0);
            clearedLines++; score += 5 * placedTiles;
        }
    }
    for(let x = 0; x < BCOLS; x++){
        if(board.every(row => row[x] > 0)){
            board.forEach(row => row[x] = 0);
            clearedLines++; score += 5 * placedTiles;
        }
    }
}

// =============================================================================
// INPUT
// =============================================================================
function _pixelToCell(mx, my){
    return { x: Math.floor((mx - BX) / CELL), y: Math.floor((my - BY) / CELL) };
}

function _onMouseMove(e){
    const rc = _cv.getBoundingClientRect();
    const c  = _pixelToCell(e.clientX - rc.left, e.clientY - rc.top);
    hoverX = c.x; hoverY = c.y;
}

function _onMouseDown(e){
    if(shellPhase === "idle") return;
    if(gameOver) return;
    if(e.button === 2){
        currentPiece.rotation = (currentPiece.rotation + 1) % 4;
        return;
    }
    if(e.button !== 0) return;
    const rc     = _cv.getBoundingClientRect();
    const mx     = e.clientX - rc.left, my = e.clientY - rc.top;
    if(mx < BX || mx >= BX + BW || my < BY || my >= BY + BH) return;
    const blocks = _getBlocks(currentPiece);
    if(!_fits(hoverX, hoverY, blocks)) return;
    _place(hoverX, hoverY, blocks, currentPiece.colorId);
    placedTiles++;
    score += placedTiles;
    _clearLines();
    currentPiece = nextPiece;
    nextPiece    = _randPiece();
    _checkGameOver();
}

function _onKey(e){
    if(shellPhase === "idle") return;
    if((e.key === "r" || e.key === "R") && !gameOver)
        currentPiece.rotation = (currentPiece.rotation + 1) % 4;
}

// =============================================================================
// DRAWING
// =============================================================================
function _uf(sz){ return `${sz}px Consolas,"Lucida Console","Courier New",monospace`; }

function _block(px, py, outer, alpha){
    _cx.globalAlpha = alpha;
    _cx.fillStyle   = outer;
    _cx.fillRect(px + 4,  py + 4,  CELL - 8,  CELL - 8);
    _cx.globalAlpha = 1.0;
    _cx.fillStyle   = CLR_BLOCK_INNER;
    _cx.fillRect(px + 10, py + 10, CELL - 20, CELL - 20);
}

function _drawBoard(){
    _cx.strokeStyle = CLR_BOARD_BORDER;
    _cx.lineWidth   = 1;
    _cx.strokeRect(BX, BY, BW, BH);
    for(let y = 0; y < BROWS; y++)
        for(let x = 0; x < BCOLS; x++){
            const v = board[y][x];
            if(v > 0) _block(BX + x * CELL, BY + y * CELL, PAL[v % PAL.length], 1.0);
        }
}

function _drawPreview(){
    if(shellPhase !== "running" || gameOver) return;
    const blocks = _getBlocks(currentPiece);
    for(const b of blocks){
        const gx  = hoverX + b.x, gy = hoverY + b.y;
        const bad = gx < 0 || gy < 0 || gx >= BCOLS || gy >= BROWS || board[gy][gx] > 0;
        _block(BX + gx * CELL, BY + gy * CELL, bad ? CLR_PREVIEW_BAD : CLR_PREVIEW_OK, 0.9);
    }
}

function _drawNextPiece(){
    const blocks = _getBlocks(nextPiece);
    _cx.fillStyle    = CLR_SIDEBAR_TXT;
    _cx.font         = _uf(14);
    _cx.textAlign    = "left";
    _cx.textBaseline = "alphabetic";
    _cx.fillText("NEXT:", SHELL_BTN_X, SB_NEXT_LBL_Y);

    const bx = SHELL_BTN_X, by = SB_NEXT_BOX_Y;
    _cx.strokeStyle = CLR_SIDEBAR_TXT;
    _cx.lineWidth   = 1;
    _cx.strokeRect(bx, by, 4 * MINI_CELL, 4 * MINI_CELL);
    _cx.fillStyle   = CLR_NEXT_BG;
    _cx.fillRect(bx + 1, by + 1, 4 * MINI_CELL - 2, 4 * MINI_CELL - 2);
    for(const b of blocks){
        const px = bx + b.x * MINI_CELL, py = by + b.y * MINI_CELL;
        _cx.fillStyle = CLR_NEXT_CELL;
        _cx.fillRect(px + 2, py + 2, MINI_CELL - 4, MINI_CELL - 4);
        _cx.fillStyle = CLR_SIDEBAR_TXT;
        _cx.fillRect(px + 5, py + 5, MINI_CELL - 10, MINI_CELL - 10);
    }
}

function _drawSidebar(){
    _cx.fillStyle    = CLR_SIDEBAR_TXT;
    _cx.font         = _uf(14);
    _cx.textAlign    = "left";
    _cx.textBaseline = "alphabetic";
    _cx.fillText("SCORE: " + score,        SHELL_BTN_X, SB_SCORE_Y);
    _cx.fillText("CLEAR: " + clearedLines, SHELL_BTN_X, SB_CLEAR_Y);
    _cx.fillText("BEST:  " + pb,           SHELL_BTN_X, SB_BEST_Y);
    _drawNextPiece();
}

function _drawGameOver(){
    if(!gameOver) return;
    _cx.globalAlpha  = 0.75;
    _cx.fillStyle    = CLR_OVERLAY_BG;
    _cx.fillRect(BX, BY, BW, BH);
    _cx.globalAlpha  = 1.0;
    _cx.textAlign    = "center";
    _cx.fillStyle    = CLR_OVERLAY_TXT;
    _cx.font         = _uf(28);
    _cx.fillText("GAME OVER", BX + BW / 2, BY + BH / 2 - 6);
    _cx.fillStyle    = CLR_OVERLAY_SUB;
    _cx.font         = _uf(14);
    _cx.fillText("Press RESET to play again", BX + BW / 2, BY + BH / 2 + 20);
    _cx.textAlign    = "left";
}

function _drawIdleOverlay(){
    _cx.globalAlpha  = 0.75;
    _cx.fillStyle    = CLR_OVERLAY_BG;
    _cx.fillRect(BX, BY, BW, BH);
    _cx.globalAlpha  = 1.0;
    _cx.textAlign    = "center";
    _cx.fillStyle    = CLR_OVERLAY_TXT;
    _cx.font         = _uf(22);
    _cx.fillText("SHAPES",                       BX + BW / 2, BY + BH / 2 - 20);
    _cx.fillStyle    = CLR_OVERLAY_SUB;
    _cx.font         = _uf(12);
    _cx.fillText("Place tetrominoes on the board", BX + BW / 2, BY + BH / 2 + 2);
    _cx.fillText("Full rows or cols get cleared",  BX + BW / 2, BY + BH / 2 + 18);
    _cx.fillText("LMB place \u00B7 RMB/R rotate",  BX + BW / 2, BY + BH / 2 + 34);
    _cx.textAlign    = "left";
}

function _draw(){
    _cx.fillStyle = CLR_BG;
    _cx.fillRect(0, 0, SHELL_CW, SHELL_CH);

    _cx.fillStyle = CLR_PF_BG;
    _cx.fillRect(SHELL_PFX, SHELL_PFY, SHELL_PFW, SHELL_PFH);

    _drawBoard();
    _drawSidebar();

    if(shellPhase === "idle"){
        _drawIdleOverlay();
    } else {
        _drawPreview();
        _drawGameOver();
    }
}