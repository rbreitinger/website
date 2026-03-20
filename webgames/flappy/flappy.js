// =============================================================================
// flappy.js  —  Flappy Bird  (phone shell port)
// Canvas 360 × 596  (PHN_CW / PHN_CH from game-phone.html)
//
// Required audio files in flappy/:
//   flappy_flap.ogg      — wing flap
//   flappy_score.ogg     — pipe cleared
//   flappy_levelup.ogg   — difficulty increase
//   flappy_hit.ogg       — pipe collision
//   flappy_fall.ogg      — fell off bottom
// =============================================================================

// ---------- HUD / play field / tap zone layout ----------
const FL_HUD_H  = 50;
const FL_PFX    = 0;
const FL_PFY    = FL_HUD_H;
const FL_PFW    = PHN_CW;
const FL_PFH    = 466;
const FL_TAP_Y  = FL_PFY + FL_PFH;          // y = 516
const FL_TAP_H  = PHN_CH - FL_TAP_Y;        // 80 px

// ---------- sprite atlas (80×16 source, drawn at 2×) ----------
const FL_TILE_SRC      = 16;
const FL_TILE_DST      = 32;
const FL_COL_PIPE_MID  = 0;
const FL_COL_PIPE_TOP  = 1;
const FL_COL_PIPE_BOT  = 2;
const FL_COL_BIRD_FLAP = 3;
const FL_COL_BIRD_IDLE = 4;
const FL_COL_BIRD_HIT  = 5;   // new tile at end of atlas (96×16)

// ---------- pipe geometry — initial values (used for reset) ----------
const FL_PIPE_GAP_INIT     = 160;
const FL_PIPE_SPEED_INIT   = 2.0;
const FL_PIPE_SPACING_INIT = 140;

// These three are let so difficulty scaling can mutate them at runtime.
let FL_PIPE_GAP     = FL_PIPE_GAP_INIT;
let FL_PIPE_SPEED   = FL_PIPE_SPEED_INIT;
let FL_PIPE_SPACING = FL_PIPE_SPACING_INIT;

const FL_PIPE_COUNT    = 10;
const FL_PIPE_W        = FL_TILE_DST;
const FL_GAP_Y_MIN     = 64;
const FL_GAP_Y_RANGE   = 200;

// ---------- difficulty scaling ----------
const FL_DIFF_EVERY        = 5;     // pipes between each step
const FL_DIFF_GAP_DEC      = 5;     // gap shrinks by this each step
const FL_DIFF_GAP_MIN      = 90;    // floor
const FL_DIFF_SPACING_DEC  = 3;     // spacing shrinks by this each step
const FL_DIFF_SPACING_MIN  = 80;    // floor
const FL_DIFF_SPEED_INC    = 0.1;   // speed increase per step
const FL_DIFF_SPEED_MAX    = 5.0;   // speed cap
const FL_DIFF_NOTIF_DUR    = 1500;  // ms the level-up text stays visible

// ---------- player ----------
const FL_PLAYER_X       = 60;
const FL_PLAYER_START_Y = 150;
const FL_PLAYER_R       = 10;
const FL_GRAVITY        = 1;
const FL_FLAP_VEL       = -12;
const FL_FLAP_TICKS     = 6;
const FL_DYING_FREEZE_MS = 400;  // bird frozen at collision before falling

// ---------- timing ----------
const FL_CD_MS        = 3000;
const FL_PHYS_STEP_MS = 50;

// ---------- score ----------
const FL_SCORE_PER_PIPE = 100;

// ---------- states ----------
const FL_ST_IDLE    = 0;
const FL_ST_PLAYING = 1;
const FL_ST_DYING   = 2;   // pipe hit — frozen then falling, no input
const FL_ST_OVER    = 3;

// ---------- audio ----------
const FL_SND_FLAP    = new Audio("flappy/flappy_flap.ogg");
const FL_SND_SCORE   = new Audio("flappy/flappy_score.ogg");
const FL_SND_LEVELUP = new Audio("flappy/flappy_levelup.ogg");
const FL_SND_HIT     = new Audio("flappy/flappy_hit.ogg");
const FL_SND_FALL    = new Audio("flappy/flappy_fall.ogg");

function _snd(audio) {
    if (SHELL_isMuted()) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
}

// ---------- assets ----------
let _atlasReady = false;
let _bgReady    = false;

// _atlasCv is an offscreen canvas with white (255,255,255) keyed to transparent.
// Built once on load, used as the draw source for all tile draws.
// Requires serving over HTTP (file:// taints the canvas) — use a local server.
let _atlasCv = null;

const _atlasRaw  = new Image();
_atlasRaw.onload = () => {
    var oc    = document.createElement("canvas");
    oc.width  = _atlasRaw.width;
    oc.height = _atlasRaw.height;
    var ox    = oc.getContext("2d");
    ox.drawImage(_atlasRaw, 0, 0);
    var id    = ox.getImageData(0, 0, oc.width, oc.height);
    var px    = id.data;
    for (var ii = 0; ii < px.length; ii += 4) {
        if (px[ii] === 255 && px[ii+1] === 255 && px[ii+2] === 255) {
            px[ii+3] = 0;
        }
    }
    ox.putImageData(id, 0, 0);
    _atlasCv    = oc;
    _atlasReady = true;
};
_atlasRaw.src = "flappy/flappy_atlas.png";

const _bgImg  = new Image();
_bgImg.onload = () => { _bgReady = true; };
_bgImg.src    = "flappy/flappy_sky.png";

// ---------- runtime state ----------
let _cv, _cx;
let _state         = FL_ST_IDLE;
let _score         = 0;
let _vel           = 0;
let _playerY       = FL_PLAYER_START_Y;
let _alive         = true;
let _pb            = 0;
let _hasPB         = false;
let _birdFlapTicks = 0;
let _pipeX, _pipeGapY, _pipeGapSize, _lastPipe;
let _cdActive      = false;
let _cdMsLeft      = 0;
let _cdShown       = 0;
let _physAcc       = 0;
let _overReason    = "";
let _overLockMs    = 0;
let _isNewBest     = false;
let _pipesPassed   = 0;
let _diffLevel     = 0;
let _diffNotifMs   = 0;
let _dyingFreezeMs = 0;

// =============================================================================
// GAME INTERFACE
// =============================================================================
const GAME = {
    title: "Flappy",

    init(canvas) {
        _cv = canvas;
        _cx = canvas.getContext("2d");
        _cx.imageSmoothingEnabled = false;
        var pbRaw = SHELL_getPB("flappy_score");
        _pb    = pbRaw !== null ? pbRaw : 0;
        _hasPB = pbRaw !== null;
        _score = 0;
        _state = FL_ST_IDLE;
    },

    start() {
        _state = FL_ST_IDLE;
        _score = 0;
    },

    update(dt) {
        if (_state === FL_ST_PLAYING) {
            _updateStep(dt);
            if (_diffNotifMs > 0) {
                _diffNotifMs -= dt;
                if (_diffNotifMs < 0) _diffNotifMs = 0;
            }
            return;
        }
        if (_state === FL_ST_DYING) { _updateDying(dt); return; }
        if (_state === FL_ST_OVER)  { _overLockMs += dt; }
    },

    draw() { _draw(); },

    // onDragStart fires on touchstart — zero classification delay for flap.
    // Restricted to tap zone so play-field grazes don't fire accidentally.
    onDragStart(mx, my) {
        if (_state !== FL_ST_PLAYING || _cdActive) return;
        if (my < FL_TAP_Y) return;
        _flap();
    },

    onClick(mx, my) {
        if (_state === FL_ST_IDLE) {
            if (my < FL_TAP_Y) return;
            _newGame();
            return;
        }
        if (_state === FL_ST_OVER && _overLockMs >= 1000) {
            var btnW    = 200;
            var btnH    = 52;
            var btnX    = Math.floor((PHN_CW - btnW) / 2);
            var btnTopY = Math.floor(PHN_CH / 2) + 68;
            if (mx >= btnX && mx <= btnX + btnW &&
                my >= btnTopY && my <= btnTopY + btnH) {
                _newGame();
            }
        }
    }
};

// =============================================================================
// LOGIC
// =============================================================================
function _rndGapY() {
    return Math.floor(FL_GAP_Y_MIN + Math.random() * FL_GAP_Y_RANGE);
}

function _newGame() {
    FL_PIPE_GAP     = FL_PIPE_GAP_INIT;
    FL_PIPE_SPEED   = FL_PIPE_SPEED_INIT;
    FL_PIPE_SPACING = FL_PIPE_SPACING_INIT;

    _state         = FL_ST_PLAYING;
    _score         = 0;
    _vel           = 0;
    _playerY       = FL_PLAYER_START_Y;
    _alive         = true;
    _physAcc       = 0;
    _birdFlapTicks = 0;
    _overLockMs    = 0;
    _isNewBest     = false;
    _overReason    = "";
    _pipesPassed   = 0;
    _diffLevel     = 0;
    _diffNotifMs   = 0;
    _dyingFreezeMs = 0;

    _pipeX       = new Array(FL_PIPE_COUNT);
    _pipeGapY    = new Array(FL_PIPE_COUNT);
    _pipeGapSize = new Array(FL_PIPE_COUNT);
    for (var i = 0; i < FL_PIPE_COUNT; i++) {
        _pipeX[i]       = FL_PFW + i * FL_PIPE_SPACING;
        _pipeGapY[i]    = _rndGapY();
        _pipeGapSize[i] = FL_PIPE_GAP;
    }
    _lastPipe = FL_PIPE_COUNT - 1;
    _cdActive = true;
    _cdMsLeft = FL_CD_MS;
    _cdShown  = Math.ceil(FL_CD_MS / 1000);
}

function _flap() {
    _vel           = FL_FLAP_VEL;
    _birdFlapTicks = FL_FLAP_TICKS;
    _snd(FL_SND_FLAP);
}

function _updateStep(dt) {
    _physAcc += dt;
    while (_physAcc >= FL_PHYS_STEP_MS) {
        _physAcc -= FL_PHYS_STEP_MS;
        _tick();
    }
}

function _savePB() {
    _hasPB = true;
    if (_score > _pb) { _pb = _score; _isNewBest = true; }
    SHELL_setPB("flappy_score", _pb);
}

function _setDying() {
    // pipe collision — freeze briefly, show hit sprite, then fall to game over
    _alive         = false;
    _overReason    = "pipe";
    _dyingFreezeMs = FL_DYING_FREEZE_MS;
    _vel           = 0;
    _savePB();
    _state         = FL_ST_DYING;
    _snd(FL_SND_HIT);
}

function _setOver() {
    _overLockMs = 0;
    _state      = FL_ST_OVER;
}

// Dying update: pipes keep scrolling. Freeze counts down, then gravity resumes.
// Once bird exits the bottom → fire game over instantly.
function _updateDying(dt) {
    _physAcc += dt;
    while (_physAcc >= FL_PHYS_STEP_MS) {
        _physAcc -= FL_PHYS_STEP_MS;

        // scroll pipes so the scene doesn't freeze behind the bird
        for (var i = 0; i < FL_PIPE_COUNT; i++) {
            _pipeX[i] -= FL_PIPE_SPEED;
        }

        if (_dyingFreezeMs > 0) {
            _dyingFreezeMs -= FL_PHYS_STEP_MS;
            if (_dyingFreezeMs < 0) _dyingFreezeMs = 0;
        } else {
            _vel     += FL_GRAVITY;
            _playerY += _vel;
            if (_playerY > FL_PFH) { _setOver(); return; }
        }
    }
}

function _triggerDifficulty() {
    var atCeiling = FL_PIPE_GAP     <= FL_DIFF_GAP_MIN &&
                    FL_PIPE_SPACING <= FL_DIFF_SPACING_MIN &&
                    FL_PIPE_SPEED   >= FL_DIFF_SPEED_MAX;
    if (atCeiling) return;
    _diffLevel++;
    FL_PIPE_GAP     = Math.max(FL_DIFF_GAP_MIN,    FL_PIPE_GAP     - FL_DIFF_GAP_DEC);
    FL_PIPE_SPACING = Math.max(FL_DIFF_SPACING_MIN, FL_PIPE_SPACING - FL_DIFF_SPACING_DEC);
    FL_PIPE_SPEED   = Math.min(FL_DIFF_SPEED_MAX,   FL_PIPE_SPEED   + FL_DIFF_SPEED_INC);
    _diffNotifMs    = FL_DIFF_NOTIF_DUR;
    _snd(FL_SND_LEVELUP);
}

function _tick() {
    if (!_alive) return;

    if (_cdActive) {
        _cdMsLeft -= FL_PHYS_STEP_MS;
        if (_cdMsLeft <= 0) { _cdActive = false; _cdMsLeft = 0; _cdShown = 0; }
        else                { _cdShown = Math.ceil(_cdMsLeft / 1000); }
        return;
    }

    if (_birdFlapTicks > 0) _birdFlapTicks--;

    _vel     += FL_GRAVITY;
    _playerY += _vel;

    if      (_playerY < 0)      { _playerY = 0; }
    else if (_playerY > FL_PFH) {
        _alive      = false;
        _overReason = "fell";
        _savePB();
        _snd(FL_SND_FALL);
        _setOver();
        return;
    }

    for (var i = 0; i < FL_PIPE_COUNT; i++) {
        _pipeX[i] -= FL_PIPE_SPEED;
        if (_pipeX[i] < -FL_PIPE_W) {
            _pipeX[i]       = _pipeX[_lastPipe] + FL_PIPE_SPACING;
            _pipeGapY[i]    = _rndGapY();
            _pipeGapSize[i] = FL_PIPE_GAP;
            _score         += FL_SCORE_PER_PIPE;
            _lastPipe       = i;
            _pipesPassed++;
            _snd(FL_SND_SCORE);
            if (_pipesPassed % FL_DIFF_EVERY === 0) _triggerDifficulty();
        }
        if (FL_PLAYER_X + FL_PLAYER_R > _pipeX[i] &&
            FL_PLAYER_X - FL_PLAYER_R < _pipeX[i] + FL_PIPE_W) {
            var gy  = _pipeGapY[i];
            var gsz = _pipeGapSize[i];
            if (_playerY - FL_PLAYER_R < gy ||
                _playerY + FL_PLAYER_R > gy + gsz) {
                _setDying(); return;
            }
        }
    }
}

// =============================================================================
// DRAWING — helpers
// =============================================================================
function _mf(sz)  { return sz + "px monospace"; }
function _mbf(sz) { return "bold " + sz + "px monospace"; }
function _sbf(sz) { return "bold " + sz + "px sans-serif"; }

function _drawTile(col, dx, dy) {
    _cx.drawImage(
        _atlasCv,
        col * FL_TILE_SRC, 0, FL_TILE_SRC, FL_TILE_SRC,
        dx, dy, FL_TILE_DST, FL_TILE_DST
    );
}

// ---------- pipes ----------
function _drawPipePair(pipeX, gy, gapSize) {
    var dx     = Math.round(FL_PFX + pipeX);
    var dy     = FL_PFY;
    var lowerY = dy + gy + gapSize;
    var lowerH = FL_PFH - gy - gapSize;
    var ty;
    for (ty = 0; ty < gy - FL_TILE_DST; ty += FL_TILE_DST) {
        _drawTile(FL_COL_PIPE_MID, dx, dy + ty);
    }
    _drawTile(FL_COL_PIPE_TOP, dx, dy + gy - FL_TILE_DST);
    _drawTile(FL_COL_PIPE_BOT, dx, lowerY);
    for (ty = FL_TILE_DST; ty < lowerH; ty += FL_TILE_DST) {
        _drawTile(FL_COL_PIPE_MID, dx, lowerY + ty);
    }
}

function _drawPipePairFallback(pipeX, gy, gapSize) {
    var dx = Math.round(FL_PFX + pipeX);
    var dy = FL_PFY;
    _cx.strokeStyle = "#c01111";
    _cx.lineWidth   = 2;
    _cx.strokeRect(dx, dy,               FL_PIPE_W, gy);
    _cx.strokeRect(dx, dy + gy + gapSize, FL_PIPE_W, FL_PFH - gy - gapSize);
}

function _drawPipes() {
    for (var i = 0; i < FL_PIPE_COUNT; i++) {
        if (_atlasReady) _drawPipePair(        _pipeX[i], _pipeGapY[i], _pipeGapSize[i]);
        else             _drawPipePairFallback(_pipeX[i], _pipeGapY[i], _pipeGapSize[i]);
    }
}

// ---------- bird (flat, flap/idle frame switching) ----------
function _drawBird(birdY, flapFrame) {
    var bx = Math.round(FL_PFX + FL_PLAYER_X);
    var by = Math.round(FL_PFY + birdY);

    _cx.save();
    _cx.imageSmoothingEnabled = false;

    if (_atlasReady) {
        var col;
        if (_state === FL_ST_DYING) col = FL_COL_BIRD_HIT;
        else if (flapFrame)         col = FL_COL_BIRD_FLAP;
        else                        col = FL_COL_BIRD_IDLE;
        _cx.drawImage(
            _atlasCv,
            col * FL_TILE_SRC, 0, FL_TILE_SRC, FL_TILE_SRC,
            bx - FL_TILE_DST / 2, by - FL_TILE_DST / 2, FL_TILE_DST, FL_TILE_DST
        );
    } else {
        _cx.fillStyle = (_state === FL_ST_DYING) ? "#c01111" : "#419709";
        _cx.beginPath();
        _cx.arc(bx, by, FL_PLAYER_R, 0, Math.PI * 2);
        _cx.fill();
    }

    _cx.restore();
}

// ---------- background ----------
function _drawBackground() {
    if (_bgReady && SHELL_isBgEnabled()) {
        _cx.drawImage(_bgImg, FL_PFX, FL_PFY, FL_PFW, FL_PFH);
    } else {
        _cx.fillStyle = "#1a3a5c";
        _cx.fillRect(FL_PFX, FL_PFY, FL_PFW, FL_PFH);
    }
}

// ---------- play field (clipped) ----------
function _drawPlayField(birdY, flapFrame) {
    _cx.save();
    _cx.imageSmoothingEnabled = false;
    _cx.beginPath();
    _cx.rect(FL_PFX, FL_PFY, FL_PFW, FL_PFH);
    _cx.clip();
    _drawBackground();
    _drawPipes();
    _drawBird(birdY, flapFrame);
    _drawDiffNotif();
    _cx.restore();
}

// ---------- idle preview ----------
function _drawIdlePlayField() {
    var previewPipes = [[80, 100], [220, 180], [360, 120]];
    _cx.save();
    _cx.imageSmoothingEnabled = false;
    _cx.beginPath();
    _cx.rect(FL_PFX, FL_PFY, FL_PFW, FL_PFH);
    _cx.clip();
    _drawBackground();
    for (var pi = 0; pi < previewPipes.length; pi++) {
        if (_atlasReady) _drawPipePair(        previewPipes[pi][0], previewPipes[pi][1], FL_PIPE_GAP_INIT);
        else             _drawPipePairFallback(previewPipes[pi][0], previewPipes[pi][1], FL_PIPE_GAP_INIT);
    }
    _drawBird(FL_PLAYER_START_Y, false);
    _cx.restore();
}

// ---------- HUD bar (§15a) ----------
function _drawHUD() {
    var midX = PHN_CW / 2;

    _cx.fillStyle = "#181830";
    _cx.fillRect(0, 0, PHN_CW, FL_HUD_H);
    _cx.fillStyle = "#2a2a55";
    _cx.fillRect(0, FL_HUD_H - 1, PHN_CW, 1);

    _cx.textBaseline = "alphabetic";

    _cx.textAlign = "left";
    _cx.fillStyle = "#7777aa";
    _cx.font      = _mf(11);
    _cx.fillText("SCORE", 16, 18);
    _cx.fillStyle = "#ffffff";
    _cx.font      = _mbf(22);
    _cx.fillText(String(_score), 16, 40);

    if (_hasPB) {
        _cx.textAlign = "center";
        _cx.fillStyle = "#7777aa";
        _cx.font      = _mf(11);
        _cx.fillText("BEST", midX, 18);
        _cx.fillStyle = (_score > 0 && _score >= _pb) ? "#60ff60" : "#ffffff";
        _cx.font      = _mbf(22);
        _cx.fillText(String(_pb), midX, 40);
    }
}

// ---------- tap zone ----------
function _drawTapZone(lbl) {
    _cx.fillStyle = "#0d0d1a";
    _cx.fillRect(0, FL_TAP_Y, PHN_CW, FL_TAP_H);
    _cx.fillStyle = "#2a2a55";
    _cx.fillRect(0, FL_TAP_Y, PHN_CW, 1);
    _cx.textAlign    = "center";
    _cx.textBaseline = "middle";
    _cx.fillStyle    = "#3a3a66";
    _cx.font         = _mf(13);
    _cx.fillText(lbl, PHN_CW / 2, FL_TAP_Y + FL_TAP_H / 2);
    _cx.textBaseline = "alphabetic";
}

// ---------- difficulty level-up notification (§15b) ----------
function _drawDiffNotif() {
    if (_diffNotifMs <= 0) return;
    var alpha = Math.min(1.0, _diffNotifMs / 400);   // fade out in last 400 ms
    var sy    = FL_PFY + Math.round(FL_PFH / 3);
    var txt   = "LEVEL " + (_diffLevel + 1) + "!";

    _cx.save();
    _cx.globalAlpha  = alpha;
    _cx.textAlign    = "center";
    _cx.textBaseline = "middle";
    _cx.font         = _sbf(20);
    _cx.lineWidth    = 3;
    _cx.strokeStyle  = "rgba(0,0,0,0.7)";
    _cx.strokeText(txt, FL_PFX + FL_PFW / 2, sy);
    _cx.fillStyle    = "#ffd24a";
    _cx.fillText(txt, FL_PFX + FL_PFW / 2, sy);
    _cx.restore();
}

// ---------- countdown overlay ----------
function _drawCountdown() {
    if (!_cdActive) return;
    _cx.globalAlpha = 0.55;
    _cx.fillStyle   = "#000";
    _cx.fillRect(FL_PFX, FL_PFY, FL_PFW, FL_PFH);
    _cx.globalAlpha = 1.0;
    _cx.textAlign   = "center";
    _cx.fillStyle   = "#ffffff";
    _cx.font        = _mf(18);
    _cx.fillText("GET READY", FL_PFX + FL_PFW / 2, FL_PFY + FL_PFH / 2 - 24);
    _cx.font        = _mbf(42);
    _cx.fillText(String(_cdShown), FL_PFX + FL_PFW / 2, FL_PFY + FL_PFH / 2 + 28);
    _cx.textAlign   = "left";
}

// ---------- idle title overlay ----------
function _drawIdleOverlay() {
    _cx.globalAlpha = 0.6;
    _cx.fillStyle   = "#000";
    _cx.fillRect(FL_PFX, FL_PFY, FL_PFW, FL_PFH);
    _cx.globalAlpha = 1.0;
    _cx.textAlign   = "center";
    _cx.fillStyle   = "#ffd24a";
    _cx.font        = _sbf(32);
    _cx.fillText("FLAPPY", FL_PFX + FL_PFW / 2, FL_PFY + FL_PFH / 2 - 20);
    _cx.fillStyle   = "#93a0b3";
    _cx.font        = _mf(13);
    _cx.fillText("Don't touch the pipes!", FL_PFX + FL_PFW / 2, FL_PFY + FL_PFH / 2 + 10);
    _cx.fillText("Tap below to begin",     FL_PFX + FL_PFW / 2, FL_PFY + FL_PFH / 2 + 30);
    _cx.textAlign   = "left";
}

// ---------- game over screen (§15c) ----------
function _drawGameOver() {
    var CW      = PHN_CW;
    var CH      = PHN_CH;
    var midY    = Math.floor(CH / 2);
    var locked  = _overLockMs < 1000;
    var btnW    = 200;
    var btnH    = 52;
    var btnR    = 14;
    var btnX    = Math.floor((CW - btnW) / 2);
    var btnTopY = midY + 68;
    var headline = (_overReason === "fell") ? "FELL DOWN!" : "HIT A PIPE!";

    _cx.fillStyle = "rgba(8,8,24,0.88)";
    _cx.fillRect(0, 0, CW, CH);

    _cx.textAlign    = "center";
    _cx.textBaseline = "alphabetic";

    _cx.fillStyle = "#ffffff";
    _cx.font      = _sbf(34);
    _cx.fillText(headline, CW / 2, midY - 72);

    _cx.fillStyle = "#8888cc";
    _cx.font      = _mf(14);
    _cx.fillText("FINAL SCORE", CW / 2, midY - 28);

    _cx.fillStyle = "#f0d020";
    _cx.font      = _mbf(52);
    _cx.fillText(String(_score), CW / 2, midY + 26);

    if (_hasPB) {
        if (_isNewBest) {
            _cx.fillStyle = "#60ff60";
            _cx.font      = _mbf(14);
            _cx.fillText("NEW BEST! \u2b50", CW / 2, midY + 56);
        } else {
            _cx.fillStyle = "#6666aa";
            _cx.font      = _mf(12);
            _cx.fillText("BEST: " + _pb, CW / 2, midY + 56);
        }
    }

    _cx.beginPath();
    _cx.moveTo(btnX + btnR, btnTopY);
    _cx.arcTo(btnX + btnW, btnTopY,        btnX + btnW, btnTopY + btnH, btnR);
    _cx.arcTo(btnX + btnW, btnTopY + btnH, btnX,        btnTopY + btnH, btnR);
    _cx.arcTo(btnX,        btnTopY + btnH, btnX,        btnTopY,        btnR);
    _cx.arcTo(btnX,        btnTopY,        btnX + btnW, btnTopY,        btnR);
    _cx.closePath();
    _cx.fillStyle   = locked ? "#222222" : "#1a5a1a";
    _cx.fill();
    _cx.strokeStyle = locked ? "#555555" : "#50c050";
    _cx.lineWidth   = 2;
    _cx.stroke();

    _cx.fillStyle    = "#ffffff";
    _cx.font         = "bold 20px sans-serif";
    _cx.textBaseline = "middle";
    _cx.fillText(locked ? "WAIT..." : "PLAY AGAIN", CW / 2, btnTopY + btnH / 2);

    _cx.textAlign    = "left";
    _cx.textBaseline = "alphabetic";
}

// ---------- main draw ----------
function _draw() {
    _cx.fillStyle = "#000";
    _cx.fillRect(0, 0, PHN_CW, PHN_CH);

    if (_state === FL_ST_IDLE) {
        _drawIdlePlayField();
        _drawIdleOverlay();
        _drawTapZone("TAP TO START");
        _drawHUD();
        return;
    }

    _drawPlayField(_playerY, _birdFlapTicks > 0);
    _drawCountdown();
    _drawTapZone(_state === FL_ST_DYING ? "" : "TAP TO FLAP");
    _drawHUD();

    if (_state === FL_ST_OVER) _drawGameOver();
}
