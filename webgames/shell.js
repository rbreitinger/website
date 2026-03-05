// =============================================================================
// shell.js — universal game shell
// Lives at:  ./webgames/shell.js
// Usage:     shell.html?game=flappy
//            → loads ./webgames/flappy/flappy.js
//
// Each game script must expose a global GAME object:
//
//   const GAME = {
//       title:       "My Game",
//       subtitle:    "Arrows · Space",
//       resetLabel:  "RESET",        // optional; overrides the RESET button label
//       init(canvas)    { },         // called once after load; show idle state
//       start()         { },         // called when START clicked
//       reset()         { },         // called when RESET clicked; restart immediately
//       update(dt)      { },         // dt in ms; shell calls at fixed 10 ms steps
//       draw()          { },         // render everything except the two buttons
//       onClick(mx, my) { },         // optional; canvas tap/click outside buttons
//       onSwipe(dir)    { },         // optional; dir = "up"|"down"|"left"|"right"
//   };
//
// Shell contract:
//   - Shell owns the RAF loop; calls update(dt) + draw() every frame
//   - Shell draws START/RESET buttons ON TOP of the canvas after draw()
//   - Games must not draw in the button area (sidebar y > 208)
//   - Games must not start logic until start() is called
//   - reset() always restarts immediately (no return to idle)
//   - onClick(mx,my) receives canvas-space coords; fired on tap/click outside buttons
//   - onSwipe(dir) receives direction string; fired when touch drag exceeds threshold
// =============================================================================

// ---------- shell color palette (edit here to retheme) ----------
const CLR_BG                = "#f5f9fc";
const CLR_BTN_ACTIVE        = "#0078d4";
const CLR_BTN_IDLE          = "#ddeef8";
const CLR_BTN_BORDER_ACTIVE = "#005a9e";
const CLR_BTN_BORDER_IDLE   = "#b0c4d8";
const CLR_BTN_TEXT_ACTIVE   = "#ffffff";
const CLR_BTN_TEXT_IDLE     = "#8a9ab0";
const CLR_ERROR             = "#cc2200";

const canvas  = document.getElementById("gameCanvas");
const ctx     = canvas.getContext("2d");
const titleEl = document.getElementById("gameTitle");
const subEl   = document.getElementById("gameSubtitle");

// ---------- layout constants (games may read these too) ----------
const SHELL_CW  = 560, SHELL_CH  = 320; // shell width/height
const SHELL_PFX = 16, SHELL_PFY = 16, SHELL_PFW = 360, SHELL_PFH = 288; // play field
const SHELL_SBX = 400, SHELL_SBY = 16, SHELL_SBW = 160; // score board and controls panel

// button geometry
const BTN_W       = 136;
const BTN_H       = 30;
const BTN_X       = SHELL_SBX + Math.floor((SHELL_SBW - BTN_W) / 2);  // 412
const BTN_START_Y = SHELL_SBY + 214;
const BTN_RESET_Y = SHELL_SBY + 252;

const SHELL_BTN_X     = BTN_X;
const SHELL_BTN_TOP_Y = BTN_START_Y;

// ---------- personal best storage ----------
function SHELL_getPB(key)        { try{ return JSON.parse(localStorage.getItem("pb_"+key)); }catch(e){ return null; } }
function SHELL_setPB(key, value) { try{ localStorage.setItem("pb_"+key, JSON.stringify(value)); }catch(e){} }

const BTN_START = { x: BTN_X, y: BTN_START_Y, w: BTN_W, h: BTN_H };
const BTN_RESET = { x: BTN_X, y: BTN_RESET_Y, w: BTN_W, h: BTN_H };

// ---------- shell phase ----------
let shellPhase = "idle";

// ---------- fixed-step timing ----------
const SHELL_STEP_MS = 10;
let accMs  = 0;
let lastTs = 0;

// ---------- game loading ----------
function loadGame(gameId){
    const script  = document.createElement("script");
    script.src    = gameId + "/" + gameId + ".js";
    script.onload = () => {
        if(typeof GAME === "undefined"){
            showError("Game loaded but GAME object not found.");
            return;
        }
        titleEl.textContent = GAME.title    || gameId;
        subEl.textContent   = GAME.subtitle || "";
        document.title      = GAME.title    || gameId;
        GAME.init(canvas);
        requestAnimationFrame(loop);
    };
    script.onerror = () => showError("Could not load: " + gameId + "/" + gameId + ".js");
    document.body.appendChild(script);
}

function showError(msg){
    titleEl.textContent = "Error";
    ctx.fillStyle = CLR_BG;
    ctx.fillRect(0, 0, SHELL_CW, SHELL_CH);
    ctx.fillStyle    = CLR_ERROR;
    ctx.font         = "14px Consolas,monospace";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(msg, SHELL_CW / 2, SHELL_CH / 2);
    ctx.textAlign    = "left";
    ctx.textBaseline = "alphabetic";
}

// ---------- buttons ----------
function drawBtn(btn, label, active){
    ctx.fillStyle = active ? CLR_BTN_ACTIVE : CLR_BTN_IDLE;
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
    ctx.strokeStyle = active ? CLR_BTN_BORDER_ACTIVE : CLR_BTN_BORDER_IDLE;
    ctx.lineWidth   = 1;
    ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);
    ctx.fillStyle    = active ? CLR_BTN_TEXT_ACTIVE : CLR_BTN_TEXT_IDLE;
    ctx.font         = "13px Consolas,'Lucida Console',monospace";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2);
    ctx.textAlign    = "left";
    ctx.textBaseline = "alphabetic";
}

function drawButtons(){
    const resetLabel = (typeof GAME !== "undefined" && GAME.resetLabel) || "RESET";
    drawBtn(BTN_START, "START",     shellPhase === "idle");
    drawBtn(BTN_RESET, resetLabel,  shellPhase === "running");
}

// ---------- shared input handler ----------
function ptInBtn(mx, my, btn){
    return mx >= btn.x && my >= btn.y && mx < btn.x + btn.w && my < btn.y + btn.h;
}

function handleButtonInput(mx, my){
    if(ptInBtn(mx, my, BTN_START) && shellPhase === "idle"){
        shellPhase = "running";
        GAME.start();
        return true;
    }
    if(ptInBtn(mx, my, BTN_RESET) && shellPhase === "running"){
        GAME.reset();
        return true;
    }
    return false;
}

// ---------- mouse ----------
canvas.addEventListener("mousedown", e => {
    const rc = canvas.getBoundingClientRect();
    const mx = (e.clientX - rc.left) * (SHELL_CW / rc.width);
    const my = (e.clientY - rc.top)  * (SHELL_CH / rc.height);
    if(handleButtonInput(mx, my)) return;
    if(typeof GAME !== "undefined" && typeof GAME.onClick === "function")
        GAME.onClick(mx, my);
});

// ---------- touch ----------
const SWIPE_MIN_PX = 20;  // minimum canvas-px drag to count as a swipe
let _touchStartX = 0, _touchStartY = 0, _touchWasButton = false;

canvas.addEventListener("touchstart", e => {
    e.preventDefault();
    const rc = canvas.getBoundingClientRect();
    const t  = e.changedTouches[0];
    const mx = (t.clientX - rc.left) * (SHELL_CW / rc.width);
    const my = (t.clientY - rc.top)  * (SHELL_CH / rc.height);
    _touchStartX = mx;
    _touchStartY = my;
    // buttons respond on touchstart for snappy feel
    _touchWasButton = handleButtonInput(mx, my);
}, { passive: false });

canvas.addEventListener("touchend", e => {
    e.preventDefault();
    if(_touchWasButton) return;
    const rc = canvas.getBoundingClientRect();
    const t  = e.changedTouches[0];
    const mx = (t.clientX - rc.left) * (SHELL_CW / rc.width);
    const my = (t.clientY - rc.top)  * (SHELL_CH / rc.height);
    const dx = mx - _touchStartX;
    const dy = my - _touchStartY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if(dist >= SWIPE_MIN_PX){
        if(typeof GAME !== "undefined" && typeof GAME.onSwipe === "function"){
            let dir;
            if(Math.abs(dx) >= Math.abs(dy)) dir = dx > 0 ? "right" : "left";
            else                             dir = dy > 0 ? "down"  : "up";
            GAME.onSwipe(dir);
        }
    } else {
        if(typeof GAME !== "undefined" && typeof GAME.onClick === "function")
            GAME.onClick(mx, my);
    }
}, { passive: false });

// ---------- RAF loop ----------
function loop(ts){
    if(!lastTs) lastTs = ts;
    let delta = ts - lastTs;
    lastTs = ts;
    if(delta > 250) delta = 250;

    accMs += delta;
    while(accMs >= SHELL_STEP_MS){
        GAME.update(SHELL_STEP_MS);
        accMs -= SHELL_STEP_MS;
    }

    GAME.draw();
    drawButtons();
    requestAnimationFrame(loop);
}

// ---------- boot ----------
(function boot(){
    const params = new URLSearchParams(window.location.search);
    const gameId = params.get("game");
    if(!gameId){
        showError("No game specified.  Use: shell.html?game=flappy");
        requestAnimationFrame(() => {
            ctx.fillStyle = CLR_BG;
            ctx.fillRect(0, 0, SHELL_CW, SHELL_CH);
            drawButtons();
        });
        return;
    }
    loadGame(gameId);
}());