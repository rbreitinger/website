// =============================================================================
// sokoban.js  —  shell-compatible Sokoban
// Keyboard: Arrows push · Z undo · R retry level
// Mobile:   D-pad buttons · swipe to move · UNDO / RETRY buttons
// Shell RESET = "NEW GAME" (restart from level 1)
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
const SK_COL_PLAYER     = "#FFD24A";

// ── mobile d-pad layout ───────────────────────────────────────────────────────
// Sits between the stats block (ends ~y+102) and the shell buttons (y+214)
const SK_DB_W   = 36;   // d-pad button width
const SK_DB_H   = 22;   // d-pad button height
const SK_DB_GAP = 3;    // gap between d-pad buttons
// center the d-pad column within the sidebar
const SK_DPAD_CX = SHELL_SBX + Math.floor((SHELL_SBW - SK_DB_W) / 2);  // 462
const SK_DPAD_Y0 = SHELL_SBY + 108;                                      // 124

const SK_DBTN_UP    = { x: SK_DPAD_CX,                          y: SK_DPAD_Y0,                              w: SK_DB_W, h: SK_DB_H };
const SK_DBTN_LEFT  = { x: SK_DPAD_CX - SK_DB_W - SK_DB_GAP,   y: SK_DPAD_Y0 +   SK_DB_H + SK_DB_GAP,     w: SK_DB_W, h: SK_DB_H };
const SK_DBTN_RIGHT = { x: SK_DPAD_CX + SK_DB_W + SK_DB_GAP,   y: SK_DPAD_Y0 +   SK_DB_H + SK_DB_GAP,     w: SK_DB_W, h: SK_DB_H };
const SK_DBTN_DOWN  = { x: SK_DPAD_CX,                          y: SK_DPAD_Y0 + 2*(SK_DB_H + SK_DB_GAP),   w: SK_DB_W, h: SK_DB_H };

// UNDO + RETRY side by side below the d-pad
const SK_ACT_Y  = SK_DPAD_Y0 + 3 * (SK_DB_H + SK_DB_GAP) + 5;  // 204
const SK_ACT_W  = Math.floor((SHELL_SBW - SK_DB_GAP * 3) / 2);  // 75
const SK_DBTN_UNDO  = { x: SHELL_SBX + SK_DB_GAP,                  y: SK_ACT_Y, w: SK_ACT_W, h: SK_DB_H };
const SK_DBTN_RETRY = { x: SHELL_SBX + SK_ACT_W + SK_DB_GAP * 2,   y: SK_ACT_Y, w: SK_ACT_W, h: SK_DB_H };

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

    start(){
        if(_loading || _loadErr || _levels.length === 0) return;
        levelIdx = 0;
        _startLevel();
    },

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

    // d-pad + action buttons
    onClick(mx, my){
        if(shellState === SK_ST_IDLE) return;
        if(_skPtIn(mx, my, SK_DBTN_UP))    { _tryMove(-gridW);       return; }
        if(_skPtIn(mx, my, SK_DBTN_DOWN))  { _tryMove(+gridW);       return; }
        if(_skPtIn(mx, my, SK_DBTN_LEFT))  { _tryMove(-1);           return; }
        if(_skPtIn(mx, my, SK_DBTN_RIGHT)) { _tryMove(+1);           return; }
        if(_skPtIn(mx, my, SK_DBTN_UNDO))  { _undo();                return; }
        if(_skPtIn(mx, my, SK_DBTN_RETRY)) { _resetCurrentLevel();   return; }
    },

    // swipe also steers (bonus, same as d-pad)
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
    undoStack = [];
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

// Secret level jump — + / - keys (not shown in subtitle)
function _jumpLevel(dir){
    levelIdx = Math.max(0, Math.min(_levels.length - 1, levelIdx + dir));
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
    undoStack.push({ p: playerIdx, m: mArr.slice() });
    if(undoStack.length > 200) undoStack.shift();
}

function _undo(){
    if(!undoStack.length) return;
    const snap = undoStack.pop();
    playerIdx = snap.p;
    mArr      = snap.m;
    moves     = Math.max(0, moves - 1);
}

function _tryMove(off){
    if(cdActive || solved || allDone) return;

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
    if(e.key === '+'                 ){ e.preventDefault(); _jumpLevel(+1);       return; }
    if(e.key === '-'                 ){ e.preventDefault(); _jumpLevel(-1);       return; }
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

function _drawDpad(){
    const canMove = shellState === SK_ST_PLAYING && !cdActive && !solved && !allDone;
    _skDrawBtn(SK_DBTN_UP,    "\u25B2", canMove);
    _skDrawBtn(SK_DBTN_LEFT,  "\u25C4", canMove);
    _skDrawBtn(SK_DBTN_RIGHT, "\u25BA", canMove);
    _skDrawBtn(SK_DBTN_DOWN,  "\u25BC", canMove);
    _skDrawBtn(SK_DBTN_UNDO,  "UNDO",   canMove && undoStack.length > 0);
    _skDrawBtn(SK_DBTN_RETRY, "RETRY",  shellState === SK_ST_PLAYING);
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
    if(isPlayer){
        const r   = CELL/2 - pad - 1;
        const cx2 = px + CELL/2, cy2 = py + CELL/2;
        _cx.fillStyle = SK_COL_PLAYER;
        _cx.beginPath(); _cx.arc(cx2, cy2, r, 0, Math.PI*2); _cx.fill();
        _cx.fillStyle = "#000";
        _cx.beginPath(); _cx.arc(cx2, cy2, r*0.45, 0, Math.PI*2); _cx.fill();
    }
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
    _drawDpad();
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
    _cx.fillText("SOKOBAN", SHELL_PFX + SHELL_PFW/2, SHELL_PFY + SHELL_PFH/2 - 24);
    _cx.fillStyle = "#93a0b3"; _cx.font = _uf(12);
    _cx.fillText("Push boxes \u25A1 onto goals \u25A6",       SHELL_PFX + SHELL_PFW/2, SHELL_PFY + SHELL_PFH/2 - 2);
    _cx.fillText("Arrows \u00B7 Z undo \u00B7 R retry level", SHELL_PFX + SHELL_PFW/2, SHELL_PFY + SHELL_PFH/2 + 14);
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