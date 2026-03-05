// =============================================================================
// 15puzzle.js  —  shell-compatible version
// Exposes: const GAME = { title, subtitle, init, start, reset, update, draw, onClick }
// =============================================================================

// ---------- board geometry ----------
const PZ_COLS = 4, PZ_ROWS = 4, PZ_TILE = 64;
const PZ_BW   = PZ_COLS * PZ_TILE;
const PZ_BH   = PZ_ROWS * PZ_TILE;
const PZ_BX   = SHELL_PFX + Math.floor((SHELL_PFW - PZ_BW) / 2);
const PZ_BY   = SHELL_PFY + Math.floor((SHELL_PFH - PZ_BH) / 2);

// ---------- tile palette (index 0 unused; values 1-15 map to PAL[val&15]) ----------
const PZ_PAL = [
    "#000000","#0000AA","#00AA00","#00AAAA",
    "#AA0000","#AA00AA","#AA5500","#AAAAAA",
    "#555555","#5555FF","#55FF55","#55FFFF",
    "#FF5555","#FF55FF","#FFFF55","#FFFFFF"
];

const PZ_EMPTY  = 16;
const PZ_CD_MS  = 3000;

const PZ_ST_IDLE    = 0;
const PZ_ST_PLAYING = 1;

// ---------- state ----------
let _pzState = PZ_ST_IDLE;
let _pzTiles = new Array(16);
let _pzMoves = 0, _pzSolved = false;
let _pzElapsedMs = 0, _pzStartMs = 0;
let _pzPb = 0;
let _pzCdActive = false, _pzCdMsLeft = 0, _pzCdShown = 0;
let _pzCx;

// SOUND EFFECT
const PZ_SND_MOVE = new Audio("15puzzle/pz_move.ogg");

// =============================================================================
// GAME INTERFACE
// =============================================================================
const GAME = {
    title:    "15 Puzzle",
    subtitle: "Tap or click a tile to slide it",

    init(canvas){
        _pzCx    = canvas.getContext("2d");
        _pzState = PZ_ST_IDLE;
        _pzPb    = SHELL_getPB("15p_time") || 0;
        // idle preview: show solved board
        for(let i = 0; i < 15; i++) _pzTiles[i] = i + 1;
        _pzTiles[15] = PZ_EMPTY;
        _pzMoves = 0; _pzSolved = false; _pzElapsedMs = 0;
    },

    start(){
        _pzState = PZ_ST_PLAYING;
        _pzNewGame();
    },

    reset(){
        _pzState = PZ_ST_PLAYING;
        _pzNewGame();
    },

    update(dt){
        if(_pzState === PZ_ST_IDLE) return;
        if(_pzCdActive){
            _pzCdMsLeft -= dt;
            if(_pzCdMsLeft <= 0){
                _pzCdActive = false; _pzCdMsLeft = 0; _pzCdShown = 0;
                _pzStartMs  = performance.now();
            } else {
                _pzCdShown = Math.ceil(_pzCdMsLeft / 1000);
            }
            return;
        }
        if(!_pzSolved) _pzElapsedMs = performance.now() - _pzStartMs;
    },

    draw(){ _pzDraw(); },

    // called by shell for canvas clicks/taps outside shell buttons
    onClick(mx, my){
        if(_pzState === PZ_ST_IDLE || _pzCdActive || _pzSolved) return;
        if(mx < PZ_BX || mx >= PZ_BX + PZ_BW ||
           my < PZ_BY || my >= PZ_BY + PZ_BH) return;
        const col = Math.floor((mx - PZ_BX) / PZ_TILE);
        const row = Math.floor((my - PZ_BY) / PZ_TILE);
        _pzTryMove(row * PZ_COLS + col);
    }
};

// =============================================================================
// LOGIC
// =============================================================================
function _pzNewGame(){
    _pzShuffle();
    _pzMoves = 0; _pzSolved = false; _pzElapsedMs = 0;
    _pzCdActive = true; _pzCdMsLeft = PZ_CD_MS; _pzCdShown = Math.ceil(PZ_CD_MS / 1000);
}

function _pzShuffle(){
    const vals = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
    for(let i = vals.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        [vals[i], vals[j]] = [vals[j], vals[i]];
    }
    for(let i = 0; i < 15; i++) _pzTiles[i] = vals[i];
    _pzTiles[15] = PZ_EMPTY;
    if(!_pzSolvable()) [_pzTiles[0], _pzTiles[1]] = [_pzTiles[1], _pzTiles[0]];
}

function _pzSolvable(){
    let inv = 0;
    const flat = _pzTiles.filter(v => v !== PZ_EMPTY);
    for(let i = 0; i < flat.length; i++)
        for(let j = i + 1; j < flat.length; j++)
            if(flat[i] > flat[j]) inv++;
    const emptyRow      = Math.floor(_pzTiles.indexOf(PZ_EMPTY) / PZ_COLS);
    const rowFromBottom = PZ_ROWS - emptyRow;
    return (rowFromBottom % 2 === 0) !== (inv % 2 === 0);
}

function _pzIsSolved(){
    for(let i = 0; i < 15; i++) if(_pzTiles[i] !== i + 1) return false;
    return _pzTiles[15] === PZ_EMPTY;
}

function _pzTryMove(idx){
    if(_pzTiles[idx] === PZ_EMPTY) return;
    const ei = _pzTiles.indexOf(PZ_EMPTY);
    const r1 = Math.floor(idx / PZ_COLS), c1 = idx % PZ_COLS;
    const r2 = Math.floor(ei  / PZ_COLS), c2 = ei  % PZ_COLS;
    if(Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return;
    [_pzTiles[ei], _pzTiles[idx]] = [_pzTiles[idx], _pzTiles[ei]];
    _pzMoves++;
    
    PZ_SND_MOVE.currentTime = 0;
    PZ_SND_MOVE.play();
    
    if(_pzIsSolved()){
        _pzSolved = true;
        if(_pzPb === 0 || _pzElapsedMs < _pzPb){
            _pzPb = _pzElapsedMs;
            SHELL_setPB("15p_time", _pzPb);
        }
    }
}

// =============================================================================
// DRAWING
// =============================================================================
function _pzUf(sz){ return sz + "px Consolas,\"Lucida Console\",\"Courier New\",monospace"; }

function _pzDraw(){
    _pzCx.fillStyle = CLR_BG;
    _pzCx.fillRect(0, 0, SHELL_CW, SHELL_CH);

    // board background
    _pzCx.fillStyle = "#111824";
    _pzCx.fillRect(PZ_BX, PZ_BY, PZ_BW, PZ_BH);

    // subtle grid
    _pzCx.globalAlpha = 0.42;
    _pzCx.strokeStyle = CLR_BG; _pzCx.lineWidth = 1;
    for(let i = 0; i <= PZ_COLS; i++){
        const px = PZ_BX + i * PZ_TILE;
        _pzCx.beginPath(); _pzCx.moveTo(px, PZ_BY); _pzCx.lineTo(px, PZ_BY + PZ_BH); _pzCx.stroke();
    }
    for(let i = 0; i <= PZ_ROWS; i++){
        const py = PZ_BY + i * PZ_TILE;
        _pzCx.beginPath(); _pzCx.moveTo(PZ_BX, py); _pzCx.lineTo(PZ_BX + PZ_BW, py); _pzCx.stroke();
    }
    _pzCx.globalAlpha = 1.0;

    // tiles
    _pzCx.save();
    _pzCx.beginPath(); _pzCx.rect(SHELL_PFX, SHELL_PFY, SHELL_PFW, SHELL_PFH); _pzCx.clip();
    for(let r = 0; r < PZ_ROWS; r++){
        for(let c = 0; c < PZ_COLS; c++){
            const idx = r * PZ_COLS + c;
            const val = _pzTiles[idx];
            const px  = PZ_BX + c * PZ_TILE;
            const py  = PZ_BY + r * PZ_TILE;
            if(val === PZ_EMPTY){
                _pzCx.fillStyle = "#111824";
                _pzCx.fillRect(px + 2, py + 2, PZ_TILE - 4, PZ_TILE - 4);
                continue;
            }
            _pzCx.fillStyle = PZ_PAL[val & 15];
            _pzCx.fillRect(px + 2, py + 2, PZ_TILE - 4, PZ_TILE - 4);
            _pzCx.fillStyle    = "#000";
            _pzCx.font         = "bold 22px Consolas,monospace";
            _pzCx.textAlign    = "center";
            _pzCx.textBaseline = "middle";
            _pzCx.fillText(String(val), px + PZ_TILE / 2, py + PZ_TILE / 2);
        }
    }
    _pzCx.textAlign = "left"; _pzCx.textBaseline = "alphabetic";
    _pzCx.restore();

    // sidebar
    const sec = (_pzElapsedMs / 1000).toFixed(1);
    _pzCx.fillStyle = "#000"; _pzCx.font = _pzUf(14);
    _pzCx.textAlign = "left"; _pzCx.textBaseline = "alphabetic";
    _pzCx.fillText("TIME:  " + sec + "s",                                  SHELL_BTN_X, SHELL_SBY + 18);
    _pzCx.fillText("MOVES: " + _pzMoves,                                   SHELL_BTN_X, SHELL_SBY + 36);
    _pzCx.fillText("BEST:  " + (_pzPb > 0 ? (_pzPb/1000).toFixed(1)+"s" : "--"), SHELL_BTN_X, SHELL_SBY + 72);

    if(_pzCdActive) _pzDrawCountdown();
    if(_pzSolved)   _pzDrawSolved();
}

function _pzDrawCountdown(){
    _pzCx.globalAlpha = 0.52; _pzCx.fillStyle = "#000";
    _pzCx.fillRect(SHELL_PFX, SHELL_PFY, SHELL_PFW, SHELL_PFH);
    _pzCx.globalAlpha = 1.0;
    _pzCx.textAlign = "center";
    _pzCx.fillStyle = "#fff"; _pzCx.font = _pzUf(18);
    _pzCx.fillText("GET READY", SHELL_PFX + SHELL_PFW / 2, SHELL_PFY + SHELL_PFH / 2 - 18);
    _pzCx.font = _pzUf(40);
    _pzCx.fillText(String(_pzCdShown), SHELL_PFX + SHELL_PFW / 2, SHELL_PFY + SHELL_PFH / 2 + 28);
    _pzCx.textAlign = "left";
}

function _pzDrawSolved(){
    _pzCx.globalAlpha = 0.52; _pzCx.fillStyle = "#000";
    _pzCx.fillRect(SHELL_PFX, SHELL_PFY, SHELL_PFW, SHELL_PFH);
    _pzCx.globalAlpha = 1.0;
    _pzCx.textAlign = "center";
    _pzCx.fillStyle = "#fff"; _pzCx.font = _pzUf(28);
    _pzCx.fillText("SOLVED", SHELL_PFX + SHELL_PFW / 2, SHELL_PFY + SHELL_PFH / 2 - 10);
    _pzCx.fillStyle = "#93a0b3"; _pzCx.font = _pzUf(12);
    _pzCx.fillText("Press RESET to play again", SHELL_PFX + SHELL_PFW / 2, SHELL_PFY + SHELL_PFH / 2 + 14);
    _pzCx.textAlign = "left";
}