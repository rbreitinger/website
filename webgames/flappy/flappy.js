// =============================================================================
// flappy.js  —  Flappy bird
// Playfield lives in SHELL_PFX/PFY/PFW/PFH (from shell.js)
// =============================================================================

// ---------- logical play area (centered inside shell playfield) ----------
const FL_LW = 320, FL_LH = 240;
const FL_BX = SHELL_PFX + Math.floor((SHELL_PFW - FL_LW) / 2);  // 36
const FL_BY = SHELL_PFY + Math.floor((SHELL_PFH - FL_LH) / 2);  // 40

// ---------- pipe config ----------
const FL_PIPE_COUNT    = 10;
const FL_PIPE_W        = 16;
const FL_PIPE_GAP      = 75;
const FL_PIPE_SPEED    = 2;
const FL_PIPE_SPACING  = 72;
const FL_GAP_Y_MIN     = 20;
const FL_GAP_Y_RANGE   = 125;

// ---------- player ----------
const FL_PLAYER_X       = 50;   // x inside logical area
const FL_PLAYER_START_Y = 80;
const FL_PLAYER_R       = 5;    // collision radius (unchanged)
const FL_GRAVITY        = 1;
const FL_FLAP_VEL       = -8;
const FL_FLAP_TICKS     = 6;    // how many ticks the flap sprite stays visible

// ---------- sprite atlas (80x16, five 16x16 tiles) ----------
// col 0: pipe_mid  col 1: pipe_top  col 2: pipe_bot
// col 3: bird_flap  col 4: bird_idle
const FL_TILE          = 16;
const FL_COL_PIPE_MID  = 0;
const FL_COL_PIPE_TOP  = 1;   // cap at bottom edge of upper pipe
const FL_COL_PIPE_BOT  = 2;   // cap at top edge of lower pipe
const FL_COL_BIRD_FLAP = 3;
const FL_COL_BIRD_IDLE = 4;

// ---------- timing ----------
const FL_CD_MS        = 3000;  // countdown duration
const FL_PHYS_STEP_MS = 50;    // physics tick (~20 fps)

// ---------- score ----------
const FL_SCORE_PER_PIPE = 100;

// ---------- state ----------
const FL_ST_IDLE    = 0;
const FL_ST_PLAYING = 1;

// ---------- audio ----------
const FL_SND_FLAP = new Audio("flappy/flappy_flap.ogg");

// ---------- assets ----------
let _atlasReady = false;
let _bgReady    = false;

const _atlas = new Image();
_atlas.onload = () => { _atlasReady = true; };
_atlas.src = "flappy/flappy_atlas.png";

const _bgImg = new Image();
_bgImg.onload = () => { _bgReady = true; };
_bgImg.src = "flappy/flappy_sky.png";

let _cv, _cx;
let _state = FL_ST_IDLE;
let _score, _vel, _playerY, _alive;
let _pb            = 0;
let _birdFlapTicks = 0;
let _pipeX, _pipeGapY, _lastPipe;
let _cdActive, _cdMsLeft, _cdShown;
let _physAcc = 0;

// =============================================================================
// GAME INTERFACE
// =============================================================================
const GAME = {
    title:    "Flappy",
    subtitle: "Any key · tap to flap",

    init(canvas){
        _cv = canvas;
        _cx = canvas.getContext("2d");
        _cx.imageSmoothingEnabled = false;
        _state = FL_ST_IDLE;
        _pb = SHELL_getPB("flappy_score") || 0;
        window.addEventListener("keydown", _onKey);
    },

    start(){ _newGame(); },
    reset(){ _newGame(); },

    update(dt){ if(_state === FL_ST_PLAYING) _updateStep(dt); },
    draw(){ _draw(); },

    // called by shell for any canvas click/tap outside the shell buttons
    onClick(mx, my){
        if(mx >= FL_BX && mx < FL_BX + FL_LW &&
           my >= FL_BY && my < FL_BY + FL_LH){
            _flap();
        }
    }
};

// =============================================================================
// LOGIC
// =============================================================================
function _rndGapY(){ return Math.floor(FL_GAP_Y_MIN + Math.random() * FL_GAP_Y_RANGE); }

function _newGame(){
    _state         = FL_ST_PLAYING;
    _score         = 0;
    _vel           = 0;
    _playerY       = FL_PLAYER_START_Y;
    _alive         = true;
    _physAcc       = 0;
    _birdFlapTicks = 0;
    _pipeX         = new Array(FL_PIPE_COUNT);
    _pipeGapY      = new Array(FL_PIPE_COUNT);
    for(let i = 0; i < FL_PIPE_COUNT; i++){
        _pipeX[i]    = FL_LW + i * FL_PIPE_SPACING;
        _pipeGapY[i] = _rndGapY();
    }
    _lastPipe = FL_PIPE_COUNT - 1;
    _cdActive = true;
    _cdMsLeft = FL_CD_MS;
    _cdShown  = Math.ceil(FL_CD_MS / 1000);
}

function _flap(){
    if(!_alive || _cdActive || _state === FL_ST_IDLE) return;
    _vel           = FL_FLAP_VEL;
    _birdFlapTicks = FL_FLAP_TICKS;
    FL_SND_FLAP.currentTime = 0;
    FL_SND_FLAP.play();
}

function _updateStep(dt){
    _physAcc += dt;
    while(_physAcc >= FL_PHYS_STEP_MS){
        _physAcc -= FL_PHYS_STEP_MS;
        _tick();
    }
}

function _savePB(){
    if(_score > _pb){ _pb = _score; SHELL_setPB("flappy_score", _pb); }
}

function _tick(){
    if(!_alive) return;

    if(_cdActive){
        _cdMsLeft -= FL_PHYS_STEP_MS;
        if(_cdMsLeft <= 0){ _cdActive = false; _cdMsLeft = 0; _cdShown = 0; }
        else { _cdShown = Math.ceil(_cdMsLeft / 1000); }
        return;
    }

    if(_birdFlapTicks > 0) _birdFlapTicks--;

    _vel     += FL_GRAVITY;
    _playerY += _vel;

    if(_playerY < 0) _playerY = 0;
    else if(_playerY > FL_LH){ _alive = false; _savePB(); return; }

    for(let i = 0; i < FL_PIPE_COUNT; i++){
        _pipeX[i] -= FL_PIPE_SPEED;
        if(_pipeX[i] < -FL_PIPE_W){
            _pipeX[i]    = _pipeX[_lastPipe] + FL_PIPE_SPACING;
            _pipeGapY[i] = _rndGapY();
            _score      += FL_SCORE_PER_PIPE;
            _lastPipe    = i;
        }
        // collision: player circle at FL_PLAYER_X, radius FL_PLAYER_R
        if(FL_PLAYER_X + FL_PLAYER_R > _pipeX[i] &&
           FL_PLAYER_X - FL_PLAYER_R < _pipeX[i] + FL_PIPE_W){
            const gy = _pipeGapY[i];
            if(_playerY - FL_PLAYER_R < gy ||
               _playerY + FL_PLAYER_R > gy + FL_PIPE_GAP){
                _alive = false; _savePB(); return;
            }
        }
    }
}

// =============================================================================
// INPUT
// =============================================================================
function _onKey(e){
    if(_state === FL_ST_IDLE) return;
    _flap();
}

// =============================================================================
// DRAWING
// =============================================================================
function _uf(sz){ return sz + "px Consolas,\"Lucida Console\",\"Courier New\",monospace"; }

// draw one 16x16 tile from the atlas at canvas position (dx, dy)
function _drawTile(col, dx, dy){
    _cx.drawImage(_atlas, col * FL_TILE, 0, FL_TILE, FL_TILE, dx, dy, FL_TILE, FL_TILE);
}

function _drawPipePair(pipeX, gy){
    const dx = FL_BX + pipeX;

    // upper pipe: hangs from top, height = gy
    // body tiles fill from top down, cap tile sits at the very bottom
    for(let ty = 0; ty < gy - FL_TILE; ty += FL_TILE){
        _drawTile(FL_COL_PIPE_MID, dx, FL_BY + ty);
    }
    _drawTile(FL_COL_PIPE_TOP, dx, FL_BY + gy - FL_TILE);

    // lower pipe: rises from bottom, starts at gy + FL_PIPE_GAP
    const lowerY = FL_BY + gy + FL_PIPE_GAP;
    const lowerH = FL_LH - gy - FL_PIPE_GAP;
    _drawTile(FL_COL_PIPE_BOT, dx, lowerY);
    for(let ty = FL_TILE; ty < lowerH; ty += FL_TILE){
        _drawTile(FL_COL_PIPE_MID, dx, lowerY + ty);
    }
}

function _drawPipePairFallback(pipeX, gy){
    const dx = FL_BX + pipeX;
    _cx.strokeStyle = "#c01111";
    _cx.lineWidth   = 2;
    _cx.strokeRect(dx, FL_BY,                    FL_PIPE_W, gy);
    _cx.strokeRect(dx, FL_BY + gy + FL_PIPE_GAP, FL_PIPE_W, FL_LH - (gy + FL_PIPE_GAP));
}

function _drawPipes(){
    for(let i = 0; i < FL_PIPE_COUNT; i++){
        if(_atlasReady) _drawPipePair(        _pipeX[i], _pipeGapY[i]);
        else            _drawPipePairFallback(_pipeX[i], _pipeGapY[i]);
    }
}

function _drawBird(birdY, flapFrame){
    if(_atlasReady){
        const col = flapFrame ? FL_COL_BIRD_FLAP : FL_COL_BIRD_IDLE;
        // center the 16x16 sprite on the collision point
        _drawTile(col, FL_BX + FL_PLAYER_X - FL_TILE / 2,
                       FL_BY + birdY       - FL_TILE / 2);
    } else {
        _cx.fillStyle = "#419709";
        _cx.beginPath();
        _cx.arc(FL_BX + FL_PLAYER_X, FL_BY + birdY, FL_PLAYER_R, 0, Math.PI * 2);
        _cx.fill();
    }
}

function _drawBackground(){
    if(_bgReady){
        _cx.drawImage(_bgImg, FL_BX, FL_BY, FL_LW, FL_LH);
    } else {
        _cx.fillStyle = "#000";
        _cx.fillRect(FL_BX, FL_BY, FL_LW, FL_LH);
    }
}

function _drawGame(){
    _cx.save();
    _cx.imageSmoothingEnabled = false;
    _cx.beginPath(); _cx.rect(FL_BX, FL_BY, FL_LW, FL_LH); _cx.clip();
    _drawBackground();
    _drawPipes();
    _drawBird(_playerY, _birdFlapTicks > 0);
    _cx.restore();
}

function _drawIdleGame(){
    const previewPipes = [[60, 40], [200, 80], [340, 55]];
    _cx.save();
    _cx.imageSmoothingEnabled = false;
    _cx.beginPath(); _cx.rect(FL_BX, FL_BY, FL_LW, FL_LH); _cx.clip();
    _drawBackground();
    for(const [ppx, gy] of previewPipes){
        if(_atlasReady) _drawPipePair(        ppx, gy);
        else            _drawPipePairFallback(ppx, gy);
    }
    _drawBird(FL_PLAYER_START_Y, false);
    _cx.restore();
}

function _drawSidebar(){
    _cx.fillStyle    = "#000";
    _cx.font         = _uf(14);
    _cx.textAlign    = "left";
    _cx.textBaseline = "alphabetic";
    _cx.fillText("SCORE: " + _score, SHELL_BTN_X, SHELL_SBY + 18);
    _cx.fillText("BEST:  " + _pb,    SHELL_BTN_X, SHELL_SBY + 36);
}

function _drawCountdown(){
    if(!_cdActive) return;
    _cx.globalAlpha = 0.55; _cx.fillStyle = "#000";
    _cx.fillRect(FL_BX, FL_BY, FL_LW, FL_LH);
    _cx.globalAlpha = 1.0;
    _cx.textAlign   = "center";
    _cx.fillStyle   = "#fff"; _cx.font = _uf(18);
    _cx.fillText("GET READY", FL_BX + FL_LW / 2, FL_BY + FL_LH / 2 - 18);
    _cx.font = _uf(34);
    _cx.fillText(String(_cdShown), FL_BX + FL_LW / 2, FL_BY + FL_LH / 2 + 24);
    _cx.textAlign = "left";
}

function _drawGameOver(){
    if(_alive) return;
    _cx.fillStyle = "rgba(0,0,0,0.65)";
    _cx.fillRect(FL_BX, FL_BY, FL_LW, FL_LH);
    _cx.textAlign = "center";
    _cx.fillStyle = "#fff"; _cx.font = _uf(22);
    _cx.fillText("GAME OVER", FL_BX + FL_LW / 2, FL_BY + FL_LH / 2 - 6);
    _cx.fillStyle = "#93a0b3"; _cx.font = _uf(12);
    _cx.fillText("Press RESET to try again", FL_BX + FL_LW / 2, FL_BY + FL_LH / 2 + 18);
    _cx.textAlign = "left";
}

function _drawIdleOverlay(){
    _cx.globalAlpha = 0.6; _cx.fillStyle = "#000";
    _cx.fillRect(FL_BX, FL_BY, FL_LW, FL_LH);
    _cx.globalAlpha = 1.0;
    _cx.textAlign   = "center";
    _cx.fillStyle   = "#ffd24a"; _cx.font = _uf(22);
    _cx.fillText("FLAPPY", FL_BX + FL_LW / 2, FL_BY + FL_LH / 2 - 16);
    _cx.fillStyle = "#93a0b3"; _cx.font = _uf(12);
    _cx.fillText("Any key · tap to flap",    FL_BX + FL_LW / 2, FL_BY + FL_LH / 2 + 6);
    _cx.fillText("Don't touch the pipes!",   FL_BX + FL_LW / 2, FL_BY + FL_LH / 2 + 22);
    _cx.textAlign = "left";
}

function _draw(){
    _cx.fillStyle = CLR_BG;
    _cx.fillRect(0, 0, SHELL_CW, SHELL_CH);

    if(_state === FL_ST_IDLE){
        _drawIdleGame();
        _drawIdleOverlay();
    } else {
        _drawGame();
        _drawCountdown();
        _drawGameOver();
    }

    _drawSidebar();
}
