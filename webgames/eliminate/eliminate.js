// =============================================================================
// eliminate.js  —  shell-compatible version
// Click a group of 2+ connected same-color gems to remove them.
// Board falls down, empty columns slide inward. Score = removed² per click.
// =============================================================================

// ---------- board geometry (built on top of shell constants) ----------
const CELLPX = 20;
const GCOLS  = Math.floor(SHELL_PFW / CELLPX);   // 18
const GROWS  = Math.floor(SHELL_PFH / CELLPX);   // 14
const BW     = GCOLS * CELLPX;
const BH     = GROWS * CELLPX;
const BX     = SHELL_PFX + Math.floor((SHELL_PFW - BW) / 2);
const BY     = SHELL_PFY + Math.floor((SHELL_PFH - BH) / 2);

// ---------- sidebar layout ----------
const SB_LEVEL_Y  = SHELL_SBY + 18;
const SB_SCORE_Y  = SHELL_SBY + 36;
const SB_BROKE_Y  = SHELL_SBY + 54;
const SB_BEST_Y   = SHELL_SBY + 86;

// ---------- game colors ----------
const CLR_PF_BG        = "#000000";
const CLR_OVERLAY_BG   = "#000000";
const CLR_OVERLAY_TXT  = "#ffffff";
const CLR_OVERLAY_SUB  = "#93a0b3";
const CLR_GAMEOVER_TXT = "#FF5555";
const CLR_SIDEBAR_TXT  = "#000";

// ---------- gem palette (index 0 = empty) ----------
const GEM_COL = [
    "#000000",  // 0 unused
    "#5555FF",
    "#55FF55",
    "#FF5555",
    "#FFFF55",
    "#FF55FF",
    "#55FFFF",
    "#AAAAAA"
];

const PB_KEY = "elim_score";

// ---------- state ----------
let grid;
let cursorX, cursorY;
let score, broke, remaining;
let pb = 0;
let cLeft, cRight;
let checkFall;
let level, nextLevel;
let gameOver;
let slideToggle;

// countdown
let cdActive, cdMsLeft, cdShown;

// mouse
let mouseDownCell = null;

let _cv, _cx;

// =============================================================================
// GAME INTERFACE
// =============================================================================
const GAME = {
    title:    "Eliminate",
    subtitle: "Click a group of 2+ to remove",

    init(canvas){
        _cv = canvas;
        _cx = canvas.getContext("2d");
        pb  = SHELL_getPB(PB_KEY) || 0;
        _buildIdleGrid();
        _cv.addEventListener("mousedown", _onMouseDown);
        _cv.addEventListener("mouseup",   _onMouseUp);
    },

    start(){ _resetAll(); },
    reset(){ _resetAll(); },

    update(dt){
        if(shellPhase === "idle") return;
        _updateStep(dt);
    },

    draw(){ _draw(); }
};

// =============================================================================
// GRID HELPERS
// =============================================================================
function _makeGrid(){
    const g = new Array(GCOLS + 1);
    for(let x = 0; x <= GCOLS; x++) g[x] = new Array(GROWS + 1).fill(0);
    return g;
}

function _buildIdleGrid(){
    grid = _makeGrid();
    for(let y = 1; y <= GROWS; y++)
        for(let x = 1; x <= GCOLS; x++)
            grid[x][y] = ((x + y * 3) % 7) + 1;
    cLeft = 1; cRight = GCOLS;
    level = 0; score = 0; broke = 0; remaining = 0;
    gameOver = 0; cdActive = 0;
}

function _resetAll(){
    grid      = _makeGrid();
    score     = 0; broke = 0; level = 0;
    nextLevel = 1; remaining = 0;
    cLeft     = 1; cRight = GCOLS;
    checkFall = 0; gameOver = 0;
    slideToggle = 0;
    cdActive  = 1; cdMsLeft = 3000; cdShown = 3;
}

function _startNextLevel(){
    level++;
    const colors = Math.min(level + 2, 7);
    remaining = GCOLS * GROWS;
    cLeft = 1; cRight = GCOLS;
    for(let y = 1; y <= GROWS; y++)
        for(let x = 1; x <= GCOLS; x++)
            grid[x][y] = Math.floor(Math.random() * colors) + 1;
    nextLevel = 0;
}

// =============================================================================
// GAME LOGIC
// =============================================================================
function _checkAdjacent(x, y){
    const gem = grid[x][y];
    if(!gem) return false;
    if(x > 1     && grid[x-1][y] === gem) return true;
    if(y > 1     && grid[x][y-1] === gem) return true;
    if(x < GCOLS && grid[x+1][y] === gem) return true;
    if(y < GROWS && grid[x][y+1] === gem) return true;
    return false;
}

function _floodFill(x0, y0, gem){
    const stack = [[x0, y0]];
    while(stack.length){
        const [x, y] = stack.pop();
        if(x < 1 || x > GCOLS || y < 1 || y > GROWS) continue;
        if(grid[x][y] !== gem) continue;
        grid[x][y] = 0;
        broke++;
        remaining--;
        stack.push([x+1,y], [x-1,y], [x,y+1], [x,y-1]);
    }
}

function _doAction(){
    if(!_checkAdjacent(cursorX, cursorY)) return;
    const before = broke;
    _floodFill(cursorX, cursorY, grid[cursorX][cursorY]);
    score += (broke - before) ** 2;
    checkFall = 1;
}

function _doFallAndSlide(){
    if(!checkFall) return;

    let fell = false, slid = false;

    for(let x = cLeft; x <= cRight; x++){
        for(let y = GROWS; y >= 2; y--){
            if(grid[x][y] === 0 && grid[x][y-1] > 0){
                grid[x][y]   = grid[x][y-1];
                grid[x][y-1] = 0;
                fell = true;
            }
        }
    }

    if(!fell){
        for(let x = cLeft; x <= cRight; x++){
            if(grid[x][GROWS] === 0){
                slid = true;
                slideToggle ^= 1;
                if(slideToggle){
                    for(let n = x; n >= cLeft + 1; n--)
                        for(let y = 1; y <= GROWS; y++)
                            [grid[n][y], grid[n-1][y]] = [grid[n-1][y], grid[n][y]];
                    cLeft++;
                } else {
                    for(let n = x; n <= cRight - 1; n++)
                        for(let y = 1; y <= GROWS; y++)
                            [grid[n][y], grid[n+1][y]] = [grid[n+1][y], grid[n][y]];
                    cRight--;
                }
                break;
            }
        }

        if(!slid){
            let hasMoves = false;
            outer: for(let x = cLeft; x <= cRight; x++)
                for(let y = 1; y <= GROWS; y++)
                    if(_checkAdjacent(x, y)){ hasMoves = true; break outer; }

            if(!hasMoves){
                if(remaining === 0) score += 2500;
                nextLevel = 1;
                if(level > 0 && remaining > (10 + level - 1)){
                    gameOver = 1;
                    cdActive = 0;
                    if(score > pb){ pb = score; SHELL_setPB(PB_KEY, pb); }
                } else {
                    cdActive = 1; cdMsLeft = 3000; cdShown = 3;
                }
            }
        }
    }

    if(!fell && !slid) checkFall = 0;
}

function _updateStep(dt){
    if(gameOver) return;

    if(cdActive){
        cdMsLeft -= dt;
        if(cdMsLeft <= 0){
            cdActive = 0; cdMsLeft = 0; cdShown = 0;
            if(nextLevel && !gameOver) _startNextLevel();
        } else {
            cdShown = Math.ceil(cdMsLeft / 1000);
        }
        return;
    }

    if(nextLevel){ cdActive = 1; cdMsLeft = 3000; cdShown = 3; return; }

    _doFallAndSlide();
}

// =============================================================================
// MOUSE
// =============================================================================
function _screenToGrid(mx, my){
    if(mx < BX || mx >= BX + BW || my < BY || my >= BY + BH) return null;
    const gx = 1 + Math.floor((mx - BX) / CELLPX);
    const gy = 1 + Math.floor((my - BY) / CELLPX);
    if(gx < 1 || gx > GCOLS || gy < 1 || gy > GROWS) return null;
    return { gx, gy };
}

function _onMouseDown(e){
    if(shellPhase === "idle") return;
    if(cdActive || gameOver) return;
    const rc = _cv.getBoundingClientRect();
    mouseDownCell = _screenToGrid(e.clientX - rc.left, e.clientY - rc.top) || null;
}

function _onMouseUp(e){
    if(!mouseDownCell) return;
    const rc   = _cv.getBoundingClientRect();
    const cell = _screenToGrid(e.clientX - rc.left, e.clientY - rc.top);
    if(cell && cell.gx === mouseDownCell.gx && cell.gy === mouseDownCell.gy){
        cursorX = cell.gx; cursorY = cell.gy;
        _doAction();
    }
    mouseDownCell = null;
}

// =============================================================================
// DRAWING
// =============================================================================
function _uf(sz){ return `${sz}px Consolas,"Lucida Console","Courier New",monospace`; }

function _drawBoard(){
    _cx.save();
    _cx.beginPath();
    _cx.rect(SHELL_PFX, SHELL_PFY, SHELL_PFW, SHELL_PFH);
    _cx.clip();
    _cx.fillRect(BX, BY, BW, BH);
    for(let y = 1; y <= GROWS; y++){
        for(let x = 1; x <= GCOLS; x++){
            const v = grid[x][y];
            if(!v) continue;
            const px = BX + (x-1) * CELLPX, py = BY + (y-1) * CELLPX;
            _cx.fillStyle = GEM_COL[v] || CLR_OVERLAY_TXT;
            _cx.fillRect(px + 1, py + 1, CELLPX - 2, CELLPX - 2);
        }
    }
    _cx.restore();
}

function _drawSidebar(){
    _cx.fillStyle    = CLR_SIDEBAR_TXT;
    _cx.font         = _uf(14);
    _cx.textAlign    = "left";
    _cx.textBaseline = "alphabetic";
    _cx.fillText("LEVEL:  " + level,                          SHELL_BTN_X, SB_LEVEL_Y);
    _cx.fillText("SCORE:  " + String(score).padStart(5, "0"), SHELL_BTN_X, SB_SCORE_Y);
    _cx.fillText("BLOCKS: " + String(broke).padStart(3, "0"), SHELL_BTN_X, SB_BROKE_Y);
    _cx.fillText("BEST:   " + String(pb).padStart(5, "0"),    SHELL_BTN_X, SB_BEST_Y);
}

function _drawCountdown(){
    if(!cdActive) return;
    _cx.textAlign = "center";
    _cx.fillStyle = CLR_OVERLAY_TXT;
    _cx.font      = _uf(18);
    _cx.fillText(level === 0 ? "GET READY" : "NEXT LEVEL", SHELL_PFX + SHELL_PFW / 2, SHELL_PFY + SHELL_PFH / 2 - 18);
    _cx.font      = _uf(40);
    _cx.fillText(String(cdShown), SHELL_PFX + SHELL_PFW / 2, SHELL_PFY + SHELL_PFH / 2 + 28);
    _cx.textAlign = "left";
}

function _drawGameOver(){
    if(!gameOver) return;
    _cx.globalAlpha = 0.50;
    _cx.fillStyle   = CLR_OVERLAY_BG;
    _cx.fillRect(SHELL_PFX, SHELL_PFY + 4, SHELL_PFW, SHELL_PFH - 8);
    _cx.globalAlpha = 1.0;
    _cx.textAlign   = "center";
    _cx.fillStyle   = CLR_GAMEOVER_TXT;
    _cx.font        = _uf(28);
    _cx.fillText("GAME OVER",          SHELL_PFX + SHELL_PFW / 2, SHELL_PFY + SHELL_PFH / 2 - 10);
    _cx.fillStyle   = CLR_OVERLAY_SUB;
    _cx.font        = _uf(12);
    _cx.fillText("Press RESET to try again", SHELL_PFX + SHELL_PFW / 2, SHELL_PFY + SHELL_PFH / 2 + 14);
    _cx.textAlign   = "left";
}

function _drawIdleOverlay(){
    _cx.globalAlpha = 0.5;
    _cx.fillStyle   = CLR_OVERLAY_BG;
    _cx.fillRect(SHELL_PFX, SHELL_PFY + 4, SHELL_PFW, SHELL_PFH - 8);
    _cx.globalAlpha = 1.0;
    _cx.textAlign   = "center";
    _cx.fillStyle   = CLR_OVERLAY_TXT;
    _cx.font        = _uf(22);
    _cx.fillText("ELIMINATE",                             SHELL_PFX + SHELL_PFW / 2, SHELL_PFY + SHELL_PFH / 2 - 20);
    _cx.font        = _uf(14);
    _cx.fillText("Click a connected group of 2+ gems",    SHELL_PFX + SHELL_PFW / 2, SHELL_PFY + SHELL_PFH / 2 + 4);
    _cx.fillText("Board shrinks — clear as much as you can", SHELL_PFX + SHELL_PFW / 2, SHELL_PFY + SHELL_PFH / 2 + 20);
    _cx.fillText("Score = removed\u00B2 per click",       SHELL_PFX + SHELL_PFW / 2, SHELL_PFY + SHELL_PFH / 2 + 36);
    _cx.textAlign   = "left";
}

function _draw(){
    _cx.fillStyle = CLR_BG;
    _cx.fillRect(0, 0, SHELL_CW, SHELL_CH);

    _cx.fillStyle = CLR_PF_BG;
    _cx.fillRect(SHELL_PFX, SHELL_PFY, SHELL_PFW, SHELL_PFH);

    _drawBoard();
    _drawSidebar();

    if(shellPhase === "idle"){ _drawIdleOverlay(); return; }

    _drawCountdown();
    _drawGameOver();
}