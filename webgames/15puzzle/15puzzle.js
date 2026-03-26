// =============================================================================
// 15puzzle.js  —  phone shell version  (PHN_CW=360  PHN_CH=596)
// Exposes: const GAME = { title, subtitle, init, start, reset, update, draw, onClick }
// =============================================================================

// ---------- board geometry ----------
const PZ_COLS  = 4;
const PZ_ROWS  = 4;
const PZ_TILE  = 90;                     // PHN_CW / PZ_COLS — fills full canvas width
const PZ_BRD   = 3;                      // tile inset / border px

const PZ_HUD_H = 50;                     // HUD strip height (phone standard §15a)
const PZ_BW    = PZ_COLS * PZ_TILE;      // 360 — matches PHN_CW exactly
const PZ_BH    = PZ_ROWS * PZ_TILE;      // 360
const PZ_BX    = 0;
const PZ_BY    = PZ_HUD_H + Math.floor((PHN_CH - PZ_HUD_H - PZ_BH) / 2);  // 143

// ---------- tile palette (values 1-15 map to PAL[val & 15]) ----------
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
let _pzState      = PZ_ST_IDLE;
let _pzTiles      = new Array(16);
let _pzMoves      = 0;
let _pzSolved     = false;
let _pzNewBest    = false;
let _pzElapsedMs  = 0;
let _pzStartMs    = 0;
let _pzPb         = 0;
let _pzCdActive   = false;
let _pzCdMsLeft   = 0;
let _pzCdShown    = 0;
let _pzOverLockMs = 0;
let _pzCx;

// SOUND EFFECT
const PZ_SND_MOVE = new Audio("15puzzle/pz_move.ogg");

// =============================================================================
// GAME INTERFACE
// =============================================================================
const GAME = {
    title:    "15 Puzzle",
    subtitle: "Tap a tile adjacent to the gap to slide it",

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
        if(_pzSolved){ _pzOverLockMs += dt; return; }
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
        _pzElapsedMs = performance.now() - _pzStartMs;
    },

    draw(){ _pzDraw(); },

    onClick(mx, my){
        // PLAY AGAIN while solved
        if(_pzSolved){
            if(_pzOverLockMs < 1000) return;
            const btnX = Math.floor((PHN_CW - 200) / 2);
            const btnY = Math.floor(PHN_CH / 2) + 68;
            if(mx >= btnX && mx < btnX + 200 && my >= btnY && my < btnY + 52){
                _pzState = PZ_ST_PLAYING;
                _pzNewGame();
            }
            return;
        }
        if(_pzState === PZ_ST_IDLE || _pzCdActive) return;
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
    _pzMoves = 0; _pzSolved = false; _pzNewBest = false;
    _pzElapsedMs = 0; _pzOverLockMs = 0;
    _pzCdActive = true; _pzCdMsLeft = PZ_CD_MS;
    _pzCdShown  = Math.ceil(PZ_CD_MS / 1000);
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
    if(!SHELL_isMuted()){
        PZ_SND_MOVE.currentTime = 0;
        PZ_SND_MOVE.play().catch(() => {});
    }
    if(_pzIsSolved()){
        _pzSolved = true;
        _pzOverLockMs = 0;
        if(_pzPb === 0 || _pzElapsedMs < _pzPb){
            _pzPb      = _pzElapsedMs;
            _pzNewBest = true;
            SHELL_setPB("15p_time", _pzPb);
        }
    }
}

// =============================================================================
// DRAWING HELPERS
// =============================================================================
function _pzUf(sz){ return sz + "px Consolas,\"Lucida Console\",\"Courier New\",monospace"; }

// Blend a hex colour toward white by amt (0–1)
function _pzBrighten(hex, amt){
    let r = parseInt(hex.slice(1,3), 16);
    let g = parseInt(hex.slice(3,5), 16);
    let b = parseInt(hex.slice(5,7), 16);
    r = Math.min(255, Math.round(r + (255 - r) * amt));
    g = Math.min(255, Math.round(g + (255 - g) * amt));
    b = Math.min(255, Math.round(b + (255 - b) * amt));
    return "#" + r.toString(16).padStart(2,"0")
               + g.toString(16).padStart(2,"0")
               + b.toString(16).padStart(2,"0");
}

// Blend a hex colour toward black by amt (0–1)
function _pzDarken(hex, amt){
    let r = parseInt(hex.slice(1,3), 16);
    let g = parseInt(hex.slice(3,5), 16);
    let b = parseInt(hex.slice(5,7), 16);
    r = Math.max(0, Math.round(r * (1 - amt)));
    g = Math.max(0, Math.round(g * (1 - amt)));
    b = Math.max(0, Math.round(b * (1 - amt)));
    return "#" + r.toString(16).padStart(2,"0")
               + g.toString(16).padStart(2,"0")
               + b.toString(16).padStart(2,"0");
}

// Compat rounded-rect path (avoids ctx.roundRect which is ES2023)
function _pzRoundRect(cx, x, y, w, h, r){
    cx.beginPath();
    cx.moveTo(x + r, y);
    cx.lineTo(x + w - r, y);
    cx.arcTo(x + w, y,     x + w, y + r,     r);
    cx.lineTo(x + w, y + h - r);
    cx.arcTo(x + w, y + h, x + w - r, y + h, r);
    cx.lineTo(x + r, y + h);
    cx.arcTo(x,      y + h, x,       y + h - r, r);
    cx.lineTo(x, y + r);
    cx.arcTo(x,      y,     x + r,   y,         r);
    cx.closePath();
}

// =============================================================================
// DRAWING
// =============================================================================
function _pzDraw(){
    _pzCx.fillStyle = "#0d0d1a";
    _pzCx.fillRect(0, 0, PHN_CW, PHN_CH);

    _pzDrawHud();
    _pzDrawBoard();

    if(_pzCdActive) _pzDrawCountdown();
    if(_pzSolved)   _pzDrawSolved();
}

// ---------- HUD strip (§15a layout: MOVES left | BEST centre | TIME right) ----------
function _pzDrawHud(){
    const cx  = _pzCx;
    const lx  = 16;
    const mid = Math.floor(PHN_CW / 2);
    const rx  = PHN_CW - 16;

    cx.fillStyle = "#181830";
    cx.fillRect(0, 0, PHN_CW, PZ_HUD_H);
    cx.fillStyle = "#2a2a55";
    cx.fillRect(0, PZ_HUD_H, PHN_CW, 1);

    const secStr = (_pzElapsedMs / 1000).toFixed(1) + "s";
    const pbStr  = (_pzPb / 1000).toFixed(1) + "s";

    // labels
    cx.font         = "11px monospace";
    cx.textBaseline = "alphabetic";
    cx.fillStyle    = "#7777aa";
    cx.textAlign    = "left";    cx.fillText("MOVES", lx,  16);
    cx.textAlign    = "right";   cx.fillText("TIME",  rx,  16);
    if(_pzPb > 0){
        cx.textAlign = "center"; cx.fillText("BEST",  mid, 16);
    }

    // values
    cx.font      = "bold 22px monospace";
    cx.fillStyle = "#ffffff";
    cx.textAlign = "left";    cx.fillText(String(_pzMoves), lx,  38);
    cx.textAlign = "right";   cx.fillText(secStr,           rx,  38);
    if(_pzPb > 0){
        cx.textAlign = "center"; cx.fillText(pbStr,         mid, 38);
    }

    cx.textAlign = "left"; cx.textBaseline = "alphabetic";
}

// ---------- board + tiles ----------
function _pzDrawBoard(){
    const cx = _pzCx;

    // board background
    cx.fillStyle = "#111824";
    cx.fillRect(PZ_BX, PZ_BY, PZ_BW, PZ_BH);

    // subtle grid lines
    cx.globalAlpha = 0.42;
    cx.strokeStyle = "#0d0d1a";
    cx.lineWidth   = 1;
    for(let i = 0; i <= PZ_COLS; i++){
        const gx = PZ_BX + i * PZ_TILE;
        cx.beginPath(); cx.moveTo(gx, PZ_BY); cx.lineTo(gx, PZ_BY + PZ_BH); cx.stroke();
    }
    for(let i = 0; i <= PZ_ROWS; i++){
        const gy = PZ_BY + i * PZ_TILE;
        cx.beginPath(); cx.moveTo(PZ_BX, gy); cx.lineTo(PZ_BX + PZ_BW, gy); cx.stroke();
    }
    cx.globalAlpha = 1.0;

    // tiles
    for(let r = 0; r < PZ_ROWS; r++){
        for(let c = 0; c < PZ_COLS; c++){
            const idx = r * PZ_COLS + c;
            const val = _pzTiles[idx];
            const px  = PZ_BX + c * PZ_TILE;
            const py  = PZ_BY + r * PZ_TILE;
            const tx  = px + PZ_BRD;
            const ty  = py + PZ_BRD;
            const tw  = PZ_TILE - PZ_BRD * 2;
            const th  = PZ_TILE - PZ_BRD * 2;

            if(val === PZ_EMPTY){
                cx.fillStyle = "#111824";
                cx.fillRect(tx, ty, tw, th);
                continue;
            }

            // diagonal gradient: top-left bright → bottom-right dark
            const baseClr = PZ_PAL[val & 15];
            const grd     = cx.createLinearGradient(tx, ty, tx + tw, ty + th);
            grd.addColorStop(0, _pzBrighten(baseClr, 0.38));
            grd.addColorStop(1, _pzDarken(baseClr, 0.38));
            cx.fillStyle = grd;
            cx.fillRect(tx, ty, tw, th);

            // number — white with dark outline for contrast on all palette colours
            cx.font         = "bold 28px Consolas,monospace";
            cx.textAlign    = "center";
            cx.textBaseline = "middle";
            cx.lineWidth    = 3;
            cx.strokeStyle  = "rgba(0,0,0,0.55)";
            cx.strokeText(String(val), px + PZ_TILE / 2, py + PZ_TILE / 2);
            cx.fillStyle    = "#ffffff";
            cx.fillText(String(val),   px + PZ_TILE / 2, py + PZ_TILE / 2);
        }
    }
    cx.textAlign = "left"; cx.textBaseline = "alphabetic";
}

// ---------- countdown overlay (covers play area only, HUD stays visible) ----------
function _pzDrawCountdown(){
    const cx = _pzCx;
    cx.globalAlpha = 0.55;
    cx.fillStyle   = "#000000";
    cx.fillRect(0, PZ_HUD_H + 1, PHN_CW, PHN_CH - PZ_HUD_H - 1);
    cx.globalAlpha = 1.0;
    cx.textAlign    = "center";
    cx.textBaseline = "middle";
    cx.fillStyle    = "#ffffff";
    cx.font         = _pzUf(18);
    cx.fillText("GET READY", PHN_CW / 2, PHN_CH / 2 - 24);
    cx.font = _pzUf(52);
    cx.fillText(String(_pzCdShown), PHN_CW / 2, PHN_CH / 2 + 26);
    cx.textAlign = "left"; cx.textBaseline = "alphabetic";
}

// ---------- solved / game-over screen (§15c) ----------
function _pzDrawSolved(){
    const cx  = _pzCx;
    const mcy = Math.floor(PHN_CH / 2);

    // full-canvas dark overlay
    cx.globalAlpha = 0.88;
    cx.fillStyle   = "#080818";
    cx.fillRect(0, 0, PHN_CW, PHN_CH);
    cx.globalAlpha = 1.0;

    cx.textAlign    = "center";
    cx.textBaseline = "alphabetic";

    // headline
    cx.fillStyle = "#ffffff";
    cx.font      = "bold 34px sans-serif";
    cx.fillText("SOLVED!", PHN_CW / 2, mcy - 72);

    // sub-label
    cx.fillStyle = "#8888cc";
    cx.font      = "14px monospace";
    cx.fillText("FINAL TIME", PHN_CW / 2, mcy - 28);

    // elapsed time — main result
    const secStr = (_pzElapsedMs / 1000).toFixed(1) + "s";
    cx.fillStyle = "#f0d020";
    cx.font      = "bold 52px monospace";
    cx.fillText(secStr, PHN_CW / 2, mcy + 26);

    // PB line (hidden until first recorded game)
    if(_pzPb > 0){
        if(_pzNewBest){
            cx.fillStyle = "#60ff60";
            cx.font      = "bold 14px sans-serif";
            cx.fillText("NEW BEST! \u2b50", PHN_CW / 2, mcy + 50);
        } else {
            const pbStr = (_pzPb / 1000).toFixed(1) + "s";
            cx.fillStyle = "#6666aa";
            cx.font      = "12px monospace";
            cx.fillText("BEST: " + pbStr, PHN_CW / 2, mcy + 50);
        }
    }

    // PLAY AGAIN button (1 s lock after solve)
    const locked = _pzOverLockMs < 1000;
    const btnW   = 200, btnH = 52;
    const btnX   = Math.floor((PHN_CW - btnW) / 2);
    const btnY   = mcy + 68;

    _pzRoundRect(cx, btnX, btnY, btnW, btnH, 14);
    cx.fillStyle   = locked ? "#222222" : "#1a5a1a";
    cx.fill();
    cx.strokeStyle = locked ? "#555555" : "#50c050";
    cx.lineWidth   = 2;
    cx.stroke();

    cx.fillStyle    = "#ffffff";
    cx.font         = "bold 20px sans-serif";
    cx.textBaseline = "middle";
    cx.fillText(locked ? "WAIT..." : "PLAY AGAIN", PHN_CW / 2, btnY + btnH / 2);

    cx.textAlign = "left"; cx.textBaseline = "alphabetic";
}
