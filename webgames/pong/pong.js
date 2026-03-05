// =============================================================================
// pong.js  —  shell-compatible version
// Arrow keys move paddle · Ball escapes top = game over
// =============================================================================

// ── grid / board ──────────────────────────────────────────────────────────────
const PN_COLS     = 40, PN_ROWS   = 30, PN_CELL  = 9;
const PN_BW       = PN_COLS * PN_CELL;                         // 360
const PN_BH       = PN_ROWS * PN_CELL;                         // 270
const PN_BX       = SHELL_PFX;                                 // 16
const PN_BY       = SHELL_PFY + Math.floor((SHELL_PFH - PN_BH) / 2);  // 25
const PN_WELL_PAD = 8;   // extra bg rect drawn around the board

// ── game rules ────────────────────────────────────────────────────────────────
const PN_PADDLE_LEN  = 6;
const PN_PADDLE_ROW  = 2;
const PN_PADDLE_MIN  = 1;   // paddleX > PN_PADDLE_MIN  to move left
const PN_PADDLE_MAX  = 35;  // paddleX < PN_PADDLE_MAX  to move right
const PN_MIN_X       = 2,  PN_MAX_X    = 39;
const PN_BOTTOM_Y    = PN_ROWS - 1;  // 29

// ── timing ────────────────────────────────────────────────────────────────────
const PN_STEP_MS = 42;
const PN_CD_MS   = 3000;

// ── score weights ─────────────────────────────────────────────────────────────
const PN_SCORE_TIME_DIV   = 100;
const PN_SCORE_BOUNCE_MUL = 10;

// ── colors ────────────────────────────────────────────────────────────────────
const PN_CLR_BOARD      = "#111824";
const PN_CLR_BORDER     = "#7a879c";
const PN_CLR_PADDLE_OUT = "#74065f";
const PN_CLR_PADDLE_IN  = "#a20b59";
const PN_CLR_BALL_OUT   = "#205493";
const PN_CLR_BALL_IN    = "#0071bc";

const PN_ST_IDLE    = 0;
const PN_ST_PLAYING = 1;

// ── state ─────────────────────────────────────────────────────────────────────
let _pnState = PN_ST_IDLE;
let _pnBallX, _pnBallY, _pnVelX, _pnVelY;
let _pnPaddleX;
let _pnAlive;
let _pnBounces, _pnElapsedMs, _pnScore, _pnStartMs;
let _pnPb   = 0;
let _pnKeyL = false, _pnKeyR = false;
let _pnCdActive, _pnCdMsLeft, _pnCdShown;
let _pnAcc  = 0;
let _pnCx;

// =============================================================================
// GAME INTERFACE
// =============================================================================
const GAME = {
    title:    "Pong",
    subtitle: "Arrows move paddle",

    init(canvas){
        _pnCx    = canvas.getContext("2d");
        _pnPb    = SHELL_getPB("pong_score") || 0;
        _pnState = PN_ST_IDLE;
        // idle preview values
        _pnBallX = 30; _pnBallY = 15; _pnPaddleX = 9;
        _pnAlive = true; _pnBounces = 0; _pnElapsedMs = 0; _pnScore = 0;
        window.addEventListener("keydown", _pnOnKeyDown);
        window.addEventListener("keyup",   _pnOnKeyUp);
    },

    start(){ _pnNewGame(); },
    reset(){ _pnNewGame(); },

    update(dt){
        if(_pnState === PN_ST_IDLE) return;
        _pnAcc += dt;
        while(_pnAcc >= PN_STEP_MS){ _pnAcc -= PN_STEP_MS; _pnTick(); }
    },

    draw(){ _pnDraw(); }
};

// =============================================================================
// LOGIC
// =============================================================================
function _pnNewGame(){
    _pnState     = PN_ST_PLAYING;
    _pnBallX     = 30; _pnBallY = 1; _pnVelX = 1; _pnVelY = 1;
    _pnPaddleX   = 9;  _pnAlive = true;
    _pnBounces   = 0;  _pnElapsedMs = 0; _pnScore = 0;
    _pnStartMs   = performance.now();
    _pnCdActive  = true; _pnCdMsLeft = PN_CD_MS; _pnCdShown = Math.ceil(PN_CD_MS / 1000);
    _pnAcc       = 0;
}

function _pnTick(){
    if(!_pnAlive) return;

    if(_pnCdActive){
        _pnCdMsLeft -= PN_STEP_MS;
        if(_pnCdMsLeft <= 0){
            _pnCdActive = false; _pnCdMsLeft = 0; _pnCdShown = 0;
            _pnStartMs  = performance.now();
        } else {
            _pnCdShown = Math.ceil(_pnCdMsLeft / 1000);
        }
        return;
    }

    _pnElapsedMs = performance.now() - _pnStartMs;
    _pnScore     = Math.floor(_pnElapsedMs / PN_SCORE_TIME_DIV) + _pnBounces * PN_SCORE_BOUNCE_MUL;

    if(_pnKeyL && _pnPaddleX > PN_PADDLE_MIN) _pnPaddleX--;
    if(_pnKeyR && _pnPaddleX < PN_PADDLE_MAX) _pnPaddleX++;

    _pnBallX += _pnVelX; _pnBallY += _pnVelY;

    if(_pnBallX < PN_MIN_X || _pnBallX > PN_MAX_X){
        _pnVelX = -_pnVelX; _pnBounces++;
        if(_pnBallX < PN_MIN_X) _pnBallX = PN_MIN_X;
        if(_pnBallX > PN_MAX_X) _pnBallX = PN_MAX_X;
    }
    if(_pnBallY >= PN_BOTTOM_Y){ _pnVelY = -1; _pnBounces++; _pnBallY = PN_BOTTOM_Y; }

    if(_pnBallY === PN_PADDLE_ROW &&
       _pnBallX >= _pnPaddleX && _pnBallX <= _pnPaddleX + PN_PADDLE_LEN){
        _pnVelY = 1; _pnBounces++;
    }

    if(_pnBallY < 1){
        _pnAlive = false;
        if(_pnScore > _pnPb){ _pnPb = _pnScore; SHELL_setPB("pong_score", _pnPb); }
    }
}

// =============================================================================
// INPUT
// =============================================================================
function _pnOnKeyDown(e){
    if(e.key === "ArrowLeft")  { e.preventDefault(); _pnKeyL = true;  }
    if(e.key === "ArrowRight") { e.preventDefault(); _pnKeyR = true;  }
}
function _pnOnKeyUp(e){
    if(e.key === "ArrowLeft")  _pnKeyL = false;
    if(e.key === "ArrowRight") _pnKeyR = false;
}

// =============================================================================
// DRAWING
// =============================================================================
function _pnUf(sz){ return sz + "px Consolas,\"Lucida Console\",\"Courier New\",monospace"; }

function _pnCell(cx, cy, outer, inner){
    const px = PN_BX + (cx - 1) * PN_CELL;
    const py = PN_BY + (cy - 1) * PN_CELL;
    _pnCx.fillStyle = outer; _pnCx.fillRect(px,     py,     PN_CELL,     PN_CELL);
    _pnCx.fillStyle = inner; _pnCx.fillRect(px + 2, py + 2, PN_CELL - 4, PN_CELL - 4);
}

function _pnDrawBoard(){
    _pnCx.fillStyle = CLR_BG;
    _pnCx.fillRect(PN_BX - PN_WELL_PAD, PN_BY - PN_WELL_PAD,
                   PN_BW + PN_WELL_PAD * 2, PN_BH + PN_WELL_PAD * 2);
    _pnCx.fillStyle   = PN_CLR_BOARD;
    _pnCx.fillRect(PN_BX, PN_BY, PN_BW, PN_BH);
    _pnCx.strokeStyle = PN_CLR_BORDER; _pnCx.lineWidth = 2;
    _pnCx.strokeRect(PN_BX, PN_BY, PN_BW, PN_BH);
}

function _pnDrawPaddle(){
    for(let i = 0; i < PN_PADDLE_LEN; i++)
        _pnCell(_pnPaddleX + i, PN_PADDLE_ROW, PN_CLR_PADDLE_OUT, PN_CLR_PADDLE_IN);
}

function _pnDrawBall(){
    _pnCell(_pnBallX, _pnBallY, PN_CLR_BALL_OUT, PN_CLR_BALL_IN);
}

function _pnDrawSidebar(){
    _pnCx.fillStyle = "#000"; _pnCx.font = _pnUf(14);
    _pnCx.textAlign = "left"; _pnCx.textBaseline = "alphabetic";
    _pnCx.fillText("SCORE: " + _pnScore, SHELL_BTN_X, SHELL_SBY + 18);
    _pnCx.fillText("BEST:  " + _pnPb,   SHELL_BTN_X, SHELL_SBY + 54);
}

function _pnDrawIdleOverlay(){
    _pnCx.globalAlpha = 0.7; _pnCx.fillStyle = "#000";
    _pnCx.fillRect(PN_BX, PN_BY, PN_BW, PN_BH); _pnCx.globalAlpha = 1.0;
    _pnCx.textAlign = "center";
    _pnCx.fillStyle = "#ffd24a"; _pnCx.font = _pnUf(22);
    _pnCx.fillText("PONG", PN_BX + PN_BW / 2, PN_BY + PN_BH / 2 - 16);
    _pnCx.fillStyle = "#93a0b3"; _pnCx.font = _pnUf(12);
    _pnCx.fillText("Arrow keys move the paddle", PN_BX + PN_BW / 2, PN_BY + PN_BH / 2 + 6);
    _pnCx.fillText("Don't let the ball escape!", PN_BX + PN_BW / 2, PN_BY + PN_BH / 2 + 22);
    _pnCx.textAlign = "left";
}

function _pnDrawCountdown(){
    if(!_pnCdActive) return;
    _pnCx.globalAlpha = 0.7; _pnCx.fillStyle = "#000";
    _pnCx.fillRect(PN_BX, PN_BY, PN_BW, PN_BH); _pnCx.globalAlpha = 1.0;
    _pnCx.textAlign = "center";
    _pnCx.fillStyle = "#fff"; _pnCx.font = _pnUf(18);
    _pnCx.fillText("GET READY", PN_BX + PN_BW / 2, PN_BY + PN_BH / 2 - 18);
    _pnCx.font = _pnUf(40);
    _pnCx.fillText(String(_pnCdShown), PN_BX + PN_BW / 2, PN_BY + PN_BH / 2 + 28);
    _pnCx.textAlign = "left";
}

function _pnDrawGameOver(){
    if(_pnAlive) return;
    _pnCx.globalAlpha = 0.7; _pnCx.fillStyle = "#000";
    _pnCx.fillRect(PN_BX, PN_BY, PN_BW, PN_BH); _pnCx.globalAlpha = 1.0;
    _pnCx.textAlign = "center";
    _pnCx.fillStyle = "#fff"; _pnCx.font = _pnUf(24);
    _pnCx.fillText("GAME OVER", PN_BX + PN_BW / 2, PN_BY + PN_BH / 2 - 6);
    _pnCx.fillStyle = "#93a0b3"; _pnCx.font = _pnUf(12);
    _pnCx.fillText("Press RESET to try again", PN_BX + PN_BW / 2, PN_BY + PN_BH / 2 + 18);
    _pnCx.textAlign = "left";
}

function _pnDraw(){
    _pnCx.fillStyle = CLR_BG;
    _pnCx.fillRect(0, 0, SHELL_CW, SHELL_CH);

    _pnDrawBoard();
    _pnDrawPaddle();
    _pnDrawBall();

    if(_pnState === PN_ST_IDLE){
        _pnDrawIdleOverlay();
    } else {
        _pnDrawCountdown();
        _pnDrawGameOver();
    }

    _pnDrawSidebar();
}