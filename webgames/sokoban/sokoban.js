// =============================================================================
// sokoban.js  —  shell-compatible Sokoban
// Keyboard: Arrows push · Z undo · R retry level
// Mobile:   Swipe to move · PREV / NEXT / UNDO / RETRY sidebar buttons
// Shell START  = resume from personal-best level (NEW GAME restarts at level 1)
// Shell RESET  = "NEW GAME" (restart from level 1)
//
// Level file:  sokoban/sokoban.lev   (fetched at init)
//
// Map symbols (standard Sokoban):
//   ' ' = floor         '#' = wall
//   '.' = goal          '$' = box
//   '*' = box on goal   '+' = player on goal
//   '@'  = player on floor
//   '='  = exterior floor (treated as ' ')
//
// Internal mArr uses ' ' '#' '.' '$' '*' only.
// Player is tracked by playerIdx; mArr stores what is *under* the player.
// isSolved = no bare '.' remaining (every goal covered by a box).
// =============================================================================

// ── timing ────────────────────────────────────────────────────────────────────
const SK_TICK_MS     = 42;      // game's own tick rate  (shell calls update at 10 ms)
const SK_SOLVED_HOLD = 1200;    // ms to show SOLVED before next level loads
const SK_CD_MS       = 3000;    // countdown duration in ms

// ── playfield / sidebar colors ────────────────────────────────────────────────
const SK_COL_PF_BG      = "#0b0d10";
const SK_COL_SIDEBAR_FG = "#1c2333";
const SK_COL_PF_BORDER  = "#2a2f38";

// ── tile colors ───────────────────────────────────────────────────────────────
const SK_COL_WALL_FACE  = "#a20a10";
const SK_COL_WALL_HI    = "#ce2b37";
const SK_COL_WALL_SH    = "rgba(0,0,0,0.25)";
const SK_COL_FLOOR      = "#0e1218";
const SK_COL_GOAL       = "#55FFFF";
const SK_COL_CRATE_OUT  = "#AA5500";
const SK_COL_CRATE_IN   = "#FFAA44";
const SK_COL_PLACED_OUT = "#007733";
const SK_COL_PLACED_IN  = "#55FF88";
const SK_COL_PLAYER     = "#FFD24A";  // body fill
const SK_COL_PLAYER_SH  = "#c89010";  // shadow / dark accent on body

// ── sidebar action buttons ────────────────────────────────────────────────────
// Two rows of two buttons between the stats block and the shell buttons.
// Available canvas y-space:  SHELL_SBY+108  to  +208.
const SK_DB_GAP  = 4;
const SK_ACT_W   = Math.floor((SHELL_SBW - SK_DB_GAP * 3) / 2);   // 74 px
const SK_ACT_H   = 26;
const SK_ROW1_Y  = SHELL_SBY + 110;                               // 126 — PREV / NEXT
const SK_ROW2_Y  = SK_ROW1_Y + SK_ACT_H + 6;                      // 158 — UNDO / RETRY

const SK_DBTN_PREV  = { x: SHELL_SBX + SK_DB_GAP,               y: SK_ROW1_Y, w: SK_ACT_W, h: SK_ACT_H };
const SK_DBTN_NEXT  = { x: SHELL_SBX + SK_ACT_W + SK_DB_GAP*2,  y: SK_ROW1_Y, w: SK_ACT_W, h: SK_ACT_H };
const SK_DBTN_UNDO  = { x: SHELL_SBX + SK_DB_GAP,               y: SK_ROW2_Y, w: SK_ACT_W, h: SK_ACT_H };
const SK_DBTN_RETRY = { x: SHELL_SBX + SK_ACT_W + SK_DB_GAP*2,  y: SK_ROW2_Y, w: SK_ACT_W, h: SK_ACT_H };

// ── state ─────────────────────────────────────────────────────────────────────
const SK_ST_IDLE    = 0;
const SK_ST_PLAYING = 1;

let _levels  = [];       // parsed from file; each: { rows[], x, y }
let _loading = true;     // true while fetch is in flight
let _loadErr = "";       // non-empty if fetch failed

let mArr      = [];      // flat map  ' ' '#' '.' '$' '*'
let playerIdx = 0;       // flat player position
let gridW = 0, gridH = 0;

let CELL = 30, BX = 0, BY = 0;

let moves = 0, elapsedMs = 0, startMs = 0;
let levelIdx = 0, solved = false, allDone = false;
let pb = 0;
let solvedMs = 0;
let undoStack = [];
let cdActive = false, cdMsLeft = 0, cdShown = 0;

let _facingDir = "down";   // "up" | "down" | "left" | "right"

let shellState = SK_ST_IDLE;
let _acc = 0;
let _cx;

// =============================================================================
// GAME INTERFACE
// =============================================================================
const GAME = {
    title:      "Sokoban",
    subtitle:   "Arrows push \u00B7 Z undo \u00B7 R retry level",
    resetLabel: "NEW GAME",

    init(canvas){
        _cx        = canvas.getContext("2d");
        shellState = SK_ST_IDLE;
        pb         = SHELL_getPB("soko_level") || 0;
        window.addEventListener("keydown", _onKey);
        _fetchLevels();
    },

    // START: resume from personal-best level (or level 1 if no PB yet)
    start(){
        if(_loading || _loadErr || _levels.length === 0) return;
        levelIdx = Math.min(pb, _levels.length - 1);
        _startLevel();
    },

    // NEW GAME (shell RESET button): always restart from level 1
    reset(){
        if(_loading || _loadErr || _levels.length === 0) return;
        levelIdx = 0;
        _startLevel();
    },

    update(dt){
        if(shellState === SK_ST_IDLE) return;
        _acc += dt;
        while(_acc >= SK_TICK_MS){ _acc -= SK_TICK_MS; _tick(); }
    },

    draw(){ _draw(); },

    // sidebar action buttons
    onClick(mx, my){
        if(shellState === SK_ST_IDLE) return;
        if(_skPtIn(mx, my, SK_DBTN_PREV)){  if(levelIdx > 0)    _navLevel(-1); return; }
        if(_skPtIn(mx, my, SK_DBTN_NEXT)){  if(levelIdx < pb)   _navLevel(+1); return; }
        if(_skPtIn(mx, my, SK_DBTN_UNDO)){  _undo();                           return; }
        if(_skPtIn(mx, my, SK_DBTN_RETRY)){ _resetCurrentLevel();              return; }
    },

    // swipe steers the player
    onSwipe(dir){
        if(shellState === SK_ST_IDLE || cdActive || solved || allDone) return;
        if(dir === "up")    _tryMove(-gridW);
        if(dir === "down")  _tryMove(+gridW);
        if(dir === "left")  _tryMove(-1);
        if(dir === "right") _tryMove(+1);
    }
};

function _skPtIn(mx, my, btn){
    return mx >= btn.x && mx < btn.x + btn.w && my >= btn.y && my < btn.y + btn.h;
}

// =============================================================================
// LEVEL FILE LOADING
// =============================================================================
function _fetchLevels(){
    _loading = true;
    _loadErr  = "";

    fetch("sokoban/sokoban.lev")
        .then(r => {
            if(!r.ok) throw new Error("HTTP " + r.status);
            return r.text();
        })
        .then(txt => {
            _levels  = _parseLevels(txt);
            _loading = false;
            if(_levels.length === 0){
                _loadErr = "No levels found in sokoban.lev";
                return;
            }
            _loadLevel(0);   // idle preview
        })
        .catch(err => {
            _loading = false;
            _loadErr = "Could not load sokoban.lev (" + err.message + ")";
        });
}

// ── file parser ───────────────────────────────────────────────────────────────
function _parseLevels(text){
    const lines  = text.split('\n').map(l => l.replace(/\r$/, ''));
    const result = [];
    let   rows   = [];

    const flush = () => {
        while(rows.length && rows[0].trim()             === '') rows.shift();
        while(rows.length && rows[rows.length-1].trim() === '') rows.pop();
        if(rows.length > 0) result.push(_buildLevel(rows));
        rows = [];
    };

    for(const line of lines){
        if(line.startsWith('Title:') || line.startsWith(';')){
            flush();
        } else {
            rows.push(line);
        }
    }
    flush();
    return result;
}

function _buildLevel(rows){
    const h = rows.length;
    const w = Math.max(...rows.map(r => r.length));
    return { rows: rows.map(r => r.padEnd(w, ' ')), x: w, y: h };
}

// =============================================================================
// LEVEL LOADING
// =============================================================================
function _computeLayout(){
    const lv = _levels[levelIdx];
    CELL = Math.min(
        Math.floor((SHELL_PFW - 16) / lv.x),
        Math.floor((SHELL_PFH - 16) / lv.y),
        32
    );
    BX = SHELL_PFX + Math.floor((SHELL_PFW - lv.x * CELL) / 2);
    BY = SHELL_PFY + Math.floor((SHELL_PFH - lv.y * CELL) / 2);
}

function _loadLevel(idx){
    const lv = _levels[idx];
    gridW = lv.x;
    gridH = lv.y;
    mArr      = [];
    playerIdx = 0;

    for(let y = 0; y < lv.y; y++){
        for(let x = 0; x < lv.x; x++){
            const ch = (lv.rows[y][x] || ' ').replace('=', ' ');
            if(ch === '@'){
                playerIdx = y * lv.x + x;
                mArr.push(' ');
            } else if(ch === '+'){
                playerIdx = y * lv.x + x;
                mArr.push('.');
            } else {
                mArr.push(ch);
            }
        }
    }
    moves = 0; elapsedMs = 0; solved = false;
    undoStack  = [];
    _facingDir = "down";
    _computeLayout();
}

function _startLevel(){
    shellState = SK_ST_PLAYING;
    _loadLevel(levelIdx);
    cdActive = true; cdMsLeft = SK_CD_MS; cdShown = Math.ceil(SK_CD_MS / 1000);
    solvedMs = 0; allDone = false;
    _acc = 0;
}

function _resetCurrentLevel(){
    _loadLevel(levelIdx);
    cdActive = true; cdMsLeft = SK_CD_MS; cdShown = Math.ceil(SK_CD_MS / 1000);
    solvedMs = 0;
}

// Navigate to an adjacent level — NEXT is capped at pb (last beaten level index)
function _navLevel(dir){
    const target = levelIdx + dir;
    if(target < 0 || target >= _levels.length) return;
    if(dir > 0 && target > pb) return;    // can't skip ahead of earned progress
    levelIdx = target;
    _loadLevel(levelIdx);
    cdActive = true; cdMsLeft = SK_CD_MS; cdShown = Math.ceil(SK_CD_MS / 1000);
    solvedMs = 0; solved = false; allDone = false;
    _acc = 0;
}

// =============================================================================
// LOGIC
// =============================================================================
function _isSolved(){
    return !mArr.includes('.');
}

function _saveUndo(){
    undoStack.push({ p: playerIdx, m: mArr.slice(), d: _facingDir });
    if(undoStack.length > 200) undoStack.shift();
}

function _undo(){
    if(!undoStack.length) return;
    const snap = undoStack.pop();
    playerIdx  = snap.p;
    mArr       = snap.m;
    _facingDir = snap.d;
    moves      = Math.max(0, moves - 1);
}

function _tryMove(off){
    if(cdActive || solved || allDone) return;

    // update facing direction from the attempted offset
    if     (off === -1)    _facingDir = "left";
    else if(off ===  1)    _facingDir = "right";
    else if(off < 0)       _facingDir = "up";
    else                   _facingDir = "down";

    const n = playerIdx + off;
    if(n < 0 || n >= mArr.length) return;

    // prevent wrap-around on horizontal moves
    if(off === 1 || off === -1){
        if(Math.floor(playerIdx / gridW) !== Math.floor(n / gridW)) return;
    }

    const cn = mArr[n];

    // move into floor or bare goal
    if(cn === ' ' || cn === '.'){
        _saveUndo();
        playerIdx = n;
        moves++;
        return;
    }

    // push a box ('$') or box-on-goal ('*')
    if(cn === '$' || cn === '*'){
        const b = n + off;
        if(b < 0 || b >= mArr.length) return;
        if(off === 1 || off === -1){
            if(Math.floor(n / gridW) !== Math.floor(b / gridW)) return;
        }
        const cb = mArr[b];
        if(cb === '#' || cb === '$' || cb === '*') return;

        _saveUndo();
        mArr[b] = (cb === '.') ? '*' : '$';
        mArr[n] = (cn === '*') ? '.' : ' ';
        playerIdx = n;
        moves++;
    }
}

function _tick(){
    if(allDone) return;

    if(solved){
        solvedMs += SK_TICK_MS;
        if(solvedMs >= SK_SOLVED_HOLD){
            levelIdx++;
            if(levelIdx >= _levels.length){
                allDone = true;
                solved  = false;
            } else {
                _loadLevel(levelIdx);
                cdActive = true; cdMsLeft = SK_CD_MS; cdShown = Math.ceil(SK_CD_MS / 1000);
                solvedMs = 0; solved = false;
            }
        }
        return;
    }

    if(cdActive){
        cdMsLeft -= SK_TICK_MS;
        if(cdMsLeft <= 0){
            cdActive = false; cdMsLeft = 0; cdShown = 0;
            startMs  = performance.now();
        } else {
            cdShown = Math.ceil(cdMsLeft / 1000);
        }
        return;
    }

    elapsedMs = performance.now() - startMs;

    if(_isSolved()){
        solved   = true;
        solvedMs = 0;
        const completedLevel = levelIdx + 1;
        if(completedLevel > pb){
            pb = completedLevel;
            SHELL_setPB("soko_level", pb);
        }
    }
}

// =============================================================================
// INPUT
// =============================================================================
function _onKey(e){
    if(shellState === SK_ST_IDLE) return;
    if(e.key === 'z' || e.key === 'Z'){ e.preventDefault(); _undo();              return; }
    if(e.key === 'r' || e.key === 'R'){ e.preventDefault(); _resetCurrentLevel(); return; }
    if(e.key === 'ArrowLeft' ){ e.preventDefault(); _tryMove(-1);     return; }
    if(e.key === 'ArrowRight'){ e.preventDefault(); _tryMove(+1);     return; }
    if(e.key === 'ArrowUp'   ){ e.preventDefault(); _tryMove(-gridW); return; }
    if(e.key === 'ArrowDown' ){ e.preventDefault(); _tryMove(+gridW); return; }
}

// =============================================================================
// DRAWING
// =============================================================================
function _uf(sz){ return sz + "px Consolas,\"Lucida Console\",\"Courier New\",monospace"; }

function _skDrawBtn(btn, label, active){
    _cx.fillStyle    = active ? CLR_BTN_ACTIVE : CLR_BTN_IDLE;
    _cx.fillRect(btn.x, btn.y, btn.w, btn.h);
    _cx.strokeStyle  = active ? CLR_BTN_BORDER_ACTIVE : CLR_BTN_BORDER_IDLE;
    _cx.lineWidth    = 1;
    _cx.strokeRect(btn.x, btn.y, btn.w, btn.h);
    _cx.fillStyle    = active ? CLR_BTN_TEXT_ACTIVE : CLR_BTN_TEXT_IDLE;
    _cx.font         = "12px Consolas,'Lucida Console',monospace";
    _cx.textAlign    = "center";
    _cx.textBaseline = "middle";
    _cx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2);
    _cx.textAlign    = "left";
    _cx.textBaseline = "alphabetic";
}

function _drawSidebarBtns(){
    const playing = shellState === SK_ST_PLAYING;
    const canMove = playing && !cdActive && !solved && !allDone;
    _skDrawBtn(SK_DBTN_PREV,  "\u25C4 PREV", playing && levelIdx > 0);
    _skDrawBtn(SK_DBTN_NEXT,  "NEXT \u25BA", playing && levelIdx < pb);
    _skDrawBtn(SK_DBTN_UNDO,  "UNDO",        canMove && undoStack.length > 0);
    _skDrawBtn(SK_DBTN_RETRY, "RETRY",       playing);
}

// ── player sprite ─────────────────────────────────────────────────────────────
// Top-down view: round body, two eyes and a nose-dot pointing in _facingDir.
// Everything is relative to CELL so it scales cleanly from ~10 px to 32 px.
// At very small radii (r < 3) only the body circle is drawn.
function _drawPlayer(px, py){
    const cx  = px + CELL / 2;
    const cy  = py + CELL / 2;
    const pad = Math.max(2, Math.floor(CELL * 0.08));
    const r   = CELL / 2 - pad - 1;   // body radius

    // unit vector pointing in the facing direction
    const fdx = _facingDir === "left" ? -1 : _facingDir === "right" ? 1 : 0;
    const fdy = _facingDir === "up"   ? -1 : _facingDir === "down"  ? 1 : 0;

    // perpendicular axis (for eye spread left/right of facing direction)
    const pdx = -fdy;
    const pdy =  fdx;

    // drop shadow
    _cx.fillStyle = "rgba(0,0,0,0.30)";
    _cx.beginPath(); _cx.arc(cx + 1, cy + 1, r, 0, Math.PI * 2); _cx.fill();

    // body
    _cx.fillStyle = SK_COL_PLAYER;
    _cx.beginPath(); _cx.arc(cx, cy, r, 0, Math.PI * 2); _cx.fill();

    if(r < 3) return;   // too small for face detail

    // face centre is shifted slightly toward the facing direction
    const fcx = cx + fdx * r * 0.22;
    const fcy = cy + fdy * r * 0.22;

    // nose: darker filled circle at the leading edge
    const noseR = Math.max(1, Math.round(r * 0.20));
    _cx.fillStyle = SK_COL_PLAYER_SH;
    _cx.beginPath();
    _cx.arc(fcx + fdx * r * 0.52, fcy + fdy * r * 0.52, noseR, 0, Math.PI * 2);
    _cx.fill();

    // eyes: two dark dots spread along the perpendicular axis
    const eyeR      = Math.max(1, Math.round(r * 0.16));
    const eyeSpread = r * 0.32;
    _cx.fillStyle = "#1c1008";
    _cx.beginPath();
    _cx.arc(fcx + pdx * eyeSpread, fcy + pdy * eyeSpread, eyeR, 0, Math.PI * 2);
    _cx.fill();
    _cx.beginPath();
    _cx.arc(fcx - pdx * eyeSpread, fcy - pdy * eyeSpread, eyeR, 0, Math.PI * 2);
    _cx.fill();
}

function _drawTile(tx, ty, ch, isPlayer){
    const px  = BX + tx * CELL;
    const py  = BY + ty * CELL;
    const pad = Math.max(2, Math.floor(CELL * 0.08));
    const inn = Math.max(2, Math.floor(CELL * 0.18));

    _cx.fillStyle = SK_COL_FLOOR;
    _cx.fillRect(px, py, CELL, CELL);

    if(ch === '#'){
        _cx.fillStyle = SK_COL_WALL_FACE;
        _cx.fillRect(px, py, CELL, CELL);
        _cx.fillStyle = SK_COL_WALL_HI;
        _cx.fillRect(px, py, CELL, 2);
        _cx.fillRect(px, py, 2, CELL);
        _cx.fillStyle = SK_COL_WALL_SH;
        _cx.fillRect(px, py+2, CELL, CELL-2);
        _cx.fillRect(px+2, py, CELL-2, CELL);
        return;
    }
    if(ch === '.'){
        _cx.strokeStyle = SK_COL_GOAL;
        _cx.lineWidth   = Math.max(1, Math.floor(CELL/8));
        const m = Math.floor(CELL / 4);
        _cx.strokeRect(px+m, py+m, CELL-2*m, CELL-2*m);
    }
    if(ch === '$' || ch === '*'){
        const oc = ch === '*' ? SK_COL_PLACED_OUT : SK_COL_CRATE_OUT;
        const ic = ch === '*' ? SK_COL_PLACED_IN  : SK_COL_CRATE_IN;
        _cx.fillStyle = oc;
        _cx.fillRect(px+pad, py+pad, CELL-2*pad, CELL-2*pad);
        _cx.fillStyle = ic;
        _cx.fillRect(px+inn, py+inn, CELL-2*inn, CELL-2*inn);
        _cx.strokeStyle = oc;
        _cx.lineWidth   = Math.max(1, Math.floor(CELL/12));
        const cx2 = px + CELL/2, cy2 = py + CELL/2, hr = CELL/4 - 2;
        _cx.beginPath();
        _cx.moveTo(cx2-hr, cy2); _cx.lineTo(cx2+hr, cy2);
        _cx.moveTo(cx2, cy2-hr); _cx.lineTo(cx2, cy2+hr);
        _cx.stroke();
    }
    if(isPlayer) _drawPlayer(px, py);
}

function _drawBoard(){
    _cx.save();
    _cx.beginPath(); _cx.rect(SHELL_PFX, SHELL_PFY, SHELL_PFW, SHELL_PFH); _cx.clip();

    const playerRow = Math.floor(playerIdx / gridW);
    const playerCol = playerIdx % gridW;

    for(let y = 0; y < gridH; y++){
        for(let x = 0; x < gridW; x++){
            _drawTile(x, y, mArr[y*gridW+x], x === playerCol && y === playerRow);
        }
    }
    _cx.restore();
}

function _drawSidebar(){
    const sx = SHELL_BTN_X, sy = SHELL_SBY;
    _cx.fillStyle    = SK_COL_SIDEBAR_FG;
    _cx.font         = _uf(14);
    _cx.textAlign    = "left";
    _cx.textBaseline = "alphabetic";
    _cx.fillText("LEVEL: " + (levelIdx+1) + "/" + _levels.length, sx, sy+18);
    _cx.fillText("TIME:  " + (elapsedMs/1000).toFixed(1) + "s",    sx, sy+36);
    _cx.fillText("MOVES: " + moves,                                 sx, sy+54);
    _cx.fillText("BEST:  LV" + (pb || "--"),                        sx, sy+86);
    _drawSidebarBtns();
}

function _drawCountdown(){
    if(!cdActive) return;
    _cx.globalAlpha = 0.6; _cx.fillStyle = "#000";
    _cx.fillRect(SHELL_PFX, SHELL_PFY, SHELL_PFW, SHELL_PFH);
    _cx.globalAlpha = 1.0;
    _cx.textAlign = "center";
    _cx.fillStyle = "#fff"; _cx.font = _uf(18);
    _cx.fillText(
        levelIdx === 0 ? "GET READY" : "LEVEL " + (levelIdx+1),
        SHELL_PFX + SHELL_PFW/2, SHELL_PFY + SHELL_PFH/2 - 18
    );
    _cx.font = _uf(40);
    _cx.fillText(String(cdShown), SHELL_PFX + SHELL_PFW/2, SHELL_PFY + SHELL_PFH/2 + 28);
    _cx.textAlign = "left";
}

function _drawSolved(){
    if(!solved && !allDone) return;
    _cx.globalAlpha = 0.6; _cx.fillStyle = "#000";
    _cx.fillRect(SHELL_PFX, SHELL_PFY, SHELL_PFW, SHELL_PFH);
    _cx.globalAlpha = 1.0;
    _cx.textAlign = "center";
    _cx.fillStyle = allDone ? "#FFFF55" : "#55FF88";
    _cx.font = _uf(28);
    _cx.fillText(allDone ? "ALL CLEAR!" : "SOLVED!", SHELL_PFX + SHELL_PFW/2, SHELL_PFY + SHELL_PFH/2 - 6);
    _cx.fillStyle = "#93a0b3"; _cx.font = _uf(12);
    _cx.fillText(
        allDone ? "Press NEW GAME to play again" : "Next level loading...",
        SHELL_PFX + SHELL_PFW/2, SHELL_PFY + SHELL_PFH/2 + 16
    );
    _cx.textAlign = "left";
}

function _drawIdleOverlay(){
    _cx.globalAlpha = 0.6; _cx.fillStyle = "#000";
    _cx.fillRect(SHELL_PFX, SHELL_PFY, SHELL_PFW, SHELL_PFH);
    _cx.globalAlpha = 1.0;
    _cx.textAlign = "center";
    _cx.fillStyle = "#fff"; _cx.font = _uf(22);
    _cx.fillText("SOKOBAN", SHELL_PFX + SHELL_PFW/2, SHELL_PFY + SHELL_PFH/2 - 30);
    _cx.fillStyle = "#93a0b3"; _cx.font = _uf(12);
    _cx.fillText("Push boxes \u25A1 onto goals \u25A6",        SHELL_PFX + SHELL_PFW/2, SHELL_PFY + SHELL_PFH/2 - 8);
    _cx.fillText("Arrows \u00B7 Z undo \u00B7 R retry level",  SHELL_PFX + SHELL_PFW/2, SHELL_PFY + SHELL_PFH/2 + 8);
    if(pb > 0){
        _cx.fillStyle = "#55FF88"; _cx.font = _uf(11);
        _cx.fillText(
            "START resumes at level " + (pb + 1),
            SHELL_PFX + SHELL_PFW/2, SHELL_PFY + SHELL_PFH/2 + 26
        );
    }
    _cx.textAlign = "left";
}

function _draw(){
    _cx.fillStyle = CLR_BG;
    _cx.fillRect(0, 0, SHELL_CW, SHELL_CH);

    if(_loading || _loadErr){
        _cx.fillStyle = SK_COL_PF_BG;
        _cx.fillRect(SHELL_PFX, SHELL_PFY, SHELL_PFW, SHELL_PFH);
        _cx.textAlign    = "center";
        _cx.textBaseline = "middle";
        _cx.fillStyle = _loadErr ? "#FF5555" : "#93a0b3";
        _cx.font      = _uf(14);
        _cx.fillText(
            _loadErr || "Loading levels...",
            SHELL_PFX + SHELL_PFW/2, SHELL_PFY + SHELL_PFH/2
        );
        _cx.textAlign    = "left";
        _cx.textBaseline = "alphabetic";
        return;
    }

    _cx.fillStyle   = SK_COL_PF_BG;
    _cx.fillRect(SHELL_PFX, SHELL_PFY, SHELL_PFW, SHELL_PFH);
    _cx.strokeStyle = SK_COL_PF_BORDER; _cx.lineWidth = 2;
    _cx.strokeRect(SHELL_PFX, SHELL_PFY, SHELL_PFW, SHELL_PFH);

    _drawBoard();
    _drawSidebar();

    if(shellState === SK_ST_IDLE){ _drawIdleOverlay(); return; }
    _drawCountdown();
    _drawSolved();
}
