/* ============================================================================
   DEVTEST.JS  —  game-phone shell sandbox / demo
   Not a real game. Tests all phone shell input contracts and shell APIs:
     onClick      — tap to spawn a bouncing ball; also handles on-canvas reset
     onDragStart  — finger down: show a pulsing origin dot
     onDrag       — finger moving: draw a live line from origin to finger
     onDragEnd    — finger lifted after confirmed drag: clear the line
     onSwipe      — fires after onDragEnd when gesture qualifies: show arrow
     SHELL_isMuted / SHELL_getPB / SHELL_setPB / SHELL_setTitle

   Audio files live in webgames/devtest/ (unchanged from before):
     spawn.ogg   bounce.ogg   bgm.ogg

   On-canvas reset button: drawn in top-right corner of the canvas.
   Games that need a reset action draw it themselves and handle it in onClick.

   Prefix: DVT_
   Canvas: 360 × 596  (PHN_CW / PHN_CH)
   ============================================================================ */

/* --------------------------------------------------------------------------
   CONSTANTS
   -------------------------------------------------------------------------- */

var DVT_MAX_BALLS = 30;
var DVT_GRAVITY   = 0.18;
var DVT_DAMPEN    = 0.72;
var DVT_MIN_SPEED = 0.4;

var DVT_COLORS = [
    "#0078d4", "#1e9e4a", "#c0392b", "#e67e22",
    "#8e44ad", "#16a085", "#2980b9", "#d35400"
];

var DVT_ARROWS = {
    up:    "\u2191",
    down:  "\u2193",
    left:  "\u2190",
    right: "\u2192"
};

/* On-canvas reset button dimensions (top-right area) */
var DVT_RST_X  = 270;   /* left edge  */
var DVT_RST_Y  = 8;     /* top edge   */
var DVT_RST_W  = 82;    /* width      */
var DVT_RST_H  = 30;    /* height     */

/* --------------------------------------------------------------------------
   AUDIO
   -------------------------------------------------------------------------- */

var DVT_sndSpawn  = new Audio("devtest/spawn.ogg");
var DVT_sndBounce = new Audio("devtest/bounce.ogg");
var DVT_sndBgm    = new Audio("devtest/bgm.ogg");

DVT_sndBgm.loop   = true;
DVT_sndBgm.volume = 0.45;

function DVT_sndPlay(snd) {
    if (SHELL_isMuted()) return;
    snd.currentTime = 0;
    snd.play().catch(function () {});
}

function DVT_bgmSync() {
    if (SHELL_isMuted()) {
        if (!DVT_sndBgm.paused) DVT_sndBgm.pause();
    } else {
        if (DVT_sndBgm.paused) DVT_sndBgm.play().catch(function () {});
    }
}

/* --------------------------------------------------------------------------
   STATE
   -------------------------------------------------------------------------- */

var DVT_canvas  = null;
var DVT_ctx     = null;

var DVT_balls   = [];
var DVT_spawnCt = 0;
var DVT_bestCt  = 0;

/* Drag line — set by onDragStart / onDrag, cleared by onDragEnd / onSwipe */
var DVT_dragLine = null;    /* { sx, sy, ex, ey } or null */

/* Touch-down dot (onDragStart indicator) — fades over DVT_DOT_LIFE ms */
var DVT_dotX     = 0;
var DVT_dotY     = 0;
var DVT_dotAge   = -1;
var DVT_DOT_LIFE = 500;

/* Swipe indicator — large arrow that fades over DVT_SWIPE_LIFE ms */
var DVT_swipeDir  = "";
var DVT_swipeAge  = -1;
var DVT_SWIPE_LIFE = 1400;

/* Last recognised input event — shown in HUD */
var DVT_lastInput = "none";

var DVT_running = false;

/* --------------------------------------------------------------------------
   BALL FACTORY
   -------------------------------------------------------------------------- */

function DVT_makeBall(bx, by) {
    var colIdx = DVT_balls.length % DVT_COLORS.length;
    var rad    = 8 + Math.floor(Math.random() * 12);
    var spd    = 2.0 + Math.random() * 3.0;
    var ang    = -Math.PI * (0.35 + Math.random() * 0.3);
    return {
        bx:         bx,
        by:         by,
        vx:         Math.cos(ang) * spd * (Math.random() < 0.5 ? 1 : -1),
        vy:         Math.sin(ang) * spd,
        rad:        rad,
        col:        DVT_COLORS[colIdx],
        age:        0,
        bounceCool: 0
    };
}

/* --------------------------------------------------------------------------
   HELPERS
   -------------------------------------------------------------------------- */

function DVT_checkBest() {
    var cnt = DVT_balls.length;
    if (cnt > DVT_bestCt) {
        DVT_bestCt = cnt;
        SHELL_setPB("devtest_best", DVT_bestCt);
    }
}

/* Returns true if (px, py) falls inside the on-canvas reset button. */
function DVT_hitReset(px, py) {
    return px >= DVT_RST_X && px <= DVT_RST_X + DVT_RST_W &&
           py >= DVT_RST_Y && py <= DVT_RST_Y + DVT_RST_H;
}

/* Rounded rectangle path helper */
function DVT_roundRect(ctx, rx, ry, rw, rh, rr) {
    ctx.beginPath();
    ctx.moveTo(rx + rr, ry);
    ctx.lineTo(rx + rw - rr, ry);
    ctx.arcTo(rx + rw, ry,      rx + rw, ry + rr,      rr);
    ctx.lineTo(rx + rw, ry + rh - rr);
    ctx.arcTo(rx + rw, ry + rh, rx + rw - rr, ry + rh, rr);
    ctx.lineTo(rx + rr, ry + rh);
    ctx.arcTo(rx,       ry + rh, rx,       ry + rh - rr, rr);
    ctx.lineTo(rx,      ry + rr);
    ctx.arcTo(rx,       ry,      rx + rr,  ry,           rr);
    ctx.closePath();
}

/* --------------------------------------------------------------------------
   GAME OBJECT CONTRACT
   -------------------------------------------------------------------------- */

var GAME = {
    title: "Phone Shell Test",

    init: function (canvas) {
        DVT_canvas = canvas;
        DVT_ctx    = canvas.getContext("2d");

        var pb = SHELL_getPB("devtest_best");
        DVT_bestCt = (pb !== null) ? pb : 0;
    },

    start: function () {
        DVT_running   = true;
        DVT_balls     = [];
        DVT_spawnCt   = 0;
        DVT_dragLine  = null;
        DVT_dotAge    = -1;
        DVT_swipeAge  = -1;
        DVT_lastInput = "none";
        if (!SHELL_isMuted()) DVT_sndBgm.play().catch(function () {});
    },

    /* ------------------------------------------------------------------ */
    update: function (dt) {
        if (!DVT_running) return;

        DVT_bgmSync();

        if (DVT_dotAge >= 0) {
            DVT_dotAge += dt;
            if (DVT_dotAge >= DVT_DOT_LIFE) DVT_dotAge = -1;
        }

        if (DVT_swipeAge >= 0) {
            DVT_swipeAge += dt;
            if (DVT_swipeAge >= DVT_SWIPE_LIFE) DVT_swipeAge = -1;
        }

        var cw = DVT_canvas.width;
        var ch = DVT_canvas.height;
        var bi, b;

        for (bi = 0; bi < DVT_balls.length; bi++) {
            b = DVT_balls[bi];
            b.age += dt;
            if (b.bounceCool > 0) b.bounceCool--;

            b.vy += DVT_GRAVITY;
            b.bx += b.vx;
            b.by += b.vy;

            if (b.by + b.rad >= ch) {
                b.by = ch - b.rad;
                if (b.bounceCool === 0 && Math.abs(b.vy) > 1.2) {
                    DVT_sndPlay(DVT_sndBounce);
                    b.bounceCool = 18;
                }
                b.vy *= -DVT_DAMPEN;
                b.vx *=  DVT_DAMPEN;
                if (Math.abs(b.vy) < DVT_MIN_SPEED) b.vy = 0;
            }

            if (b.by - b.rad <= 0) {
                b.by = b.rad;
                b.vy *= -DVT_DAMPEN;
            }

            if (b.bx - b.rad <= 0) {
                b.bx = b.rad;
                b.vx *= -DVT_DAMPEN;
            }

            if (b.bx + b.rad >= cw) {
                b.bx = cw - b.rad;
                b.vx *= -DVT_DAMPEN;
            }
        }
    },

    /* ------------------------------------------------------------------ */
    draw: function () {
        if (!DVT_ctx) return;

        var ctx = DVT_ctx;
        var cw  = DVT_canvas.width;     /* 360 */
        var ch  = DVT_canvas.height;    /* 596 */

        /* ---- background ---- */
        ctx.fillStyle = "#c8dff0";
        ctx.fillRect(0, 0, cw, ch);

        ctx.strokeStyle = "rgba(0,120,212,0.07)";
        ctx.lineWidth   = 1;
        var gx, gy;
        for (gx = 0; gx <= cw; gx += 60) {
            ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, ch); ctx.stroke();
        }
        for (gy = 0; gy <= ch; gy += 60) {
            ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(cw, gy); ctx.stroke();
        }

        /* canvas size label */
        ctx.fillStyle = "rgba(0,120,212,0.30)";
        ctx.font      = "bold 12px 'Segoe UI', sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("360 \xd7 596  \u2014  (0,0) top-left", 8, 18);

        /* ---- on-canvas reset button ---- */
        ctx.fillStyle   = "rgba(255,255,255,0.82)";
        ctx.strokeStyle = "#b0c4d8";
        ctx.lineWidth   = 1;
        DVT_roundRect(ctx, DVT_RST_X, DVT_RST_Y, DVT_RST_W, DVT_RST_H, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#1c2333";
        ctx.font      = "bold 12px 'Segoe UI', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("CLEAR", DVT_RST_X + DVT_RST_W / 2, DVT_RST_Y + 20);

        /* ---- balls ---- */
        var bi, b, alpha;
        for (bi = 0; bi < DVT_balls.length; bi++) {
            b     = DVT_balls[bi];
            alpha = Math.min(1, b.age / 120);

            ctx.globalAlpha = alpha;
            ctx.fillStyle   = b.col;
            ctx.beginPath();
            ctx.arc(b.bx, b.by, b.rad, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "rgba(255,255,255,0.30)";
            ctx.beginPath();
            ctx.arc(b.bx - b.rad * 0.28, b.by - b.rad * 0.28, b.rad * 0.38, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        /* ---- touch-down dot (onDragStart indicator) ---- */
        if (DVT_dotAge >= 0) {
            var dotFade = 1 - DVT_dotAge / DVT_DOT_LIFE;
            ctx.globalAlpha = dotFade * 0.75;
            ctx.fillStyle   = "#f0c040";
            ctx.beginPath();
            ctx.arc(DVT_dotX, DVT_dotY, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#c08000";
            ctx.lineWidth   = 2;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        /* ---- drag line (onDrag indicator) ---- */
        if (DVT_dragLine !== null) {
            ctx.strokeStyle = "#e8a020";
            ctx.lineWidth   = 3;
            ctx.lineCap     = "round";
            ctx.beginPath();
            ctx.moveTo(DVT_dragLine.sx, DVT_dragLine.sy);
            ctx.lineTo(DVT_dragLine.ex, DVT_dragLine.ey);
            ctx.stroke();

            ctx.fillStyle = "#e8a020";
            ctx.beginPath();
            ctx.arc(DVT_dragLine.sx, DVT_dragLine.sy, 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.arc(DVT_dragLine.ex, DVT_dragLine.ey, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        /* ---- swipe indicator (onSwipe) ---- */
        if (DVT_swipeAge >= 0 && DVT_swipeDir !== "") {
            var swipeFade = 1 - DVT_swipeAge / DVT_SWIPE_LIFE;
            ctx.globalAlpha = swipeFade;

            ctx.fillStyle = "#0078d4";
            ctx.font      = "bold 96px 'Segoe UI', sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(DVT_ARROWS[DVT_swipeDir] || "?", cw / 2, ch / 2 + 30);

            ctx.fillStyle = "#1c2333";
            ctx.font      = "bold 18px 'Segoe UI', sans-serif";
            ctx.fillText(DVT_swipeDir.toUpperCase(), cw / 2, ch / 2 + 66);

            ctx.globalAlpha = 1;
        }

        /* ---- HUD panel (bottom-right) ---- */
        var panW = 168;
        var panH = 116;
        var panX = cw - panW - 8;
        var panY = ch - panH - 8;

        ctx.fillStyle   = "rgba(255,255,255,0.82)";
        ctx.strokeStyle = "#b0c4d8";
        ctx.lineWidth   = 1;
        DVT_roundRect(ctx, panX, panY, panW, panH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#1c2333";
        ctx.font      = "bold 12px 'Segoe UI', sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("Balls on screen : " + DVT_balls.length,  panX + 10, panY + 20);
        ctx.fillText("Total spawned   : " + DVT_spawnCt,       panX + 10, panY + 36);
        ctx.fillText("Best (max live) : " + DVT_bestCt,        panX + 10, panY + 52);
        ctx.fillText("Last input      : " + DVT_lastInput,     panX + 10, panY + 68);

        var sndLabel = (typeof SHELL_isMuted === "function" && SHELL_isMuted())
            ? "\uD83D\uDD07 muted"
            : "\uD83D\uDD0A sound on";
        ctx.fillStyle = "#5a6a80";
        ctx.font      = "11px 'Segoe UI', sans-serif";
        ctx.fillText(sndLabel,           panX + 10, panY + 86);
        ctx.fillText("shell: game-phone", panX + 10, panY + 100);

        /* ---- idle hint ---- */
        if (DVT_balls.length === 0 && DVT_dotAge < 0 && DVT_swipeAge < 0 && DVT_dragLine === null) {
            ctx.fillStyle = "#0078d4";
            ctx.font      = "bold 18px 'Segoe UI', sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Tap to spawn balls", cw / 2, ch / 2 - 36);

            ctx.fillStyle = "#5a6a80";
            ctx.font      = "13px 'Segoe UI', sans-serif";
            ctx.fillText("Drag to draw a line", cw / 2, ch / 2 - 12);
            ctx.fillText("Swipe to show direction", cw / 2, ch / 2 + 10);
            ctx.fillText("Tap CLEAR to reset", cw / 2, ch / 2 + 32);
        }
    },

    /* ------------------------------------------------------------------ */
    /*  INPUT CONTRACT                                                      */
    /* ------------------------------------------------------------------ */

    /* Tap: check reset button first, then spawn a ball. */
    onClick: function (mx, my) {
        if (DVT_hitReset(mx, my)) {
            DVT_balls     = [];
            DVT_spawnCt   = 0;
            DVT_dragLine  = null;
            DVT_dotAge    = -1;
            DVT_swipeAge  = -1;
            DVT_lastInput = "tap:clear";
            return;
        }
        if (DVT_balls.length >= DVT_MAX_BALLS) DVT_balls.shift();
        DVT_balls.push(DVT_makeBall(mx, my));
        DVT_spawnCt++;
        DVT_checkBest();
        DVT_sndPlay(DVT_sndSpawn);
        DVT_lastInput = "tap";
    },

    /* Finger touched down — show origin dot, start drag line. */
    onDragStart: function (mx, my) {
        DVT_dotX     = mx;
        DVT_dotY     = my;
        DVT_dotAge   = 0;
        DVT_dragLine = { sx: mx, sy: my, ex: mx, ey: my };
        DVT_lastInput = "dragStart";
    },

    /* Finger moving — update drag line endpoint. */
    onDrag: function (mx, my) {
        if (DVT_dragLine !== null) {
            DVT_dragLine.ex = mx;
            DVT_dragLine.ey = my;
        }
        DVT_lastInput = "drag";
    },

    /* Finger lifted after confirmed drag (also fires before onSwipe). */
    onDragEnd: function (mx, my) {
        DVT_dragLine  = null;
        DVT_lastInput = "dragEnd";
    },

    /* Fires after onDragEnd when the drag distance qualifies as a swipe. */
    onSwipe: function (dir) {
        DVT_swipeDir  = dir;
        DVT_swipeAge  = 0;
        DVT_lastInput = "swipe:" + dir;
    }
};
