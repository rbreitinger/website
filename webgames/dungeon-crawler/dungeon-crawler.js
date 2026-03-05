// =============================================================================
// dungeon-crawler.js  —  shell-compatible version
// Exposes: const GAME = { title, subtitle, init, start, reset, update, draw }
// Shell provides: canvas, RAF loop, START/RESET buttons, fixed-step calls
// =============================================================================

// ── tile grid: 17x17 cells of 16px, centered in playfield ────────────────────
const DC_VIEW    = 17;
const DC_CELL    = 16;
const DC_BOARD_W = DC_VIEW * DC_CELL;                                          // 272
const DC_BOARD_H = DC_VIEW * DC_CELL;                                          // 272
const DC_BOARD_X = SHELL_PFX + Math.floor((SHELL_PFW - DC_BOARD_W) / 2);     // 60
const DC_BOARD_Y = SHELL_PFY + Math.floor((SHELL_PFH - DC_BOARD_H) / 2);     // 24

// ── timing ────────────────────────────────────────────────────────────────────
const DC_CD_MS          = 3000;
const DC_LEVEL_CLEAR_MS = 2000;

// ── canvas background (game uses its own dark theme, not shell CLR_BG) ────────
const DC_CLR_CANVAS  = "#0e1218";
const DC_CLR_PF_BG   = "#0b0d10";
const DC_CLR_PF_BORD = "#2a2f38";
const DC_CLR_CELL_BG = "#111824";

// ── DOS 16-color palette ──────────────────────────────────────────────────────
const DC_PAL = [
    "#000000","#0000AA","#00AA00","#00AAAA",
    "#AA0000","#AA00AA","#AA5500","#AAAAAA",
    "#555555","#5555FF","#55FF55","#55FFFF",
    "#FF5555","#FF55FF","#FFFF55","#FFFFFF"
];

// ── tile types ────────────────────────────────────────────────────────────────
const DC_TILE_PATH      = 0, DC_TILE_WALL      = 1, DC_TILE_DIAMOND = 2,
      DC_TILE_HEALTH    = 3, DC_TILE_TELEPORTER = 4, DC_TILE_SHOVEL  = 5;

// ── monster types ─────────────────────────────────────────────────────────────
const DC_MON_GUARDIAN = 0, DC_MON_CHASER = 1, DC_MON_WANDERER = 2, DC_MON_BAT = 3;

// ── holdable types ────────────────────────────────────────────────────────────
const DC_HOLD_FREE        = 0, DC_HOLD_TELE = 1, DC_HOLD_SHOVEL_ITEM = 2;

// ── glyphs ────────────────────────────────────────────────────────────────────
const DC_G_PLAYER     = "\u263B";
const DC_G_WALL       = "\u2593";  // used as id only — drawn as solid rect
const DC_G_DIAMOND    = "\u2666";
const DC_G_HEALTH     = "\u2665";
const DC_G_TELEPORTER = "\u00A7";
const DC_G_SHOVEL     = "\u2660";
const DC_G_CHASER     = "C";
const DC_G_WANDERER   = "W";
const DC_G_GUARDIAN   = "G";
const DC_G_BAT        = "%";

// ── game states ───────────────────────────────────────────────────────────────
const DC_ST_IDLE       = 0, DC_ST_COUNTDOWN = 1, DC_ST_PLAYING  = 2,
      DC_ST_DIGMODE    = 3, DC_ST_DEAD      = 4, DC_ST_TIMEOUT  = 5,
      DC_ST_LEVELCLEAR = 6;

// ── state ─────────────────────────────────────────────────────────────────────
let gameState = DC_ST_IDLE;

let w = {
    sizeX:0, sizeY:0, level:0,
    numMonsters:0, numDiamonds:0,
    clock:0, timeout:0, tmr:0,
    dungeon:[], wallColor:2,
    camX:0, camY:0
};

let p = { x:0, y:0, health:3, score:0, diamonds:0, holdable:DC_HOLD_FREE };

let monsters = [];

let cdMsLeft = 0, cdShown = 3;
let levelClearMs = 0;
let pb = 0;
let _cx;

// =============================================================================
// GAME INTERFACE
// =============================================================================
const GAME = {
    title:    "Dungeon Crawler",
    subtitle: "Tap arrow keys \u00B7 Space use item",

    init(canvas) {
        _cx        = canvas.getContext("2d");
        pb         = SHELL_getPB("dc_score") || 0;
        gameState  = DC_ST_IDLE;
        p.score    = 0;
        w.level    = 0;
        p.holdable = DC_HOLD_FREE;
        _registerKeys();
    },

    start() {
        p.score    = 0;
        w.level    = 0;
        p.holdable = DC_HOLD_FREE;
        _initDungeon();
        _startCountdown();
    },

    reset() {
        p.score    = 0;
        w.level    = 0;
        p.holdable = DC_HOLD_FREE;
        _initDungeon();
        _startCountdown();
    },

    update(deltaMs) { _update(deltaMs); },
    draw()          { _draw();          }
};

// =============================================================================
// KEY HANDLING
// =============================================================================
const _keysHeld = {};

function _registerKeys() {
    window.addEventListener("keydown", e => {
        if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key))
            e.preventDefault();
        if(_keysHeld[e.code]) return;
        _keysHeld[e.code] = true;
        _onKey(e.code);
    });
    window.addEventListener("keyup", e => { _keysHeld[e.code] = false; });
}

function _onKey(code) {
    if(gameState === DC_ST_PLAYING) {
        if      (code === "ArrowUp")    _movePlayer(0);
        else if (code === "ArrowDown")  _movePlayer(1);
        else if (code === "ArrowLeft")  _movePlayer(2);
        else if (code === "ArrowRight") _movePlayer(3);
        else if (code === "Space")      _useHoldable();
        return;
    }
    if(gameState === DC_ST_DIGMODE) {
        if      (code === "ArrowUp")    _doShovel( 0,-1);
        else if (code === "ArrowDown")  _doShovel( 0, 1);
        else if (code === "ArrowLeft")  _doShovel(-1, 0);
        else if (code === "ArrowRight") _doShovel( 1, 0);
        else gameState = DC_ST_PLAYING;
    }
}

// =============================================================================
// DUNGEON INIT
// =============================================================================
function _dget(x,y)   { return w.dungeon[x][y]; }
function _dset(x,y,v) { w.dungeon[x][y] = v; }

function _rndFree() {
    let x, y;
    do {
        x = Math.floor(Math.random() * (w.sizeX - 2)) + 1;
        y = Math.floor(Math.random() * (w.sizeY - 2)) + 1;
    } while(_dget(x,y) !== DC_TILE_PATH);
    return { x, y };
}

function _placePlayer() {
    const s = _rndFree();
    p.x = s.x; p.y = s.y;
    p.holdable = (p.holdable === DC_HOLD_TELE) ? DC_HOLD_FREE : DC_HOLD_SHOVEL_ITEM;
}

function _initDungeon() {
    if(w.level < 99) w.level++;

    const lv = w.level;
    if     (lv <= 9)  w.wallColor = 2;
    else if(lv <= 19) w.wallColor = 6;
    else if(lv <= 29) w.wallColor = 5;
    else if(lv <= 39) w.wallColor = 3;
    else if(lv <= 49) w.wallColor = 9;
    else if(lv <= 59) w.wallColor = 7;
    else if(lv <= 69) w.wallColor = 8;
    else if(lv <= 79) w.wallColor = 11;
    else if(lv <= 89) w.wallColor = 15;
    else if(lv <= 98) w.wallColor = 4;
    else              w.wallColor = 0;

    w.sizeX = (DC_VIEW - 2) + w.level * 2;
    w.sizeY = (DC_VIEW - 2) + w.level * 2;

    w.numMonsters = w.level;
    w.numDiamonds = (w.level < 5) ? w.level * 2 : 10;
    const numPot  = 1 + Math.floor(w.level / 4);
    const numShov = 1 + Math.floor(w.level / 4);
    const numTele = (w.level < 5) ? w.level : 5;

    w.clock   = Math.min(40 + w.level * 10, 999);
    w.timeout = w.clock;
    w.tmr     = 1;

    w.dungeon = [];
    for(let x = 0; x < w.sizeX; x++)
        w.dungeon[x] = new Array(w.sizeY).fill(DC_TILE_WALL);

    const walks = (w.level < 8) ? 1 + w.level : 9;
    const steps = w.level * 25;
    for(let wi = 0; wi < walks; wi++){
        let cx = Math.floor(Math.random() * (w.sizeX - 2)) + 1;
        let cy = Math.floor(Math.random() * (w.sizeY - 2)) + 1;
        _dset(cx, cy, DC_TILE_PATH);
        for(let s = 0; s < steps; s++){
            const d = Math.floor(Math.random() * 4);
            if     (d===0 && cy > 1)           cy--;
            else if(d===1 && cy < w.sizeY - 2) cy++;
            else if(d===2 && cx > 1)           cx--;
            else if(d===3 && cx < w.sizeX - 2) cx++;
            _dset(cx, cy, DC_TILE_PATH);
        }
    }

    monsters = [];
    for(let i = 0; i < w.numMonsters; i++){
        const spot  = _rndFree();
        const chara = (w.level < 4) ? w.level : Math.floor(Math.random() * 4);
        let interval = ((200 - chara * 20) - w.level) * 7;
        if(interval < 150) interval = 150;
        const mon = { x:spot.x, y:spot.y, dirX:1, dirY:0, chara, interval, dead:false };
        if(chara === DC_MON_BAT){
            mon.dirX = Math.random() < 0.5 ? 1 : -1;
            mon.dirY = Math.random() < 0.5 ? 1 : -1;
        }
        monsters.push(mon);
    }

    for(let i = 0; i < w.numDiamonds; i++) { const s = _rndFree(); _dset(s.x, s.y, DC_TILE_DIAMOND);    }
    for(let i = 0; i < numPot;        i++) { const s = _rndFree(); _dset(s.x, s.y, DC_TILE_HEALTH);     }
    for(let i = 0; i < numTele;       i++) { const s = _rndFree(); _dset(s.x, s.y, DC_TILE_TELEPORTER); }
    for(let i = 0; i < numShov;       i++) { const s = _rndFree(); _dset(s.x, s.y, DC_TILE_SHOVEL);     }

    _placePlayer();
    p.diamonds = 0;
    p.health   = 3;
    _updateCamera();
}

// =============================================================================
// CAMERA / LOS
// =============================================================================
function _updateCamera(){
    w.camX = p.x - Math.floor(DC_VIEW / 2);
    w.camY = p.y - Math.floor(DC_VIEW / 2);
    if(w.camX < 0) w.camX = 0;
    if(w.camY < 0) w.camY = 0;
    if(w.camX > w.sizeX - DC_VIEW) w.camX = w.sizeX - DC_VIEW;
    if(w.camY > w.sizeY - DC_VIEW) w.camY = w.sizeY - DC_VIEW;
}

function _los(x1,y1,x2,y2){
    const dx = Math.abs(x2-x1), dy = Math.abs(y2-y1);
    const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
    let er = dx - dy;
    while(x1 !== x2 || y1 !== y2){
        if(_dget(x1,y1) === DC_TILE_WALL) return false;
        const e2 = 2 * er;
        if(e2 > -dy){ er -= dy; x1 += sx; }
        if(e2 <  dx){ er += dx; y1 += sy; }
    }
    return true;
}

// =============================================================================
// PLAYER
// =============================================================================
function _movePlayer(dir){
    let nx = p.x, ny = p.y;
    if     (dir === 0) ny--;
    else if(dir === 1) ny++;
    else if(dir === 2) nx--;
    else               nx++;
    if(nx < 0 || ny < 0 || nx >= w.sizeX || ny >= w.sizeY) return;
    const tile = _dget(nx, ny);
    if     (tile === DC_TILE_DIAMOND                              ){ p.diamonds++; p.score = Math.min(p.score + 8, 9999999); _dset(nx, ny, DC_TILE_PATH); }
    else if(tile === DC_TILE_HEALTH                               ){ if(p.health < 3) p.health++; _dset(nx, ny, DC_TILE_PATH); }
    else if(tile === DC_TILE_TELEPORTER && p.holdable===DC_HOLD_FREE){ p.holdable = DC_HOLD_TELE;        _dset(nx, ny, DC_TILE_PATH); }
    else if(tile === DC_TILE_SHOVEL     && p.holdable===DC_HOLD_FREE){ p.holdable = DC_HOLD_SHOVEL_ITEM; _dset(nx, ny, DC_TILE_PATH); }
    for(const mon of monsters){
        if(mon.dead) continue;
        if(mon.x === nx && mon.y === ny){ p.health--; mon.dead = true; }
    }
    if(tile !== DC_TILE_WALL){ p.x = nx; p.y = ny; }
    _updateCamera();
}

function _useHoldable(){
    if     (p.holdable === DC_HOLD_TELE)        { _placePlayer(); _updateCamera(); }
    else if(p.holdable === DC_HOLD_SHOVEL_ITEM) { gameState = DC_ST_DIGMODE; }
}

function _doShovel(dx, dy){
    let tx = p.x + dx, ty = p.y + dy;
    if(tx < 1 || tx >= w.sizeX-1 || ty < 1 || ty >= w.sizeY-1 || _dget(tx,ty) !== DC_TILE_WALL){
        gameState = DC_ST_PLAYING; return;
    }
    while(true){
        if(tx < 1 || tx >= w.sizeX-1 || ty < 1 || ty >= w.sizeY-1) break;
        if(_dget(tx,ty) !== DC_TILE_WALL) break;
        _dset(tx, ty, DC_TILE_PATH);
        p.x = tx; p.y = ty;
        tx += dx; ty += dy;
    }
    p.holdable = DC_HOLD_FREE;
    _updateCamera();
    gameState = DC_ST_PLAYING;
}

// =============================================================================
// MONSTERS
// =============================================================================
function _moveMonsters(){
    for(const mon of monsters){
        if(mon.dead) continue;
        if(w.tmr % mon.interval >= 10) continue;
        let nx = mon.x, ny = mon.y;
        switch(mon.chara){
            case DC_MON_CHASER:
                if(_los(mon.x, mon.y, p.x, p.y)){
                    if     (nx > p.x) nx--;
                    else if(ny > p.y) ny--;
                    else if(nx < p.x) nx++;
                    else if(ny < p.y) ny++;
                } else {
                    const d = Math.floor(Math.random()*4);
                    if(d===0)ny--;else if(d===1)ny++;else if(d===2)nx--;else nx++;
                }
                break;
            case DC_MON_WANDERER: {
                const d = Math.floor(Math.random()*4);
                if(d===0)ny--;else if(d===1)ny++;else if(d===2)nx--;else nx++;
                break;
            }
            case DC_MON_GUARDIAN:
                if(Math.abs(mon.x - p.x) + Math.abs(mon.y - p.y) <= 10){
                    if(nx > p.x) nx--; else if(nx < p.x) nx++;
                    if(ny > p.y) ny--; else if(ny < p.y) ny++;
                } else {
                    const d = Math.floor(Math.random()*4);
                    if(d===0)ny--;else if(d===1)ny++;else if(d===2)nx--;else nx++;
                }
                break;
            case DC_MON_BAT:
                if(nx < 2)           mon.dirX =  1;
                if(ny < 2)           mon.dirY =  1;
                if(nx > w.sizeX - 3) mon.dirX = -1;
                if(ny > w.sizeY - 3) mon.dirY = -1;
                nx += mon.dirX; ny += mon.dirY;
                break;
        }
        let blocked = false;
        for(const o of monsters){
            if(o === mon || o.dead || o.chara === DC_MON_BAT) continue;
            if(o.x === nx && o.y === ny){ blocked = true; break; }
        }
        if(blocked) continue;
        if(_dget(nx,ny) !== DC_TILE_WALL || mon.chara === DC_MON_BAT){
            mon.x = nx; mon.y = ny;
            if(!mon.dead && mon.x === p.x && mon.y === p.y){ p.health--; mon.dead = true; }
        }
    }
}

// =============================================================================
// UPDATE
// =============================================================================
function _startCountdown(){
    gameState = DC_ST_COUNTDOWN;
    cdMsLeft  = DC_CD_MS; cdShown = Math.ceil(DC_CD_MS / 1000);
}

function _update(dt){
    if(gameState === DC_ST_IDLE) return;

    if(gameState === DC_ST_COUNTDOWN){
        cdMsLeft -= dt;
        if(cdMsLeft <= 0){ cdMsLeft = 0; cdShown = 0; gameState = DC_ST_PLAYING; w.tmr = 1; }
        else { cdShown = Math.ceil(cdMsLeft / 1000); }
        return;
    }

    if(gameState === DC_ST_LEVELCLEAR){
        levelClearMs += dt;
        if(levelClearMs >= DC_LEVEL_CLEAR_MS){
            levelClearMs = 0;
            _initDungeon();
            _startCountdown();
        }
        return;
    }

    if(gameState !== DC_ST_PLAYING && gameState !== DC_ST_DIGMODE) return;

    w.tmr    += dt;
    w.timeout = w.clock - Math.floor(w.tmr / 1000);

    if(w.timeout <= 0){
        gameState = DC_ST_TIMEOUT;
        if(p.score > pb){ pb = p.score; SHELL_setPB("dc_score", pb); }
        return;
    }
    if(p.health <= 0){
        gameState = DC_ST_DEAD;
        if(p.score > pb){ pb = p.score; SHELL_setPB("dc_score", pb); }
        return;
    }
    if(p.diamonds >= w.numDiamonds){
        p.score = Math.min(
            p.score + (w.level*50) + (w.timeout*10) + (p.health===3?300:0) + (p.holdable>DC_HOLD_FREE?150:0),
            9999999
        );
        if(p.score > pb){ pb = p.score; SHELL_setPB("dc_score", pb); }
        gameState    = DC_ST_LEVELCLEAR;
        levelClearMs = 0;
        return;
    }
    if(gameState === DC_ST_PLAYING) _moveMonsters();
}

// =============================================================================
// DRAWING
// =============================================================================
function _mf(sz){ return "bold " + sz + "px \"Courier New\",Consolas,monospace"; }
function _uf(sz){ return sz + "px Consolas,\"Lucida Console\",\"Courier New\",monospace"; }

function _cell(glyph, palIdx, cx, cy){
    const px = DC_BOARD_X + cx * DC_CELL;
    const py = DC_BOARD_Y + cy * DC_CELL;
    _cx.fillStyle = DC_CLR_CELL_BG;
    _cx.fillRect(px, py, DC_CELL, DC_CELL);
    if(!glyph || glyph === " ") return;
    if(glyph === DC_G_WALL){
        _cx.fillStyle = DC_PAL[palIdx] || "#FFF";
        _cx.fillRect(px, py, DC_CELL, DC_CELL);
        _cx.fillStyle = "rgba(0,0,0,0.25)";
        _cx.fillRect(px+1, py+1, DC_CELL-2, DC_CELL-2);
        return;
    }
    _cx.fillStyle    = DC_PAL[palIdx] || "#FFF";
    _cx.font         = _mf(12);
    _cx.textAlign    = "center";
    _cx.textBaseline = "middle";
    _cx.fillText(glyph, px + DC_CELL/2, py + DC_CELL/2 + 1);
    _cx.textAlign    = "left";
    _cx.textBaseline = "alphabetic";
}

function _drawDungeon(){
    const flash = (w.tmr % 500) < 100;
    for(let cy = 0; cy < DC_VIEW; cy++){
        for(let cx = 0; cx < DC_VIEW; cx++){
            const wx = cx + w.camX, wy = cy + w.camY;
            if(wx < 0 || wx >= w.sizeX || wy < 0 || wy >= w.sizeY){ _cell(" ", 0, cx, cy); continue; }
            const t = _dget(wx, wy);
            let g, c;
            switch(t){
                case DC_TILE_PATH:       g = " ";          c = 0;            break;
                case DC_TILE_WALL:       g = DC_G_WALL;    c = w.wallColor;  break;
                case DC_TILE_DIAMOND:    g = DC_G_DIAMOND;    c = flash?14:9; break;
                case DC_TILE_HEALTH:     g = DC_G_HEALTH;     c = 12;         break;
                case DC_TILE_TELEPORTER: g = DC_G_TELEPORTER; c = 11;         break;
                case DC_TILE_SHOVEL:     g = DC_G_SHOVEL;     c = 11;         break;
                default:                 g = " ";          c = 0;
            }
            _cell(g, c, cx, cy);
        }
    }
}

function _drawMonsters(){
    const col = (w.tmr % 500) < 100 ? 14 : 12;
    for(const mon of monsters){
        if(mon.dead) continue;
        const cx = mon.x - w.camX, cy = mon.y - w.camY;
        if(cx < 0 || cx >= DC_VIEW || cy < 0 || cy >= DC_VIEW) continue;
        let g;
        switch(mon.chara){
            case DC_MON_CHASER:   g = DC_G_CHASER;   break;
            case DC_MON_WANDERER: g = DC_G_WANDERER;  break;
            case DC_MON_GUARDIAN: g = DC_G_GUARDIAN;  break;
            case DC_MON_BAT:      g = DC_G_BAT;       break;
        }
        _cell(g, col, cx, cy);
    }
}

function _drawPlayer(){
    const cx = p.x - w.camX, cy = p.y - w.camY;
    if(cx < 0 || cx >= DC_VIEW || cy < 0 || cy >= DC_VIEW) return;
    _cell(DC_G_PLAYER, p.health > 0 ? 13 : 12, cx, cy);
}

function _sbT(txt, col, x, y, sz){
    _cx.fillStyle    = col;
    _cx.font         = _uf(sz || 14);
    _cx.textAlign    = "left";
    _cx.textBaseline = "alphabetic";
    _cx.fillText(txt, x, y);
}
function _sbG(g, col, x, y){
    _cx.fillStyle    = col;
    _cx.font         = _mf(14);
    _cx.textAlign    = "left";
    _cx.textBaseline = "alphabetic";
    _cx.fillText(g, x, y);
}

function _drawSidebar(){
    const sx = SHELL_BTN_X, sy = SHELL_SBY;
    _sbG(DC_G_DIAMOND, DC_PAL[9],  sx, sy+18);
    _sbT(" " + p.diamonds + "|" + w.numDiamonds, "#d7dde5", sx+14, sy+18);
    _sbG(DC_G_HEALTH.repeat(p.health) + "\u00B7".repeat(3 - p.health), DC_PAL[12], sx, sy+36);
    _sbT("TIME " + w.timeout, w.timeout > 19 ? "#d7dde5" : DC_PAL[12], sx, sy+54);
    _sbT("LVL  " + w.level,         "#d7dde5", sx, sy+72);
    _sbT("SCORE",                    "#93a0b3", sx, sy+90,  12);
    const sc   = p.score.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    _sbT(sc, DC_PAL[10], sx, sy+106);
    _sbT("BEST",                     "#93a0b3", sx, sy+124, 12);
    const pbsc = pb.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    _sbT(pbsc, DC_PAL[10], sx, sy+140);
    _sbT("HELD:", "#93a0b3", sx, sy+160, 12);
    if     (p.holdable === DC_HOLD_TELE)       { _sbG(DC_G_TELEPORTER, DC_PAL[11], sx, sy+176); _sbT(" TELE",   "#d7dde5", sx+12, sy+176); }
    else if(p.holdable === DC_HOLD_SHOVEL_ITEM){ _sbG(DC_G_SHOVEL,     DC_PAL[11], sx, sy+176); _sbT(" SHOVEL", "#d7dde5", sx+12, sy+176); }
    else                                        { _sbT("none", "#555555", sx, sy+176, 12); }
    if(gameState === DC_ST_DIGMODE){
        _cx.fillStyle    = DC_PAL[15];
        _cx.font         = "bold 12px Consolas,monospace";
        _cx.textAlign    = "left";
        _cx.textBaseline = "alphabetic";
        _cx.fillText("DIG WHERE? \u2191 \u2193 \u2190 \u2192", sx, SHELL_BTN_TOP_Y - 12);
    }
}

function _drawOverlay(msg, sub){
    _cx.globalAlpha = 0.72; _cx.fillStyle = "#000";
    _cx.fillRect(SHELL_PFX, SHELL_PFY, SHELL_PFW, SHELL_PFH);
    _cx.globalAlpha = 1.0;
    _cx.textAlign = "center";
    _cx.fillStyle = "#fff"; _cx.font = "28px Consolas,monospace";
    _cx.fillText(msg, SHELL_PFX + SHELL_PFW/2, SHELL_PFY + SHELL_PFH/2 - 10);
    _cx.fillStyle = "#93a0b3"; _cx.font = "12px Consolas,monospace";
    _cx.fillText(sub, SHELL_PFX + SHELL_PFW/2, SHELL_PFY + SHELL_PFH/2 + 14);
    _cx.textAlign = "left";
}

function _drawCountdown(){
    _cx.globalAlpha = 0.72; _cx.fillStyle = "#000";
    _cx.fillRect(SHELL_PFX, SHELL_PFY, SHELL_PFW, SHELL_PFH);
    _cx.globalAlpha = 1.0;
    _cx.textAlign = "center";
    _cx.fillStyle = "#fff"; _cx.font = "18px Consolas,monospace";
    _cx.fillText("GET READY", SHELL_PFX + SHELL_PFW/2, SHELL_PFY + SHELL_PFH/2 - 20);
    _cx.font = "40px Consolas,monospace";
    _cx.fillText(String(cdShown), SHELL_PFX + SHELL_PFW/2, SHELL_PFY + SHELL_PFH/2 + 26);
    _cx.textAlign = "left";
}

function _drawIdle(){
    _cx.fillStyle = DC_CLR_PF_BG;
    _cx.fillRect(SHELL_PFX, SHELL_PFY, SHELL_PFW, SHELL_PFH);
    const cx = SHELL_PFX + SHELL_PFW / 2;
    _cx.fillStyle = DC_PAL[7];  _cx.font = _uf(12); _cx.textAlign = "center";
    _cx.fillText("YOROKOBI-GAMES PRESENTS", cx, SHELL_PFY + 22);
    _cx.fillStyle = DC_PAL[15]; _cx.font = _mf(20);
    _cx.fillText("DUNGEON CRAWLER", cx, SHELL_PFY + 48);
    _cx.font = _mf(14); _cx.fillStyle = DC_PAL[12];
    _cx.fillText(DC_G_GUARDIAN + "  " + DC_G_CHASER + "  " + DC_G_WANDERER + "  " + DC_G_BAT, cx, SHELL_PFY + 68);
    _cx.fillStyle = DC_PAL[8];
    _cx.fillRect(SHELL_PFX + 16, SHELL_PFY + 76, SHELL_PFW - 32, 1);

    const lx = SHELL_PFX + 18;
    let   ly  = SHELL_PFY + 92;
    _cx.textAlign = "left";
    _cx.fillStyle = DC_PAL[7]; _cx.font = "bold 12px Consolas,monospace";
    _cx.fillText("ENEMIES", lx, ly); ly += 15;
    const eRows = [
        [DC_G_GUARDIAN, "G Guardian  hunts by smell (no LOS)"],
        [DC_G_CHASER,   "C Chaser    chases line-of-sight"],
        [DC_G_WANDERER, "W Wanderer  roams randomly"],
        [DC_G_BAT,      "% Bat       flies through walls"],
    ];
    _cx.font = "12px Consolas,monospace";
    for(const [g, label] of eRows){
        _cx.fillStyle = DC_PAL[12]; _cx.fillText(g, lx, ly);
        _cx.fillStyle = DC_PAL[7];  _cx.fillText("  " + label.slice(2), lx+12, ly);
        ly += 14;
    }
    _cx.fillStyle = DC_PAL[8]; _cx.fillRect(SHELL_PFX + 16, ly+2, SHELL_PFW - 32, 1); ly += 14;
    _cx.fillStyle = DC_PAL[7]; _cx.font = "bold 12px Consolas,monospace";
    _cx.fillText("ITEMS", lx, ly); ly += 15;
    const iRows = [
        [DC_G_DIAMOND,    DC_PAL[9],  "Collect all to complete the level"],
        [DC_G_HEALTH,     DC_PAL[12], "Restores 1 health (max 3)"],
        [DC_G_TELEPORTER, DC_PAL[11], "Pick up then Space to teleport"],
        [DC_G_SHOVEL,     DC_PAL[11], "Pick up, Space then arrow to dig"],
    ];
    _cx.font = "12px Consolas,monospace";
    for(const [g, col, label] of iRows){
        _cx.fillStyle = col;       _cx.fillText(g, lx, ly);
        _cx.fillStyle = DC_PAL[7]; _cx.fillText("  " + label, lx+12, ly);
        ly += 14;
    }
    _cx.fillStyle = DC_PAL[8]; _cx.fillRect(SHELL_PFX + 16, ly+2, SHELL_PFW - 32, 1); ly += 14;
    _cx.fillStyle = DC_PAL[7]; _cx.font = "12px Consolas,monospace";
    _cx.fillText("Arrows move   Space use item", lx, ly);
    _cx.textAlign = "left";
}

function _draw(){
    _cx.fillStyle = DC_CLR_CANVAS;
    _cx.fillRect(0, 0, SHELL_CW, SHELL_CH);
    _cx.fillStyle   = DC_CLR_PF_BG;
    _cx.fillRect(SHELL_PFX, SHELL_PFY, SHELL_PFW, SHELL_PFH);
    _cx.strokeStyle = DC_CLR_PF_BORD; _cx.lineWidth = 2;
    _cx.strokeRect(SHELL_PFX, SHELL_PFY, SHELL_PFW, SHELL_PFH);

    if(gameState === DC_ST_IDLE){
        _drawIdle();
        _drawSidebar();
        return;
    }

    _cx.save();
    _cx.beginPath(); _cx.rect(SHELL_PFX, SHELL_PFY, SHELL_PFW, SHELL_PFH); _cx.clip();
    _drawDungeon();
    _drawMonsters();
    _drawPlayer();
    _cx.restore();

    _drawSidebar();

    if(gameState === DC_ST_COUNTDOWN)  _drawCountdown();
    if(gameState === DC_ST_DEAD)       _drawOverlay("YOU DIED!",    "Press RESET for a new run");
    if(gameState === DC_ST_TIMEOUT)    _drawOverlay("TIME UP!",     "Press RESET for a new run");
    if(gameState === DC_ST_LEVELCLEAR) _drawOverlay("LEVEL CLEAR!", "Next level in a moment...");
}