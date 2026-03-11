/* ============================================================================
   DEVTEST.JS  —  game-v2 shell sandbox / demo
   Not a real game. Tests: canvas size, update/draw loop, onClick input,
   reset, SHELL_isMuted(), SHELL_getPB / SHELL_setPB, and audio gating.

   Audio files (in webgames/devtest/):
     spawn.ogg   — played on each ball spawn
     bounce.ogg  — played on floor impact (cooldown prevents spam)
     bgm.ogg     — looping background music, paused/resumed via mute toggle

   Prefix: DVT_
   Canvas: 960 × 640  (V2_CW / V2_CH)
   ============================================================================ */

/* --------------------------------------------------------------------------
   CONSTANTS
   -------------------------------------------------------------------------- */

var DVT_MAX_BALLS  = 60;
var DVT_GRAVITY    = 0.18;      /* px per ms² applied each fixed step        */
var DVT_DAMPEN     = 0.72;      /* velocity dampen on floor / wall bounce     */
var DVT_MIN_SPEED  = 0.4;       /* below this a resting ball gets a nudge     */

/* colour palette matching the portal */
var DVT_COLORS = [
    "#0078d4", "#1e9e4a", "#c0392b", "#e67e22",
    "#8e44ad", "#16a085", "#2980b9", "#d35400"
];

/* --------------------------------------------------------------------------
   AUDIO
   Paths are relative to webgames/ (base tag in game-v2.html handles this).
   -------------------------------------------------------------------------- */

var DVT_sndSpawn  = new Audio("devtest/spawn.ogg");
var DVT_sndBounce = new Audio("devtest/bounce.ogg");
var DVT_sndBgm    = new Audio("devtest/bgm.ogg");

DVT_sndBgm.loop   = true;
DVT_sndBgm.volume = 0.45;      /* keep BGM a little quieter than sfx         */

/* Play a one-shot sound, respecting the mute toggle. */
function DVT_sndPlay(snd) {
    if (SHELL_isMuted()) return;
    snd.currentTime = 0;
    snd.play().catch(function () {});
}

/* Called from update — starts / pauses BGM to match mute state in real time. */
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
var DVT_balls   = [];       /* array of ball objects                          */
var DVT_spawnCt = 0;        /* total spawned this session — for display       */
var DVT_bestCt  = 0;        /* personal best: most balls on screen at once    */
var DVT_running = false;

/* --------------------------------------------------------------------------
   BALL OBJECT FACTORY  (procedural — no new / class)
   -------------------------------------------------------------------------- */

function DVT_makeBall(bx, by) {
    var colIdx = DVT_balls.length % DVT_COLORS.length;
    var rad    = 10 + Math.floor(Math.random() * 14);   /* 10..23 px         */
    var spd    = 2.5 + Math.random() * 3.5;
    var ang    = -Math.PI * (0.35 + Math.random() * 0.3); /* upward burst    */
    return {
        bx:  bx,
        by:  by,
        vx:  Math.cos(ang) * spd * (Math.random() < 0.5 ? 1 : -1),
        vy:  Math.sin(ang) * spd,
        rad: rad,
        col: DVT_COLORS[colIdx],
        age: 0,         /* ms since spawn, used for fade-in                  */
        bounceCool: 0   /* steps remaining before bounce sfx allowed again   */
    };
}

/* --------------------------------------------------------------------------
   SHELL CONTACT
   -------------------------------------------------------------------------- */

function DVT_checkBest() {
    var cnt = DVT_balls.length;
    if (cnt > DVT_bestCt) {
        DVT_bestCt = cnt;
        SHELL_setPB("devtest_best", DVT_bestCt);
    }
}

/* --------------------------------------------------------------------------
   HELPERS
   -------------------------------------------------------------------------- */

/* Draws a rounded rectangle path. Call fill() / stroke() after. */
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
    title:      "Development Test",
    resetLabel: "CLEAR",

    init: function (canvas) {
        DVT_canvas = canvas;
        DVT_ctx    = canvas.getContext("2d");

        /* Load personal best */
        var pb = SHELL_getPB("devtest_best");
        DVT_bestCt = (pb !== null) ? pb : 0;
    },

    start: function () {
        DVT_running = true;
        DVT_balls   = [];
        DVT_spawnCt = 0;
        SHELL_showReset(true);
        /* BGM starts here — browser allows it because start() is triggered
           by the user clicking "Start Game" on the preview screen.          */
        if (!SHELL_isMuted()) DVT_sndBgm.play().catch(function () {});
    },

    reset: function () {
        DVT_balls   = [];
        DVT_spawnCt = 0;
        /* keep bestCt — reset doesn't wipe the personal best */
        /* BGM keeps playing through reset — no interruption  */
    },

    update: function (dt) {
        if (!DVT_running) return;

        /* keep BGM in sync with mute toggle */
        DVT_bgmSync();

        var cw = DVT_canvas.width;
        var ch = DVT_canvas.height;
        var bi, b;

        for (bi = 0; bi < DVT_balls.length; bi++) {
            b = DVT_balls[bi];
            b.age += dt;
            if (b.bounceCool > 0) b.bounceCool--;

            /* gravity */
            b.vy += DVT_GRAVITY;

            /* move */
            b.bx += b.vx;
            b.by += b.vy;

            /* floor */
            if (b.by + b.rad >= ch) {
                b.by = ch - b.rad;
                /* only play bounce sfx when impact is meaningful and cooldown expired */
                if (b.bounceCool === 0 && Math.abs(b.vy) > 1.2) {
                    DVT_sndPlay(DVT_sndBounce);
                    b.bounceCool = 18;  /* ~180 ms silence after each bounce  */
                }
                b.vy *= -DVT_DAMPEN;
                b.vx *=  DVT_DAMPEN;
                if (Math.abs(b.vy) < DVT_MIN_SPEED) b.vy = 0;
            }

            /* ceiling */
            if (b.by - b.rad <= 0) {
                b.by = b.rad;
                b.vy *= -DVT_DAMPEN;
            }

            /* left wall */
            if (b.bx - b.rad <= 0) {
                b.bx = b.rad;
                b.vx *= -DVT_DAMPEN;
            }

            /* right wall */
            if (b.bx + b.rad >= cw) {
                b.bx = cw - b.rad;
                b.vx *= -DVT_DAMPEN;
            }
        }
    },

    draw: function () {
        if (!DVT_ctx) return;

        var ctx = DVT_ctx;
        var cw  = DVT_canvas.width;
        var ch  = DVT_canvas.height;

        /* ---- background ---- */
        ctx.fillStyle = "#c8dff0";
        ctx.fillRect(0, 0, cw, ch);

        /* subtle grid to show off the full canvas area */
        ctx.strokeStyle = "rgba(0,120,212,0.07)";
        ctx.lineWidth   = 1;
        var gx, gy;
        for (gx = 0; gx <= cw; gx += 60) {
            ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, ch); ctx.stroke();
        }
        for (gy = 0; gy <= ch; gy += 60) {
            ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(cw, gy); ctx.stroke();
        }

        /* ---- canvas size label (top-left corner) ---- */
        ctx.fillStyle   = "rgba(0,120,212,0.30)";
        ctx.font        = "bold 13px 'Segoe UI', sans-serif";
        ctx.textAlign   = "left";
        ctx.fillText("960 \xd7 640  \u2014  (0,0) top-left", 10, 20);

        /* ---- balls ---- */
        var bi, b, alpha;
        for (bi = 0; bi < DVT_balls.length; bi++) {
            b     = DVT_balls[bi];
            alpha = Math.min(1, b.age / 120);   /* 120 ms fade-in            */

            ctx.globalAlpha = alpha;
            ctx.fillStyle   = b.col;
            ctx.beginPath();
            ctx.arc(b.bx, b.by, b.rad, 0, Math.PI * 2);
            ctx.fill();

            /* small white highlight */
            ctx.fillStyle = "rgba(255,255,255,0.30)";
            ctx.beginPath();
            ctx.arc(b.bx - b.rad * 0.28, b.by - b.rad * 0.28, b.rad * 0.38, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        /* ---- HUD panel (bottom-right) ---- */
        var panX = cw - 220;
        var panY = ch - 90;

        ctx.fillStyle   = "rgba(255,255,255,0.82)";
        ctx.strokeStyle = "#b0c4d8";
        ctx.lineWidth   = 1;
        DVT_roundRect(ctx, panX, panY, 210, 80, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#1c2333";
        ctx.font      = "bold 13px 'Segoe UI', sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("Balls on screen : " + DVT_balls.length,    panX + 12, panY + 22);
        ctx.fillText("Total spawned   : " + DVT_spawnCt,         panX + 12, panY + 40);
        ctx.fillText("Best (max live) : " + DVT_bestCt,          panX + 12, panY + 58);

        /* sound status */
        var sndLabel = (typeof SHELL_isMuted === "function" && SHELL_isMuted())
            ? "\uD83D\uDD07 muted"
            : "\uD83D\uDD0A sound on";
        ctx.fillStyle = "#5a6a80";
        ctx.font      = "12px 'Segoe UI', sans-serif";
        ctx.fillText(sndLabel, panX + 12, panY + 72);

        /* ---- idle hint (no balls yet) ---- */
        if (DVT_balls.length === 0) {
            ctx.fillStyle = "#0078d4";
            ctx.font      = "bold 22px 'Segoe UI', sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Click anywhere on the canvas to spawn balls", cw / 2, ch / 2 - 14);
            ctx.fillStyle = "#5a6a80";
            ctx.font      = "14px 'Segoe UI', sans-serif";
            ctx.fillText("Use the Reset button in the title bar to clear", cw / 2, ch / 2 + 16);
        }
    },

    onClick: function (mx, my) {
        if (DVT_balls.length >= DVT_MAX_BALLS) {
            /* remove the oldest ball to make room */
            DVT_balls.shift();
        }
        DVT_balls.push(DVT_makeBall(mx, my));
        DVT_spawnCt++;
        DVT_checkBest();
        DVT_sndPlay(DVT_sndSpawn);
    }
};
