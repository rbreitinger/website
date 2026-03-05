// =============================================================================
// snake.js  —  shell-compatible version
// Keyboard: Arrows move · Space pause
// Mobile:   Swipe to steer · tap game area to pause
// =============================================================================

// ---------- grid / board ----------
const SN_CELL    = 10;
const SN_MIN_X   = 2,  SN_MIN_Y = 2;
const SN_MAX_X   = 37, SN_MAX_Y = 27;
const SN_COLS    = SN_MAX_X - SN_MIN_X + 1;  // 36
const SN_ROWS    = SN_MAX_Y - SN_MIN_Y + 1;  // 26
const SN_BW      = SN_COLS * SN_CELL;         // 360
const SN_BH      = SN_ROWS * SN_CELL;         // 260
const SN_BX      = SHELL_PFX;                 // 16
const SN_BY      = SHELL_PFY;                 // 16

// ---------- timing ----------
const SN_STEP_MS = 70;
const SN_CD_MS   = 3000;

// ---------- colors ----------
const SN_CLR_BG_OUTER  = "#0f380f";
const SN_CLR_BG_INNER  = "#9bbc0f";
const SN_CLR_GRID      = "#0f380f";
const SN_CLR_HEAD_OUT  = "#306230";
const SN_CLR_HEAD_IN   = "#8bac0f";
const SN_CLR_BODY_OUT  = "#0f380f";
const SN_CLR_BODY_IN   = "#306230";
const SN_CLR_FOOD_OUT  = "#8bac0f";
const SN_CLR_FOOD_IN   = "#306230";

// ---------- directions ----------
const SN_UP = 1, SN_RIGHT = 2, SN_DOWN = 3, SN_LEFT = 4;

const SN_ST_IDLE    = 0;
const SN_ST_PLAYING = 1;

// ---------- state ----------
let _snState = SN_ST_IDLE;
let _snHeadX, _snHeadY, _snDir, _snNextDir, _snLen;
let _snBodyX, _snBodyY;
let _snFoodX, _snFoodY;
let _snScore, _snPaused, _snAlive;
let _snPb    = 0;
let _snCdActive, _snCdMsLeft, _snCdShown;
let _snAcc   = 0;
let _snCx;

// =============================================================================
// GAME INTERFACE
// =============================================================================
const GAME = {
    title:    "Snake",
    subtitle: "Arrows move \u00B7 Space pause \u00B7 Swipe on mobile",

    init(canvas){
        _snCx    = canvas.getContext("2d");
        _snState = SN_ST_IDLE;
        _snPb    = SHELL_getPB("snake_score") || 0;
        _snIdleState();
        window.addEventListener("keydown", _snOnKey);
    },

    start(){ _snNewGame(); },
    reset(){ _snNewGame(); },

    update(dt){
        if(_snState === SN_ST_IDLE) return;
        _snAcc += dt;
        while(_snAcc >= SN_STEP_MS){ _snAcc -= SN_STEP_MS; _snTick(); }
    },

    draw(){ _snDraw(); },

    // tap on game area = toggle pause
    onClick(mx, my){
        if(_snState === SN_ST_IDLE || _snCdActive || !_snAlive) return;
        if(mx >= SN_BX && mx < SN_BX + SN_BW &&
           my >= SN_BY && my < SN_BY + SN_BH){
            _snPaused = !_snPaused;
        }
    },

    // swipe = steer
    onSwipe(dir){
        if(_snState === SN_ST_IDLE || _snCdActive || !_snAlive || _snPaused) return;
        if(dir === "up")    _snNextDir = SN_UP;
        if(dir === "right") _snNextDir = SN_RIGHT;
        if(dir === "down")  _snNextDir = SN_DOWN;
        if(dir === "left")  _snNextDir = SN_LEFT;
    }
};

// =============================================================================
// LOGIC
// =============================================================================
function _snIdleState(){
    _snHeadX = 20; _snHeadY = 14;
    _snDir   = SN_RIGHT; _snNextDir = SN_RIGHT; _snLen = 6;
    _snBodyX = [20, 20, 20, 20, 20];
    _snBodyY = [15, 16, 17, 18, 19];
    _snScore = 0; _snPaused = false; _snAlive = true;
    _snFoodX = 25; _snFoodY = 14;
    _snCdActive = false;
}

function _snNewGame(){
    _snState   = SN_ST_PLAYING;
    _snLen     = 3; _snScore = 0;
    _snHeadX   = 20; _snHeadY = 14;
    _snDir     = SN_RIGHT; _snNextDir = SN_RIGHT;
    _snBodyX   = [20, 20, 20];
    _snBodyY   = [15, 16, 17];
    _snPaused  = false; _snAlive = true;
    _snPlaceFood();
    _snCdActive = true; _snCdMsLeft = SN_CD_MS; _snCdShown = Math.ceil(SN_CD_MS / 1000);
    _snAcc = 0;
}

function _snInSnake(cx, cy){
    if(_snHeadX === cx && _snHeadY === cy) return true;
    for(let i = 0; i < _snLen; i++)
        if(_snBodyX[i] === cx && _snBodyY[i] === cy) return true;
    return false;
}

function _snPlaceFood(){
    for(let t = 0; t < 2000; t++){
        const fx = Math.floor(Math.random() * SN_COLS) + SN_MIN_X;
        const fy = Math.floor(Math.random() * SN_ROWS) + SN_MIN_Y;
        if(!_snInSnake(fx, fy)){ _snFoodX = fx; _snFoodY = fy; return; }
    }
    // fallback scan
    for(let y = SN_MIN_Y; y <= SN_MAX_Y; y++)
        for(let x = SN_MIN_X; x <= SN_MAX_X; x++)
            if(!_snInSnake(x, y)){ _snFoodX = x; _snFoodY = y; return; }
}

function _snSavePb(){
    if(_snScore > _snPb){ _snPb = _snScore; SHELL_setPB("snake_score", _snPb); }
}

function _snTick(){
    if(!_snAlive) return;

    if(_snCdActive){
        _snCdMsLeft -= SN_STEP_MS;
        if(_snCdMsLeft <= 0){ _snCdActive = false; _snCdMsLeft = 0; _snCdShown = 0; }
        else { _snCdShown = Math.ceil(_snCdMsLeft / 1000); }
        return;
    }

    if(_snPaused) return;

    // apply direction (no 180° reversal)
    if((_snDir === SN_UP   || _snDir === SN_DOWN)  &&
       (_snNextDir === SN_LEFT  || _snNextDir === SN_RIGHT)) _snDir = _snNextDir;
    if((_snDir === SN_LEFT || _snDir === SN_RIGHT) &&
       (_snNextDir === SN_UP    || _snNextDir === SN_DOWN))  _snDir = _snNextDir;

    const prevX = _snHeadX, prevY = _snHeadY;
    if(_snDir === SN_UP)         _snHeadY--;
    else if(_snDir === SN_RIGHT) _snHeadX++;
    else if(_snDir === SN_DOWN)  _snHeadY++;
    else                         _snHeadX--;

    if(_snHeadX < SN_MIN_X || _snHeadY < SN_MIN_Y ||
       _snHeadX > SN_MAX_X || _snHeadY > SN_MAX_Y){
        _snAlive = false; _snSavePb(); return;
    }

    // shift body, check self-collision
    for(let i = _snLen - 1; i >= 1; i--){
        _snBodyX[i] = _snBodyX[i - 1];
        _snBodyY[i] = _snBodyY[i - 1];
        if(_snHeadX === _snBodyX[i] && _snHeadY === _snBodyY[i]){
            _snAlive = false; _snSavePb(); return;
        }
    }
    _snBodyX[0] = prevX; _snBodyY[0] = prevY;

    if(_snHeadX === _snFoodX && _snHeadY === _snFoodY){
        _snScore += 9; _snLen++;
        _snBodyX[_snLen - 1] = _snBodyX[_snLen - 2];
        _snBodyY[_snLen - 1] = _snBodyY[_snLen - 2];
        _snPlaceFood();
    }
}

// =============================================================================
// INPUT
// =============================================================================
function _snOnKey(e){
    if(_snState === SN_ST_IDLE) return;
    if(e.key === " " && _snAlive && !_snCdActive){
        e.preventDefault(); _snPaused = !_snPaused; return;
    }
    if(e.key === "ArrowUp")    { e.preventDefault(); _snNextDir = SN_UP;    }
    else if(e.key === "ArrowRight"){ e.preventDefault(); _snNextDir = SN_RIGHT; }
    else if(e.key === "ArrowDown") { e.preventDefault(); _snNextDir = SN_DOWN;  }
    else if(e.key === "ArrowLeft") { e.preventDefault(); _snNextDir = SN_LEFT;  }
}

// =============================================================================
// DRAWING
// =============================================================================
function _snUf(sz){ return sz + "px Consolas,\"Lucida Console\",\"Courier New\",monospace"; }

function _snToPixX(cx){ return SN_BX + (cx - SN_MIN_X) * SN_CELL; }
function _snToPixY(cy){ return SN_BY + (cy - SN_MIN_Y) * SN_CELL; }

function _snCellRect(cx, cy, outer, inner){
    const px = _snToPixX(cx), py = _snToPixY(cy);
    _snCx.fillStyle = outer; _snCx.fillRect(px,     py,     SN_CELL,     SN_CELL);
    _snCx.fillStyle = inner; _snCx.fillRect(px + 2, py + 2, SN_CELL - 4, SN_CELL - 4);
}

function _snDrawBoard(){
    _snCx.fillStyle = CLR_BG;
    _snCx.fillRect(0, 0, SHELL_CW, SHELL_CH);
    _snCx.fillStyle = SN_CLR_BG_OUTER; _snCx.fillRect(SN_BX, SN_BY, SN_BW, SN_BH);
    _snCx.fillStyle = SN_CLR_BG_INNER; _snCx.fillRect(SN_BX + 1, SN_BY + 1, SN_BW - 2, SN_BH - 2);

    _snCx.globalAlpha = 0.18;
    _snCx.strokeStyle = SN_CLR_GRID; _snCx.lineWidth = 1;
    for(let x = 0; x <= SN_COLS; x++){
        const px = SN_BX + x * SN_CELL;
        _snCx.beginPath(); _snCx.moveTo(px, SN_BY); _snCx.lineTo(px, SN_BY + SN_BH); _snCx.stroke();
    }
    for(let y = 0; y <= SN_ROWS; y++){
        const py = SN_BY + y * SN_CELL;
        _snCx.beginPath(); _snCx.moveTo(SN_BX, py); _snCx.lineTo(SN_BX + SN_BW, py); _snCx.stroke();
    }
    _snCx.globalAlpha = 1.0;
}

function _snDrawSnakeAndFood(){
    if(!_snCdActive) _snCellRect(_snFoodX, _snFoodY, SN_CLR_FOOD_OUT, SN_CLR_FOOD_IN);
    _snCellRect(_snHeadX, _snHeadY, SN_CLR_HEAD_OUT, SN_CLR_HEAD_IN);
    for(let i = 0; i < _snLen; i++)
        _snCellRect(_snBodyX[i], _snBodyY[i], SN_CLR_BODY_OUT, SN_CLR_BODY_IN);
}

function _snDrawSidebar(){
    _snCx.fillStyle = "#000"; _snCx.font = _snUf(14);
    _snCx.textAlign = "left"; _snCx.textBaseline = "alphabetic";
    _snCx.fillText("SCORE: " + _snScore, SHELL_BTN_X, SHELL_SBY + 18);
    _snCx.fillText("BEST:  " + _snPb,    SHELL_BTN_X, SHELL_SBY + 54);
    if(_snPaused && _snAlive && !_snCdActive){
        _snCx.fillStyle = "#ffd24a"; _snCx.font = _snUf(14);
        _snCx.fillText("PAUSED", SHELL_BTN_X, SHELL_SBY + 130);
    }
}

function _snDrawCountdown(){
    if(!_snCdActive) return;
    _snCx.globalAlpha = 0.5; _snCx.fillStyle = "#000";
    _snCx.fillRect(SN_BX, SN_BY, SN_BW, SN_BH); _snCx.globalAlpha = 1.0;
    _snCx.textAlign = "center";
    _snCx.fillStyle = "#fff"; _snCx.font = _snUf(18);
    _snCx.fillText("GET READY", SN_BX + SN_BW / 2, SN_BY + SN_BH / 2 - 18);
    _snCx.font = _snUf(40);
    _snCx.fillText(String(_snCdShown), SN_BX + SN_BW / 2, SN_BY + SN_BH / 2 + 28);
    _snCx.textAlign = "left";
}

function _snDrawGameOver(){
    if(_snAlive) return;
    _snCx.globalAlpha = 0.5; _snCx.fillStyle = "#000";
    _snCx.fillRect(SN_BX, SN_BY, SN_BW, SN_BH); _snCx.globalAlpha = 1.0;
    _snCx.textAlign = "center";
    _snCx.fillStyle = "#fff"; _snCx.font = _snUf(24);
    _snCx.fillText("GAME OVER", SN_BX + SN_BW / 2, SN_BY + SN_BH / 2 - 6);
    _snCx.fillStyle = "#93a0b3"; _snCx.font = _snUf(12);
    _snCx.fillText("Press RESET to try again", SN_BX + SN_BW / 2, SN_BY + SN_BH / 2 + 18);
    _snCx.textAlign = "left";
}

function _snDrawIdleOverlay(){
    _snCx.globalAlpha = 0.5; _snCx.fillStyle = "#000";
    _snCx.fillRect(SN_BX, SN_BY, SN_BW, SN_BH); _snCx.globalAlpha = 1.0;
    _snCx.textAlign = "center";
    _snCx.fillStyle = "#7fe37f"; _snCx.font = _snUf(22);
    _snCx.fillText("SNAKE", SN_BX + SN_BW / 2, SN_BY + SN_BH / 2 - 16);
    _snCx.fillStyle = "#93a0b3"; _snCx.font = _snUf(12);
    _snCx.fillText("Eat the food to grow",       SN_BX + SN_BW / 2, SN_BY + SN_BH / 2 + 6);
    _snCx.fillText("Don't hit walls or yourself!", SN_BX + SN_BW / 2, SN_BY + SN_BH / 2 + 22);
    _snCx.textAlign = "left";
}

function _snDraw(){
    _snDrawBoard();
    _snDrawSnakeAndFood();
    _snDrawSidebar();
    if(_snState === SN_ST_IDLE) _snDrawIdleOverlay();
    else { _snDrawCountdown(); _snDrawGameOver(); }
}