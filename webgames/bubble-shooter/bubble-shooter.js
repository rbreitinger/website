"use strict";

// ─────────────────────────────────────────────────────────────────────────────
//  BUBBLE SHOOTER  ·  phone shell game  (360 × 596)
//  prefix: BSH_
// ─────────────────────────────────────────────────────────────────────────────

// ── layout constants ──────────────────────────────────────────────────────────
var BSH_CW         = 360;
var BSH_CH         = 596;
// R=22, D=44: 8 even cols × 44 = 352 = CW − 2×MAR  → perfect wall-to-wall fit
var BSH_R          = 22;      // bubble radius px
var BSH_D          = 44;      // bubble diameter  (= 2×R, must satisfy cols×D = CW−2×MAR)
var BSH_COL_DIST   = 32;      // collision radius (< D) — creates ~12px squeeze gap between bubbles
var BSH_ROW_H      = 38;      // hex row height = round(R × √3) = round(38.1)
var BSH_MAR        = 4;       // side margin

var BSH_HUD_H      = 50;
var BSH_PLAY_TOP   = BSH_HUD_H;
var BSH_PLAY_BOT   = 508;
var BSH_SHT_CX     = 180;
var BSH_SHT_CY     = 548;
var BSH_NXT_CX     = 296;
var BSH_NXT_CY     = 548;

// barrel geometry — must match bshDrawShooter
var BSH_BARREL_H   = 26;
// distance from shooter centre to barrel tip in local (unrotated) space
var BSH_TIP_DIST   = BSH_BARREL_H + BSH_R - 2;   // = 46  (auto-derives from BSH_R)

// scroll trigger
var BSH_THRESH_Y   = BSH_PLAY_BOT
                   - Math.round((BSH_PLAY_BOT - BSH_PLAY_TOP) / 3);

var BSH_GAME_SECS  = 150;
var BSH_BUB_SPD    = 820;     // px/s
var BSH_MAX_ANG    = 1.30;
var BSH_SCROLL_DUR = 300;

// ── palette ───────────────────────────────────────────────────────────────────
var BSH_NUM_COL = 5;
// Timer bubbles share the same 5 colours — stored as col+10 (11-15) in the grid.
// bshColOf(v) strips the timer offset; bshIsTimer(v) detects it.
var BSH_CFILL   = ["", "#e03040", "#2a9de0", "#3cbc50", "#f0b820", "#b040d0"];
var BSH_CDARK   = ["", "#901828", "#105898", "#1a6030", "#8a5800", "#600878"];

// ── audio ─────────────────────────────────────────────────────────────────────
var BSH_SND_BGM      = new Audio("bubble-shooter/bgm.ogg");
var BSH_SND_SHOOT    = new Audio("bubble-shooter/shoot.ogg");
var BSH_SND_POP      = new Audio("bubble-shooter/pop.ogg");
var BSH_SND_DROP     = new Audio("bubble-shooter/drop.ogg");
var BSH_SND_GAMEOVER = new Audio("bubble-shooter/gameover.ogg");
var BSH_SND_TIMER    = new Audio("bubble-shooter/timer.ogg");

var BSH_BG_IMG       = new Image();
var BSH_BG_READY     = false;
BSH_BG_IMG.onload    = function() { BSH_BG_READY = true; };
BSH_BG_IMG.src       = "bubble-shooter/background.png";

BSH_SND_BGM.loop = true;

function bshSnd(snd) {
    if (SHELL_isMuted()) return;
    snd.currentTime = 0;
    snd.play().catch(function() {});
}

function bshBgmStart() {
    if (SHELL_isMuted()) return;
    BSH_SND_BGM.currentTime = 0;
    BSH_SND_BGM.play().catch(function() {});
}

function bshBgmStop() {
    BSH_SND_BGM.pause();
    BSH_SND_BGM.currentTime = 0;
}

// Called on every user gesture — retries until BGM is actually playing.
// Checking .paused is more reliable than a flag: if the browser silently
// blocked the first attempt, the next tap will try again automatically.
function bshEnsureBgm() {
    if (BSH_phase !== "play" || !BSH_SND_BGM.paused) return;
    bshBgmStart();
}

// ── game state ────────────────────────────────────────────────────────────────
var BSH_ctx;
var BSH_phase;          // "play" | "over"
var BSH_overReason;     // "time" | "full"
var BSH_score;
var BSH_timeMs;

// grid: BSH_grid[r] = { par: 0|1, cells: [col, …] }
// par=0 → 9 cols;  par=1 → 8 cols offset by R
var BSH_grid;
var BSH_gridY;
var BSH_scrolling;
var BSH_scrollFrom;
var BSH_scrollTo;
var BSH_scrollMs;

var BSH_flying;
var BSH_fx, BSH_fy, BSH_fvx, BSH_fvy, BSH_fcolor;

var BSH_curCol;
var BSH_nxtCol;

var BSH_aiming;
var BSH_aimAng;

var BSH_popups;   // [{ x, y, txt, life, maxLife, big, col }]
var BSH_drops;    // [{ x, y, vx, vy, col, life }]
var BSH_sparks;   // [{ x, y, vx, vy, col, life, maxLife, sz }]
var BSH_flash;    // { life, maxLife, col } | null  — big-combo screen flash
var BSH_pb;       // personal best score (loaded once in init)
var BSH_streak;       // consecutive successful pops without a miss
var BSH_streakMult;   // current score multiplier from streak
var BSH_overLockMs;      // ms since game over — button locked for first 1000ms
var BSH_timerAlertFired; // true once the 30s alert sound has played
var BSH_timerLastSec;    // last integer second value — used for per-second tick below 10s

// ── grid helpers ──────────────────────────────────────────────────────────────
function bshPar(r)       { return BSH_grid[r].par; }
function bshLen(r)       { return BSH_grid[r].cells.length; }
function bshGet(r, c)    { return BSH_grid[r].cells[c]; }
function bshSet(r, c, v) { BSH_grid[r].cells[c] = v; }

function bshCX(r, c) {
    return bshPar(r) === 0
        ? BSH_MAR + BSH_R + c * BSH_D
        : BSH_MAR + BSH_D + c * BSH_D;
}
function bshCY(r) { return BSH_gridY + r * BSH_ROW_H + BSH_R; }

function bshInBounds(r, c) {
    return r >= 0 && r < BSH_grid.length && c >= 0 && c < bshLen(r);
}

// Timer bubble encoding: normal col 1-5, timer col 11-15 (= col+10)
function bshColOf(v)   { return v > 10 ? v - 10 : v; }
function bshIsTimer(v) { return v > 10; }

function bshNeighbors(r, c) {
    var n = [[r, c - 1], [r, c + 1]];
    if (bshPar(r) === 0) {
        n.push([r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]);
    } else {
        n.push([r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]);
    }
    return n;
}

// ── grid init ─────────────────────────────────────────────────────────────────
// Returns a random colour 1-5, biased 75% toward colours present in the grid
function bshRandCol() {
    var present = [];
    for (var r = 0; r < BSH_grid.length; r++) {
        for (var c = 0; c < bshLen(r); c++) {
            var v = bshGet(r, c);
            if (v >= 1 && v <= BSH_NUM_COL && present.indexOf(v) < 0)
                present.push(v);
        }
    }
    if (present.length > 0 && Math.random() < 0.75)
        return present[Math.floor(Math.random() * present.length)];
    return Math.floor(Math.random() * BSH_NUM_COL) + 1;
}

// Plain random col — used during grid generation before BSH_grid exists
function bshRandColPlain() { return Math.floor(Math.random() * BSH_NUM_COL) + 1; }

function bshMakeRow(par) {
    // par=0: 8 cols × D44 = 352 = CW−2×MAR  ← perfect fit
    // par=1: 7 cols, offset right by R
    // ~20% hole, ~7% timer bubble (stored as col+10), rest normal
    var cnt   = par === 0 ? 8 : 7;
    var cells = [];
    for (var c = 0; c < cnt; c++) {
        var rnd = Math.random();
        if      (rnd < 0.20) cells.push(0);
        else if (rnd < 0.27) cells.push(bshRandColPlain() + 10);  // timer
        else                 cells.push(bshRandColPlain());
    }
    return { par: par, cells: cells };
}

function bshEmptyRow(par) {
    var cnt   = par === 0 ? 8 : 7;
    var cells = [];
    for (var c = 0; c < cnt; c++) cells.push(0);
    return { par: par, cells: cells };
}

function bshInitGrid() {
    BSH_grid = [];
    // 9 filled rows — gives comfortable breathing room at game start
    for (var r = 0; r < 20; r++) {
        BSH_grid.push(r < 9 ? bshMakeRow(r % 2) : bshEmptyRow(r % 2));
    }
    BSH_gridY     = BSH_PLAY_TOP;
    BSH_scrolling = false;
    BSH_scrollMs  = 0;
}

// ── scroll ────────────────────────────────────────────────────────────────────
function bshLowestBubY() {
    var lo = -9999;
    for (var r = 0; r < BSH_grid.length; r++) {
        var cy = bshCY(r);
        if (cy > BSH_PLAY_BOT + BSH_R) continue;
        for (var c = 0; c < bshLen(r); c++) {
            if (bshGet(r, c) !== 0 && cy > lo) lo = cy;
        }
    }
    return lo;
}

function bshCheckScroll() {
    if (BSH_scrolling || BSH_flying) return;
    if (bshLowestBubY() < BSH_THRESH_Y) bshTriggerScroll();
}

function bshTriggerScroll() {
    var newPar = 1 - bshPar(0);
    BSH_grid.unshift(bshMakeRow(newPar));
    while (BSH_grid.length > 22) BSH_grid.pop();
    BSH_scrollFrom = BSH_gridY - BSH_ROW_H;
    BSH_scrollTo   = BSH_gridY;
    BSH_gridY      = BSH_scrollFrom;
    BSH_scrollMs   = 0;
    BSH_scrolling  = true;
}

function bshUpdateScroll(dt) {
    if (!BSH_scrolling) return;
    BSH_scrollMs += dt;
    var t    = Math.min(BSH_scrollMs / BSH_SCROLL_DUR, 1);
    var ease = 1 - (1 - t) * (1 - t);
    BSH_gridY = BSH_scrollFrom + (BSH_scrollTo - BSH_scrollFrom) * ease;
    if (t >= 1) {
        BSH_scrolling = false;
        bshCheckFloor();
    }
}

// ── floor / game over ─────────────────────────────────────────────────────────
function bshCheckFloor() {
    if (BSH_phase === "over") return;
    for (var r = 0; r < BSH_grid.length; r++) {
        var cy = bshCY(r);
        if (cy + BSH_R <= BSH_PLAY_BOT) continue;
        for (var c = 0; c < bshLen(r); c++) {
            if (bshGet(r, c) !== 0) { bshGameOver("full"); return; }
        }
    }
}

function bshGameOver(reason) {
    BSH_phase      = "over";
    BSH_overReason = reason;
    BSH_flying     = false;
    BSH_aiming     = false;
    if (BSH_score > BSH_pb) {
        BSH_pb = BSH_score;
        SHELL_setPB("bubble-shooter", BSH_pb);
    }
    bshBgmStop();
    bshSnd(BSH_SND_GAMEOVER);
}

// ── aiming ────────────────────────────────────────────────────────────────────
function bshCalcAng(mx, my) {
    var dx = mx - BSH_SHT_CX;
    var dy = my - BSH_SHT_CY;
    if (dy >= -10) return dx >= 0 ? BSH_MAX_ANG : -BSH_MAX_ANG;
    var ang = Math.atan2(dx, -dy);
    if (ang >  BSH_MAX_ANG) ang =  BSH_MAX_ANG;
    if (ang < -BSH_MAX_ANG) ang = -BSH_MAX_ANG;
    return ang;
}

// Rotated barrel tip — ray origin and launch origin are the same point,
// so the aim line always starts exactly where the bubble leaves the barrel.
function bshTipX() { return BSH_SHT_CX + Math.sin(BSH_aimAng) * BSH_TIP_DIST; }
function bshTipY() { return BSH_SHT_CY - Math.cos(BSH_aimAng) * BSH_TIP_DIST; }

// ── ray trace ─────────────────────────────────────────────────────────────────
function bshTraceRay(ox, oy, dx, dy) {
    var pts    = [{ x: ox, y: oy }];
    var rx     = ox, ry = oy, bounced = false;

    for (var seg = 0; seg < 2; seg++) {
        var bestT   = 900;
        var wallHit = false;
        var hx = rx + dx * bestT, hy = ry + dy * bestT;

        if (dx < -0.001) {
            var tw = (BSH_MAR + BSH_R - rx) / dx;
            if (tw > 4 && tw < bestT) {
                bestT = tw; wallHit = true;
                hx = BSH_MAR + BSH_R; hy = ry + dy * tw;
            }
        }
        if (dx > 0.001) {
            var tw = (BSH_CW - BSH_MAR - BSH_R - rx) / dx;
            if (tw > 4 && tw < bestT) {
                bestT = tw; wallHit = true;
                hx = BSH_CW - BSH_MAR - BSH_R; hy = ry + dy * tw;
            }
        }
        if (dy < -0.001) {
            var tc = (BSH_PLAY_TOP + BSH_R - ry) / dy;
            if (tc > 4 && tc < bestT) {
                bestT = tc; wallHit = false;
                hx = rx + dx * tc; hy = BSH_PLAY_TOP + BSH_R;
            }
        }
        for (var r = 0; r < BSH_grid.length; r++) {
            var cy = bshCY(r);
            if (cy < BSH_PLAY_TOP - BSH_R) continue;
            for (var c = 0; c < bshLen(r); c++) {
                if (bshGet(r, c) === 0) continue;
                var cx   = bshCX(r, c);
                var ex   = rx - cx, ey = ry - cy;
                var bv   = ex * dx + ey * dy;
                var cv   = ex * ex + ey * ey - BSH_D * BSH_D;
                var disc = bv * bv - cv;
                if (disc < 0) continue;
                var sq = Math.sqrt(disc);
                var t  = -bv - sq;
                if (t < 4) t = -bv + sq;
                if (t > 4 && t < bestT) {
                    bestT = t; wallHit = false;
                    hx = rx + dx * t; hy = ry + dy * t;
                }
            }
        }

        pts.push({ x: hx, y: hy });

        if (wallHit && !bounced) {
            rx = hx; ry = hy;
            dx = -dx;
            bounced = true;
        } else {
            break;
        }
    }
    return pts;
}

// ── launch ────────────────────────────────────────────────────────────────────
function bshLaunch() {
    if (BSH_flying) return;
    BSH_flying = true;
    BSH_fx     = bshTipX();
    BSH_fy     = bshTipY();
    BSH_fcolor = BSH_curCol;
    BSH_fvx    = Math.sin(BSH_aimAng) * BSH_BUB_SPD;
    BSH_fvy    = -Math.cos(BSH_aimAng) * BSH_BUB_SPD;
    BSH_curCol = BSH_nxtCol;
    BSH_nxtCol = bshRandCol();
    bshSnd(BSH_SND_SHOOT);
}

// ── bubble physics ────────────────────────────────────────────────────────────
function bshMoveBub(dt) {
    if (!BSH_flying) return;
    var s = dt / 1000;
    BSH_fx += BSH_fvx * s;
    BSH_fy += BSH_fvy * s;

    var wallL = BSH_MAR + BSH_R, wallR = BSH_CW - BSH_MAR - BSH_R;
    if (BSH_fx < wallL) { BSH_fx = wallL + (wallL - BSH_fx); BSH_fvx = -BSH_fvx; }
    if (BSH_fx > wallR) { BSH_fx = wallR - (BSH_fx - wallR); BSH_fvx = -BSH_fvx; }

    // Bubble fell below the floor without hitting anything — discard silently
    if (BSH_fy > BSH_PLAY_BOT + BSH_R) {
        BSH_flying = false;
        bshCheckScroll();
        return;
    }

    for (var r = 0; r < BSH_grid.length; r++) {
        var cy = bshCY(r);
        if (Math.abs(cy - BSH_fy) > BSH_D + 4) continue;
        for (var c = 0; c < bshLen(r); c++) {
            if (bshGet(r, c) === 0) continue;
            var cx = bshCX(r, c);
            var ex = cx - BSH_fx, ey = cy - BSH_fy;
            if (ex * ex + ey * ey < BSH_COL_DIST * BSH_COL_DIST) {
                bshSnapNearest();
                return;
            }
        }
    }

    if (BSH_fy <= bshCY(0)) bshSnapNearest();
}

// Find the nearest empty grid cell to the current fly position.
// Searches all rows whose centre y is within D*1.5 of BSH_fy.
// This handles squeeze-through shots correctly: the bubble may have
// passed a gap and be on the far side, so we never restrict the search
// to neighbors of a specific hit cell.
function bshSnapNearest() {
    var bestDist = 1e9, bestR = -1, bestC = -1;
    var scanR    = BSH_D * 1.5;   // search radius in px
    for (var r = 0; r < BSH_grid.length; r++) {
        var cy = bshCY(r);
        if (cy < BSH_PLAY_TOP - BSH_R) continue;
        if (Math.abs(cy - BSH_fy) > scanR) continue;
        for (var c = 0; c < bshLen(r); c++) {
            if (bshGet(r, c) !== 0) continue;
            var cx   = bshCX(r, c);
            var dx   = cx - BSH_fx, dy = cy - BSH_fy;
            var dist = dx * dx + dy * dy;
            if (dist < bestDist) { bestDist = dist; bestR = r; bestC = c; }
        }
    }
    if (bestR >= 0) bshSettle(bestR, bestC);
    else BSH_flying = false;
}

// ── timer bonus ───────────────────────────────────────────────────────────────
function bshTimerBonus(secs, px, py) {
    BSH_timeMs = Math.min(BSH_timeMs + secs * 1000, BSH_GAME_SECS * 1000);
    // Reset the per-second tick tracker so ticks fire correctly as time
    // counts back down — without this the ticks stay silent after a bonus
    BSH_timerLastSec = Math.ceil(BSH_timeMs / 1000);
    BSH_popups.push({
        x: px, y: py,
        txt: "+" + secs + "s \u23f1",
        life: 1400, maxLife: 1400,
        big: true, col: "#ffe060"
    });
    // Gold sparks
    for (var sp = 0; sp < 18; sp++) {
        var spAng = Math.random() * 6.2832;
        var spSpd = 80 + Math.random() * 140;
        BSH_sparks.push({
            x: px, y: py,
            vx: Math.cos(spAng) * spSpd, vy: Math.sin(spAng) * spSpd,
            col: "#ffe060",
            life: 600 + Math.random() * 300, maxLife: 900,
            sz: 2.5 + Math.random() * 3
        });
    }
}

function bshSettle(r, c) {
    bshSet(r, c, BSH_fcolor);
    BSH_flying = false;
    var prevStreak = BSH_streak;
    bshCheckMatch(r, c);
    // If streak didn't increase, this shot missed — reset it
    if (BSH_streak === prevStreak) {
        BSH_streak     = 0;
        BSH_streakMult = 1.0;
    }
    if (BSH_phase !== "over") bshCheckFloor();
}

// ── match & clear ─────────────────────────────────────────────────────────────
function bshFloodColor(startR, startC, col) {
    // col is the decoded colour (1-5); matches both normal and timer variants
    var visited = {}, queue = [[startR, startC]], found = [];
    while (queue.length > 0) {
        var item = queue.pop();
        var r = item[0], c = item[1];
        var key = r + "," + c;
        if (visited[key] || !bshInBounds(r, c)) continue;
        if (bshColOf(bshGet(r, c)) !== col)      continue;
        visited[key] = true;
        found.push(item);
        var nbrs = bshNeighbors(r, c);
        for (var i = 0; i < nbrs.length; i++) queue.push(nbrs[i]);
    }
    return found;
}

function bshFloodConnected() {
    var visited = {}, queue = [];
    for (var c = 0; c < bshLen(0); c++) {
        if (bshGet(0, c) !== 0) queue.push([0, c]);
    }
    while (queue.length > 0) {
        var item = queue.pop();
        var r = item[0], cc = item[1];
        var key = r + "," + cc;
        if (visited[key] || !bshInBounds(r, cc) || bshGet(r, cc) === 0) continue;
        visited[key] = true;
        var nbrs = bshNeighbors(r, cc);
        for (var i = 0; i < nbrs.length; i++) queue.push(nbrs[i]);
    }
    return visited;
}

function bshCheckMatch(r, c) {
    var col   = bshColOf(bshGet(r, c));   // decoded colour (1-5)
    var group = bshFloodColor(r, c, col);
    if (group.length < 3) { bshCheckScroll(); return; }

    // Count timer bubbles before clearing
    var timerInGroup = 0;
    for (var i = 0; i < group.length; i++) {
        if (bshIsTimer(bshGet(group[i][0], group[i][1]))) timerInGroup++;
    }
    for (var i = 0; i < group.length; i++) bshSet(group[i][0], group[i][1], 0);

    // ── streak ────────────────────────────────────────────────────────────────
    BSH_streak++;
    BSH_streakMult = BSH_streak >= 8 ? 3.0
                   : BSH_streak >= 5 ? 2.0
                   : BSH_streak >= 3 ? 1.5
                   : 1.0;

    var cnt  = group.length;
    var mult = cnt >= 20 ? 10 : cnt >= 15 ? 5 : cnt >= 10 ? 3 : cnt >= 6 ? 2 : 1;
    var pts  = Math.round(cnt * 10 * mult * BSH_streakMult);

    var sumX = 0, sumY = 0;
    for (var i = 0; i < group.length; i++) {
        sumX += bshCX(group[i][0], group[i][1]);
        sumY += bshCY(group[i][0]);
    }
    var pcx = sumX / group.length;
    var pcy = sumY / group.length;

    var lbl  = cnt >= 20 ? "AMAZING! \u00d7" + cnt
             : cnt >= 15 ? "GREAT! \u00d7" + cnt
             : cnt >= 10 ? "NICE! \u00d7" + cnt
             : "\u00d7" + cnt;
    if (BSH_streakMult > 1.0)
        lbl += "  \ud83d\udd25" + BSH_streakMult + "x";
    var pcol = cnt >= 20 ? "#ff8040" : cnt >= 15 ? "#f0d020"
             : cnt >= 10 ? "#80e080" : "#ffffff";
    BSH_popups.push({ x: pcx, y: pcy, txt: lbl,
                      life: 1200, maxLife: 1200, big: cnt >= 10, col: pcol });

    // Time bonus for timer bubbles popped directly in the matched group
    if (timerInGroup > 0)
        bshTimerBonus(timerInGroup * 5, pcx, pcy - 20);

    var connected = bshFloodConnected();
    var orphans   = [];
    for (var ro = 0; ro < BSH_grid.length; ro++) {
        for (var co = 0; co < bshLen(ro); co++) {
            if (bshGet(ro, co) !== 0 && !connected[ro + "," + co])
                orphans.push([ro, co]);
        }
    }
    var timerOrphans = 0;
    for (var j = 0; j < orphans.length; j++) {
        var or2 = orphans[j][0], oc = orphans[j][1];
        var orcol = bshGet(or2, oc);
        if (bshIsTimer(orcol)) timerOrphans++;
        BSH_drops.push({
            x: bshCX(or2, oc), y: bshCY(or2),
            vx: (Math.random() - 0.5) * 100, vy: -40 - Math.random() * 80,
            col: BSH_CFILL[bshColOf(orcol)],
            life: 900
        });
        bshSet(or2, oc, 0);
    }
    var normalOrphans = orphans.length - timerOrphans;
    if (normalOrphans > 0) {
        pts += normalOrphans * 5;
        BSH_popups.push({ x: pcx + 18, y: pcy + 22,
                          txt: "+" + (normalOrphans * 5) + " drop",
                          life: 900, maxLife: 900, big: false, col: "#aaffaa" });
        bshSnd(BSH_SND_DROP);
    }
    if (timerOrphans > 0) {
        bshTimerBonus(timerOrphans * 1, pcx - 18, pcy + 22);
    }

    BSH_score += pts;
    bshSnd(BSH_SND_POP);

    // ── juice: spark burst ────────────────────────────────────────────────────
    var sparkCol = BSH_CFILL[col];
    var sparkCnt = Math.min(6 + cnt * 2, 28);
    for (var sp = 0; sp < sparkCnt; sp++) {
        var spAng = Math.random() * 6.2832;
        var spSpd = 60 + Math.random() * 160;
        BSH_sparks.push({
            x: pcx, y: pcy,
            vx: Math.cos(spAng) * spSpd, vy: Math.sin(spAng) * spSpd,
            col: sparkCol,
            life: 500 + Math.random() * 300, maxLife: 800,
            sz: 2 + Math.random() * 3
        });
    }

    // ── juice: screen flash on big combos (10+) ───────────────────────────────
    if (cnt >= 10) {
        BSH_flash = {
            life:    cnt >= 20 ? 320 : cnt >= 15 ? 240 : 180,
            maxLife: cnt >= 20 ? 320 : cnt >= 15 ? 240 : 180,
            col:     cnt >= 20 ? "255,140,60"
                   : cnt >= 15 ? "240,210,30" : "120,220,120"
        };
    }

    bshCheckScroll();
}

// ── draw helpers ──────────────────────────────────────────────────────────────
function bshRRect(ctx, x, y, w, h, rad) {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.arcTo(x + w, y, x + w, y + rad, rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
    ctx.lineTo(x + rad, y + h);
    ctx.arcTo(x, y + h, x, y + h - rad, rad);
    ctx.lineTo(x, y + rad);
    ctx.arcTo(x, y, x + rad, y, rad);
    ctx.closePath();
}

function bshDrawBub(ctx, x, y, col, alpha) {
    var drawCol = bshColOf(col);   // strips timer offset if present
    var isTimer = bshIsTimer(col);
    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.shadowColor   = "rgba(0,0,0,0.4)";
    ctx.shadowBlur    = 4;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();
    ctx.arc(x, y, BSH_R - 1, 0, 6.2832);
    ctx.fillStyle = BSH_CFILL[drawCol];
    ctx.fill();
    ctx.lineWidth   = isTimer ? 2.5 : 1.5;
    ctx.strokeStyle = isTimer ? "#ffffff" : BSH_CDARK[drawCol];
    ctx.stroke();
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
    // Highlight
    var gr = ctx.createRadialGradient(x - 5, y - 6, 1, x - 2, y - 3, BSH_R * 0.8);
    gr.addColorStop(0, "rgba(255,255,255,0.72)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    ctx.beginPath();
    ctx.arc(x, y, BSH_R - 1, 0, 6.2832);
    ctx.fillStyle = gr;
    ctx.fill();
    // Timer glyph — white + on top of the bubble colour
    if (isTimer) {
        ctx.fillStyle    = "#ffffff";
        ctx.font         = "bold " + Math.round(BSH_R * 0.95) + "px sans-serif";
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("+", x, y + 1);
        ctx.textBaseline = "alphabetic";
    }
    ctx.restore();
}

// ── draw sections ─────────────────────────────────────────────────────────────
function bshDrawBackground(ctx) {
    // Background image (360×596) — plain colour fallback until loaded
    if (BSH_BG_READY) {
        ctx.drawImage(BSH_BG_IMG, 0, 0, BSH_CW, BSH_CH);
    } else {
        ctx.fillStyle = "#0e0e20";
        ctx.fillRect(0, 0, BSH_CW, BSH_CH);
        ctx.fillStyle = "#131326";
        ctx.fillRect(BSH_MAR, BSH_PLAY_TOP,
                     BSH_CW - BSH_MAR * 2, BSH_PLAY_BOT - BSH_PLAY_TOP);
        ctx.fillStyle = "#1e1e40";
        ctx.fillRect(0, BSH_PLAY_TOP, BSH_MAR, BSH_PLAY_BOT - BSH_PLAY_TOP);
        ctx.fillRect(BSH_CW - BSH_MAR, BSH_PLAY_TOP, BSH_MAR, BSH_PLAY_BOT - BSH_PLAY_TOP);
    }

    // Ceiling bar
    ctx.fillStyle = "rgba(58,58,106,0.85)";
    ctx.fillRect(0, BSH_PLAY_TOP, BSH_CW, 3);

    // Floor line (danger — red dashed)
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.lineWidth   = 1.5;
    ctx.strokeStyle = "rgba(220,60,60,0.6)";
    ctx.beginPath();
    ctx.moveTo(BSH_MAR, BSH_PLAY_BOT);
    ctx.lineTo(BSH_CW - BSH_MAR, BSH_PLAY_BOT);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Scroll threshold line (subtle hint)
    ctx.save();
    ctx.setLineDash([4, 10]);
    ctx.lineWidth   = 1;
    ctx.strokeStyle = "rgba(100,100,200,0.22)";
    ctx.beginPath();
    ctx.moveTo(BSH_MAR, BSH_THRESH_Y);
    ctx.lineTo(BSH_CW - BSH_MAR, BSH_THRESH_Y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

function bshDrawGrid(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, BSH_PLAY_TOP, BSH_CW, BSH_PLAY_BOT - BSH_PLAY_TOP);
    ctx.clip();
    for (var r = 0; r < BSH_grid.length; r++) {
        var cy = bshCY(r);
        if (cy + BSH_R < BSH_PLAY_TOP - 2 || cy - BSH_R > BSH_PLAY_BOT + 2) continue;
        for (var c = 0; c < bshLen(r); c++) {
            var col = bshGet(r, c);
            if (col === 0) continue;
            bshDrawBub(ctx, bshCX(r, c), cy, col, undefined);
        }
    }
    ctx.restore();
}

function bshDrawDrops(ctx) {
    for (var i = 0; i < BSH_drops.length; i++) {
        var d     = BSH_drops[i];
        var alpha = (d.life / 900) * 0.85;
        // drops store a css colour string in d.col (set at creation time)
        ctx.save();
        ctx.globalAlpha   = alpha;
        ctx.shadowColor   = "rgba(0,0,0,0.3)";
        ctx.shadowBlur    = 3;
        ctx.beginPath();
        ctx.arc(d.x, d.y, BSH_R - 1, 0, 6.2832);
        ctx.fillStyle = d.col;
        ctx.fill();
        ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
        var gr = ctx.createRadialGradient(d.x - 4, d.y - 5, 1, d.x - 2, d.y - 2, BSH_R * 0.8);
        gr.addColorStop(0, "rgba(255,255,255,0.6)");
        gr.addColorStop(1, "rgba(255,255,255,0)");
        ctx.beginPath();
        ctx.arc(d.x, d.y, BSH_R - 1, 0, 6.2832);
        ctx.fillStyle = gr;
        ctx.fill();
        ctx.restore();
    }
}

function bshDrawFlyingBub(ctx) {
    if (!BSH_flying) return;
    bshDrawBub(ctx, BSH_fx, BSH_fy, BSH_fcolor, undefined);
}

function bshDrawAimLine(ctx) {
    if (!BSH_aiming || BSH_flying) return;
    var ox  = bshTipX(), oy = bshTipY();
    var pts = bshTraceRay(ox, oy, Math.sin(BSH_aimAng), -Math.cos(BSH_aimAng));
    if (pts.length < 2) return;
    ctx.save();
    ctx.setLineDash([5, 9]);
    ctx.lineWidth   = 2;
    ctx.lineCap     = "round";
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.setLineDash([]);
    var last = pts[pts.length - 1];
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.arc(last.x, last.y, 4, 0, 6.2832);
    ctx.fill();
    ctx.restore();
}

function bshDrawShooter(ctx) {
    var x   = BSH_SHT_CX;
    var y   = BSH_SHT_CY;
    var ang = BSH_aiming ? BSH_aimAng : 0;
    var bw  = 10;

    // Barrel — rotates with aim; tip sits at local y = -(BSH_BARREL_H + BSH_R - 2)
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    bshRRect(ctx, -bw / 2, -(BSH_BARREL_H + BSH_R - 2), bw, BSH_BARREL_H, 3);
    ctx.fillStyle   = "#445566";
    ctx.fill();
    ctx.lineWidth   = 1.5;
    ctx.strokeStyle = "#778899";
    ctx.stroke();
    ctx.restore();

    // Base platform
    ctx.beginPath();
    ctx.arc(x, y, BSH_R + 6, 0, 6.2832);
    ctx.fillStyle   = "#2a2a4a";
    ctx.fill();
    ctx.strokeStyle = "#4a4a7a";
    ctx.lineWidth   = 2;
    ctx.stroke();

    // Current bubble
    if (!BSH_flying) bshDrawBub(ctx, x, y, BSH_curCol, undefined);
}

function bshDrawNext(ctx) {
    var x = BSH_NXT_CX, y = BSH_NXT_CY;
    ctx.fillStyle = "rgba(200,200,220,0.5)";
    ctx.font      = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("NEXT", x, y - BSH_R - 6);
    bshDrawBub(ctx, x, y, BSH_nxtCol, 0.85);
}

function bshDrawHUD(ctx) {
    ctx.fillStyle = "#181830";
    ctx.fillRect(0, 0, BSH_CW, BSH_HUD_H);
    ctx.fillStyle = "#2a2a55";
    ctx.fillRect(0, BSH_HUD_H - 1, BSH_CW, 1);

    // Left — current score
    ctx.textAlign = "left";
    ctx.fillStyle = "#7777aa";
    ctx.font      = "11px monospace";
    ctx.fillText("SCORE", 14, 16);
    ctx.fillStyle = "#ffffff";
    ctx.font      = "bold 22px monospace";
    ctx.fillText(BSH_score, 14, 38);

    // Centre — personal best (same style as score/time)
    if (BSH_pb > 0) {
        ctx.textAlign = "center";
        ctx.fillStyle = "#7777aa";
        ctx.font      = "11px monospace";
        ctx.fillText("BEST", BSH_CW / 2, 16);
        ctx.fillStyle = BSH_score >= BSH_pb ? "#60ff60" : "#aaaacc";
        ctx.font      = "bold 22px monospace";
        ctx.fillText(BSH_pb, BSH_CW / 2, 38);
    }

    // Right — timer
    var sec = Math.ceil(BSH_timeMs / 1000);
    if (sec < 0) sec = 0;
    var ts = Math.floor(sec / 60) + ":" + (sec % 60 < 10 ? "0" : "") + (sec % 60);
    ctx.textAlign = "right";
    ctx.fillStyle = "#7777aa";
    ctx.font      = "11px monospace";
    ctx.fillText("TIME", BSH_CW - 14, 16);
    ctx.fillStyle = sec <= 10 ? "#ff4444" : sec <= 30 ? "#f0b820" : "#ffffff";
    ctx.font      = "bold 22px monospace";
    ctx.fillText(ts, BSH_CW - 14, 38);
}

// Streak indicator drawn over the playfield — centred X, sits at ~1/3 from play top
function bshDrawStreak(ctx) {
    if (BSH_streak < 3) return;
    var sx = BSH_CW / 2;
    var sy = BSH_PLAY_TOP + Math.round((BSH_PLAY_BOT - BSH_PLAY_TOP) / 3);
    ctx.save();
    ctx.textAlign   = "center";
    ctx.font        = "bold 15px sans-serif";
    ctx.fillStyle   = BSH_streakMult >= 3.0 ? "#ff8040"
                    : BSH_streakMult >= 2.0 ? "#f0d020" : "#80e0ff";
    ctx.lineWidth   = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    var txt = "\ud83d\udd25 " + BSH_streak + " STREAK  \u00d7" + BSH_streakMult;
    ctx.strokeText(txt, sx, sy);
    ctx.fillText(txt, sx, sy);
    ctx.restore();
}

function bshDrawPopups(ctx) {
    for (var i = 0; i < BSH_popups.length; i++) {
        var p     = BSH_popups[i];
        var t     = 1 - p.life / p.maxLife;
        var alpha = p.life < p.maxLife * 0.3 ? p.life / (p.maxLife * 0.3) : 1;
        var rise  = t * 38;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.textAlign   = "center";
        ctx.font        = "bold " + (p.big ? 21 : 15) + "px sans-serif";
        ctx.lineWidth   = 3;
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.strokeText(p.txt, p.x, p.y - rise);
        ctx.fillStyle   = p.col;
        ctx.fillText(p.txt, p.x, p.y - rise);
        ctx.restore();
    }
}

function bshDrawSparks(ctx) {
    for (var i = 0; i < BSH_sparks.length; i++) {
        var sp    = BSH_sparks[i];
        var alpha = sp.life / sp.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle   = sp.col;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.sz * alpha + 0.5, 0, 6.2832);
        ctx.fill();
        ctx.restore();
    }
}

function bshDrawFlash(ctx) {
    if (!BSH_flash) return;
    var t     = BSH_flash.life / BSH_flash.maxLife;
    // peak at t=1 (just triggered), fade to 0
    var alpha = t * 0.28;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = "rgb(" + BSH_flash.col + ")";
    ctx.fillRect(0, BSH_PLAY_TOP, BSH_CW, BSH_PLAY_BOT - BSH_PLAY_TOP);
    ctx.restore();
}

function bshDrawGameOver(ctx) {
    ctx.fillStyle = "rgba(8,8,24,0.88)";
    ctx.fillRect(0, 0, BSH_CW, BSH_CH);

    var mid      = BSH_CH / 2;
    var headline = BSH_overReason === "full" ? "BOARD FULL!" : "TIME'S UP!";
    ctx.textAlign = "center";

    ctx.fillStyle = "#ffffff";
    ctx.font      = "bold 34px sans-serif";
    ctx.fillText(headline, BSH_CW / 2, mid - 72);

    ctx.fillStyle = "#8888cc";
    ctx.font      = "14px monospace";
    ctx.fillText("FINAL SCORE", BSH_CW / 2, mid - 28);
    ctx.fillStyle = "#f0d020";
    ctx.font      = "bold 52px monospace";
    ctx.fillText(BSH_score, BSH_CW / 2, mid + 26);

    // personal best
    if (BSH_score >= BSH_pb && BSH_pb > 0) {
        ctx.fillStyle = "#60ff60";
        ctx.font      = "bold 14px sans-serif";
        ctx.fillText("NEW BEST! \ud83c\udf1f", BSH_CW / 2, mid + 50);
    } else if (BSH_pb > 0) {
        ctx.fillStyle = "#6666aa";
        ctx.font      = "12px monospace";
        ctx.fillText("BEST: " + BSH_pb, BSH_CW / 2, mid + 50);
    }

    var bx = BSH_CW / 2 - 100, by = mid + 68;
    var locked = BSH_overLockMs < 1000;
    bshRRect(ctx, bx, by, 200, 52, 14);
    ctx.fillStyle   = locked ? "#222222" : "#1a5a1a";
    ctx.fill();
    ctx.strokeStyle = locked ? "#555555" : "#50c050";
    ctx.lineWidth   = 2;
    ctx.stroke();
    ctx.fillStyle = locked ? "#666666" : "#ffffff";
    ctx.font      = "bold 20px sans-serif";
    ctx.fillText(locked ? "WAIT..." : "PLAY AGAIN", BSH_CW / 2, by + 32);
}

// ── particle update ───────────────────────────────────────────────────────────
function bshUpdateParticles(dt) {
    var s = dt / 1000;
    for (var i = BSH_drops.length - 1; i >= 0; i--) {
        var d = BSH_drops[i];
        d.vy   += 420 * s;
        d.x    += d.vx * s;
        d.y    += d.vy * s;
        d.life -= dt;
        if (d.life <= 0) BSH_drops.splice(i, 1);
    }
    for (var j = BSH_sparks.length - 1; j >= 0; j--) {
        var sp = BSH_sparks[j];
        sp.vy  += 180 * s;    // gentle gravity
        sp.x   += sp.vx * s;
        sp.y   += sp.vy * s;
        sp.vx  *= 0.97;       // air drag
        sp.vy  *= 0.97;
        sp.life -= dt;
        if (sp.life <= 0) BSH_sparks.splice(j, 1);
    }
    if (BSH_flash) {
        BSH_flash.life -= dt;
        if (BSH_flash.life <= 0) BSH_flash = null;
    }
    for (var k = BSH_popups.length - 1; k >= 0; k--) {
        BSH_popups[k].life -= dt;
        if (BSH_popups[k].life <= 0) BSH_popups.splice(k, 1);
    }
}

// ── GAME object ───────────────────────────────────────────────────────────────
var GAME = {
    title: "Bubble Shooter",

    init: function(canvas) {
        BSH_ctx = canvas.getContext("2d");
        BSH_pb  = SHELL_getPB("bubble-shooter") || 0;
    },

    start: function() {
        BSH_phase      = "play";
        BSH_overReason = "";
        BSH_score      = 0;
        BSH_timeMs     = BSH_GAME_SECS * 1000;
        BSH_flying     = false;
        BSH_aiming     = false;
        BSH_aimAng     = 0;
        BSH_popups     = [];
        BSH_drops      = [];
        BSH_sparks     = [];
        BSH_flash      = null;
        BSH_streak          = 0;
        BSH_streakMult      = 1.0;
        BSH_overLockMs      = 0;
        BSH_timerAlertFired = false;
        BSH_timerLastSec    = BSH_GAME_SECS;
        bshInitGrid();
        BSH_curCol     = bshRandCol();
        BSH_nxtCol     = bshRandCol();
    },

    update: function(dt) {
        if (BSH_phase === "over") {
            BSH_overLockMs += dt;
            return;
        }
        BSH_timeMs -= dt;
        if (BSH_timeMs <= 0) { BSH_timeMs = 0; bshGameOver("time"); return; }
        // Fire the 30s alert once
        if (!BSH_timerAlertFired && BSH_timeMs <= 30000) {
            BSH_timerAlertFired = true;
            bshSnd(BSH_SND_TIMER);
        }
        // Fire timer.ogg every second once below 10s
        if (BSH_timeMs <= 10000) {
            var curSec = Math.ceil(BSH_timeMs / 1000);
            if (curSec < BSH_timerLastSec) {
                BSH_timerLastSec = curSec;
                bshSnd(BSH_SND_TIMER);
            }
        }
        bshUpdateScroll(dt);
        bshMoveBub(dt);
        bshUpdateParticles(dt);
        if (!BSH_flying) bshCheckScroll();
    },

    draw: function() {
        var ctx = BSH_ctx;
        bshDrawBackground(ctx);
        bshDrawGrid(ctx);
        bshDrawDrops(ctx);
        bshDrawStreak(ctx);
        bshDrawSparks(ctx);
        bshDrawFlash(ctx);
        bshDrawFlyingBub(ctx);
        bshDrawAimLine(ctx);
        bshDrawShooter(ctx);
        bshDrawNext(ctx);
        bshDrawHUD(ctx);
        bshDrawPopups(ctx);
        if (BSH_phase === "over") bshDrawGameOver(ctx);
    },

    onDragStart: function(mx, my) {
        if (BSH_phase !== "play" || BSH_flying) return;
        bshEnsureBgm();
        BSH_aiming = true;
        BSH_aimAng = bshCalcAng(mx, my);
    },

    onDrag: function(mx, my) {
        if (BSH_aiming) BSH_aimAng = bshCalcAng(mx, my);
    },

    onDragEnd: function(mx, my) {
        if (!BSH_aiming) return;
        BSH_aiming = false;
        BSH_aimAng = bshCalcAng(mx, my);
        bshLaunch();
    },

    onClick: function(mx, my) {
        if (BSH_phase === "over") {
            if (BSH_overLockMs < 1000) return;   // button locked for first second
            var mid = BSH_CH / 2;
            if (mx > BSH_CW / 2 - 100 && mx < BSH_CW / 2 + 100
                    && my > mid + 68 && my < mid + 120) {
                GAME.start();
                bshEnsureBgm();   // still inside user gesture — BGM allowed immediately
            }
            return;
        }
        if (BSH_flying) return;
        bshEnsureBgm();
        BSH_aimAng = bshCalcAng(mx, my);
        bshLaunch();
    }
};
