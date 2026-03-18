"use strict";

// ─────────────────────────────────────────────────────────────────────────────
//  BUBBLE FLOW  ·  phone shell game  (360 × 596)
//  prefix: BFL_
//
//  Mechanics:
//    · No timer — grid flows down from the top on a timed interval
//    · Grid starts with BFL_START_ROWS filled rows
//    · Flow speed increases every BFL_SPEED_UP_EVERY bubbles cleared
//    · Game over when any bubble crosses BFL_PLAY_BOT (board full)
// ─────────────────────────────────────────────────────────────────────────────

// ── layout constants ──────────────────────────────────────────────────────────
var BFL_CW         = 360;
var BFL_CH         = 596;
// R=22, D=44: 8 even cols × 44 = 352 = CW − 2×MAR  → perfect wall-to-wall fit
var BFL_R          = 22;      // bubble radius px
var BFL_D          = 44;      // bubble diameter  (= 2×R)
var BFL_COL_DIST   = 32;      // collision radius (< D) — creates squeeze gap
var BFL_ROW_H      = 38;      // hex row height = round(R × √3)
var BFL_MAR        = 4;       // side margin

var BFL_HUD_H      = 50;
var BFL_PLAY_TOP   = BFL_HUD_H;
var BFL_PLAY_BOT   = 508;
var BFL_SHT_CX     = 180;
var BFL_SHT_CY     = 548;
var BFL_NXT_CX     = 296;
var BFL_NXT_CY     = 548;

// barrel geometry — must match bflDrawShooter
var BFL_BARREL_H   = 26;
// distance from shooter centre to barrel tip in local (unrotated) space
var BFL_TIP_DIST   = BFL_BARREL_H + BFL_R - 2;

var BFL_BUB_SPD    = 820;     // px/s
var BFL_MAX_ANG    = 1.30;
var BFL_SCROLL_DUR = 300;     // ms per row scroll animation

// ── flow mechanic constants (tune these) ──────────────────────────────────────
var BFL_FLOW_INTERVAL_BASE = 10000; // ms between rows at game start
var BFL_SPEED_UP_EVERY     = 50;    // bubbles cleared per speed level
var BFL_FLOW_ACCEL         = 0.88;  // interval multiplier per level (< 1 = faster)
var BFL_FLOW_MIN_MS        = 2500;  // fastest possible interval
var BFL_START_ROWS         = 3;     // filled rows at game start

// ── palette ───────────────────────────────────────────────────────────────────
var BFL_NUM_COL = 5;
var BFL_CFILL = ["", "#00d4ff", "#ff3aaa", "#40ff80", "#ff9020", "#c060ff"];
var BFL_CDARK = ["", "#007a99", "#aa1060", "#1a8840", "#994010", "#6a18aa"];

// ── audio ─────────────────────────────────────────────────────────────────────
var BFL_SND_BGM      = new Audio("bubble-flow/bgm.ogg");
var BFL_SND_SHOOT    = new Audio("bubble-flow/shoot.ogg");
var BFL_SND_POP      = new Audio("bubble-flow/pop.ogg");
var BFL_SND_DROP     = new Audio("bubble-flow/drop.ogg");
var BFL_SND_GAMEOVER = new Audio("bubble-flow/gameover.ogg");
var BFL_SND_SCROLL   = new Audio("bubble-flow/scroll.ogg");
var BFL_SND_LEVELUP  = new Audio("bubble-flow/levelup.ogg");

var BFL_BG_IMG       = new Image();
var BFL_BG_READY     = false;
BFL_BG_IMG.onload    = function() { BFL_BG_READY = true; };
BFL_BG_IMG.src       = "bubble-flow/background.png";

BFL_SND_BGM.loop = true;

function bflSnd(snd) {
    if (SHELL_isMuted()) return;
    snd.currentTime = 0;
    snd.play().catch(function() {});
}

function bflBgmStart() {
    if (SHELL_isMuted()) return;
    BFL_SND_BGM.currentTime = 0;
    BFL_SND_BGM.play().catch(function() {});
}

function bflBgmStop() {
    BFL_SND_BGM.pause();
    BFL_SND_BGM.currentTime = 0;
}

// Called on every user gesture — retries until BGM is actually playing.
function bflEnsureBgm() {
    if (BFL_phase !== "play" || !BFL_SND_BGM.paused) return;
    bflBgmStart();
}

// ── game state ────────────────────────────────────────────────────────────────
var BFL_ctx;
var BFL_phase;          // "ready" | "play" | "over"
var BFL_score;

// grid: BFL_grid[r] = { par: 0|1, cells: [col, …] }
// par=0 → 9 cols;  par=1 → 8 cols offset by R
var BFL_grid;
var BFL_gridY;
var BFL_scrolling;
var BFL_scrollFrom;
var BFL_scrollTo;
var BFL_scrollMs;

var BFL_flying;
var BFL_fx, BFL_fy, BFL_fvx, BFL_fvy, BFL_fcolor;

var BFL_curCol;
var BFL_nxtCol;

var BFL_aiming;
var BFL_aimAng;

var BFL_popups;   // [{ x, y, txt, life, maxLife, big, col }]
var BFL_drops;    // [{ x, y, vx, vy, col, life }]
var BFL_sparks;   // [{ x, y, vx, vy, col, life, maxLife, sz }]
var BFL_flash;    // { life, maxLife, col } | null

var BFL_pb;
var BFL_streak;
var BFL_streakMult;
var BFL_overLockMs;
var BFL_readyMs;

// flow mechanic state
var BFL_flowTimer;      // ms until next row flows in
var BFL_flowInterval;   // current ms between rows (decreases with speed-up)
var BFL_bubblesPopped;  // total bubbles cleared (drives speed-up)
var BFL_speedLvl;       // current speed level (shown in HUD)

// ── grid helpers ──────────────────────────────────────────────────────────────
function bflPar(r)       { return BFL_grid[r].par; }
function bflLen(r)       { return BFL_grid[r].cells.length; }
function bflGet(r, c)    { return BFL_grid[r].cells[c]; }
function bflSet(r, c, v) { BFL_grid[r].cells[c] = v; }

function bflCX(r, c) {
    return bflPar(r) === 0
        ? BFL_MAR + BFL_R + c * BFL_D
        : BFL_MAR + BFL_D + c * BFL_D;
}
function bflCY(r) { return BFL_gridY + r * BFL_ROW_H + BFL_R; }

function bflInBounds(r, c) {
    return r >= 0 && r < BFL_grid.length && c >= 0 && c < bflLen(r);
}

function bflNeighbors(r, c) {
    var n = [[r, c - 1], [r, c + 1]];
    if (bflPar(r) === 0) {
        n.push([r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]);
    } else {
        n.push([r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]);
    }
    return n;
}

// ── grid init ─────────────────────────────────────────────────────────────────
// Returns a random colour 1-5, biased 75% toward colours already in the grid
function bflRandCol() {
    var present = [];
    for (var r = 0; r < BFL_grid.length; r++) {
        for (var c = 0; c < bflLen(r); c++) {
            var v = bflGet(r, c);
            if (v >= 1 && v <= BFL_NUM_COL && present.indexOf(v) < 0)
                present.push(v);
        }
    }
    if (present.length > 0 && Math.random() < 0.75)
        return present[Math.floor(Math.random() * present.length)];
    return Math.floor(Math.random() * BFL_NUM_COL) + 1;
}

// Plain random colour — used during grid generation before BFL_grid is populated
function bflRandColPlain() { return Math.floor(Math.random() * BFL_NUM_COL) + 1; }

function bflMakeRow(par) {
    // par=0: 8 cols;  par=1: 7 cols offset right by R
    // ~18% hole, rest normal colour bubble
    var cnt   = par === 0 ? 8 : 7;
    var cells = [];
    for (var c = 0; c < cnt; c++) {
        cells.push(Math.random() < 0.18 ? 0 : bflRandColPlain());
    }
    return { par: par, cells: cells };
}

function bflEmptyRow(par) {
    var cnt   = par === 0 ? 8 : 7;
    var cells = [];
    for (var c = 0; c < cnt; c++) cells.push(0);
    return { par: par, cells: cells };
}

function bflInitGrid() {
    BFL_grid = [];
    // BFL_START_ROWS filled rows at the top, rest empty
    for (var r = 0; r < 20; r++) {
        BFL_grid.push(r < BFL_START_ROWS ? bflMakeRow(r % 2) : bflEmptyRow(r % 2));
    }
    BFL_gridY     = BFL_PLAY_TOP;
    BFL_scrolling = false;
    BFL_scrollMs  = 0;
}

// ── flow / scroll ─────────────────────────────────────────────────────────────
// Prepends a new row and animates the grid down by one row height.
// Called by the flow timer in update() — never by bubble position.
function bflTriggerFlow() {
    var newPar = 1 - bflPar(0);
    BFL_grid.unshift(bflMakeRow(newPar));
    while (BFL_grid.length > 22) BFL_grid.pop();
    BFL_scrollFrom = BFL_gridY - BFL_ROW_H;
    BFL_scrollTo   = BFL_gridY;
    BFL_gridY      = BFL_scrollFrom;
    BFL_scrollMs   = 0;
    BFL_scrolling  = true;
    bflSnd(BFL_SND_SCROLL);
}

function bflUpdateScroll(dt) {
    if (!BFL_scrolling) return;
    BFL_scrollMs += dt;
    var t    = Math.min(BFL_scrollMs / BFL_SCROLL_DUR, 1);
    var ease = 1 - (1 - t) * (1 - t);
    BFL_gridY = BFL_scrollFrom + (BFL_scrollTo - BFL_scrollFrom) * ease;
    if (t >= 1) {
        BFL_scrolling = false;
        bflCheckFloor();
    }
}

// ── floor / game over ─────────────────────────────────────────────────────────
function bflCheckFloor() {
    if (BFL_phase === "over") return;
    for (var r = 0; r < BFL_grid.length; r++) {
        var cy = bflCY(r);
        if (cy + BFL_R <= BFL_PLAY_BOT) continue;
        for (var c = 0; c < bflLen(r); c++) {
            if (bflGet(r, c) !== 0) { bflGameOver(); return; }
        }
    }
}

function bflGameOver() {
    BFL_phase  = "over";
    BFL_flying = false;
    BFL_aiming = false;
    if (BFL_score > BFL_pb) {
        BFL_pb = BFL_score;
        SHELL_setPB("bubble-flow", BFL_pb);
    }
    bflBgmStop();
    bflSnd(BFL_SND_GAMEOVER);
}

// ── aiming ────────────────────────────────────────────────────────────────────
function bflCalcAng(mx, my) {
    var dx = mx - BFL_SHT_CX;
    var dy = my - BFL_SHT_CY;
    if (dy >= -10) return dx >= 0 ? BFL_MAX_ANG : -BFL_MAX_ANG;
    var ang = Math.atan2(dx, -dy);
    if (ang >  BFL_MAX_ANG) ang =  BFL_MAX_ANG;
    if (ang < -BFL_MAX_ANG) ang = -BFL_MAX_ANG;
    return ang;
}

// Rotated barrel tip — ray origin and launch origin are the same point
function bflTipX() { return BFL_SHT_CX + Math.sin(BFL_aimAng) * BFL_TIP_DIST; }
function bflTipY() { return BFL_SHT_CY - Math.cos(BFL_aimAng) * BFL_TIP_DIST; }

// ── ray trace ─────────────────────────────────────────────────────────────────
function bflTraceRay(ox, oy, dx, dy) {
    var pts    = [{ x: ox, y: oy }];
    var rx     = ox, ry = oy, bounced = false;

    for (var seg = 0; seg < 2; seg++) {
        var bestT   = 900;
        var wallHit = false;
        var hx = rx + dx * bestT, hy = ry + dy * bestT;

        if (dx < -0.001) {
            var tw = (BFL_MAR + BFL_R - rx) / dx;
            if (tw > 4 && tw < bestT) {
                bestT = tw; wallHit = true;
                hx = BFL_MAR + BFL_R; hy = ry + dy * tw;
            }
        }
        if (dx > 0.001) {
            var tw = (BFL_CW - BFL_MAR - BFL_R - rx) / dx;
            if (tw > 4 && tw < bestT) {
                bestT = tw; wallHit = true;
                hx = BFL_CW - BFL_MAR - BFL_R; hy = ry + dy * tw;
            }
        }
        if (dy < -0.001) {
            var tc = (BFL_PLAY_TOP + BFL_R - ry) / dy;
            if (tc > 4 && tc < bestT) {
                bestT = tc; wallHit = false;
                hx = rx + dx * tc; hy = BFL_PLAY_TOP + BFL_R;
            }
        }
        for (var r = 0; r < BFL_grid.length; r++) {
            var cy = bflCY(r);
            if (cy < BFL_PLAY_TOP - BFL_R) continue;
            for (var c = 0; c < bflLen(r); c++) {
                if (bflGet(r, c) === 0) continue;
                var cx   = bflCX(r, c);
                var ex   = rx - cx, ey = ry - cy;
                var bv   = ex * dx + ey * dy;
                var cv   = ex * ex + ey * ey - BFL_D * BFL_D;
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
function bflLaunch() {
    if (BFL_flying) return;
    BFL_flying = true;
    BFL_fx     = bflTipX();
    BFL_fy     = bflTipY();
    BFL_fcolor = BFL_curCol;
    BFL_fvx    = Math.sin(BFL_aimAng) * BFL_BUB_SPD;
    BFL_fvy    = -Math.cos(BFL_aimAng) * BFL_BUB_SPD;
    BFL_curCol = BFL_nxtCol;
    BFL_nxtCol = bflRandCol();
    bflSnd(BFL_SND_SHOOT);
}

// ── bubble physics ────────────────────────────────────────────────────────────
function bflMoveBub(dt) {
    if (!BFL_flying) return;
    var s = dt / 1000;
    BFL_fx += BFL_fvx * s;
    BFL_fy += BFL_fvy * s;

    var wallL = BFL_MAR + BFL_R, wallR = BFL_CW - BFL_MAR - BFL_R;
    if (BFL_fx < wallL) { BFL_fx = wallL + (wallL - BFL_fx); BFL_fvx = -BFL_fvx; }
    if (BFL_fx > wallR) { BFL_fx = wallR - (BFL_fx - wallR); BFL_fvx = -BFL_fvx; }

    // Discard only if below the floor AND drifting further down
    if (BFL_fy > BFL_PLAY_BOT + BFL_R && BFL_fvy > 0) {
        BFL_flying = false;
        return;
    }

    for (var r = 0; r < BFL_grid.length; r++) {
        var cy = bflCY(r);
        if (Math.abs(cy - BFL_fy) > BFL_D + 4) continue;
        for (var c = 0; c < bflLen(r); c++) {
            if (bflGet(r, c) === 0) continue;
            var cx = bflCX(r, c);
            var ex = cx - BFL_fx, ey = cy - BFL_fy;
            if (ex * ex + ey * ey < BFL_COL_DIST * BFL_COL_DIST) {
                bflSnapNearest();
                return;
            }
        }
    }

    if (BFL_fy <= bflCY(0)) bflSnapNearest();
}

// Find the nearest empty grid cell to the current fly position.
function bflSnapNearest() {
    var bestDist = 1e9, bestR = -1, bestC = -1;
    var scanR    = BFL_D * 1.5;
    for (var r = 0; r < BFL_grid.length; r++) {
        var cy = bflCY(r);
        if (cy < BFL_PLAY_TOP - BFL_R) continue;
        if (Math.abs(cy - BFL_fy) > scanR) continue;
        for (var c = 0; c < bflLen(r); c++) {
            if (bflGet(r, c) !== 0) continue;
            var cx   = bflCX(r, c);
            var dx   = cx - BFL_fx, dy = cy - BFL_fy;
            var dist = dx * dx + dy * dy;
            if (dist < bestDist) { bestDist = dist; bestR = r; bestC = c; }
        }
    }
    if (bestR >= 0) bflSettle(bestR, bestC);
    else BFL_flying = false;
}

function bflSettle(r, c) {
    bflSet(r, c, BFL_fcolor);
    BFL_flying = false;
    var prevStreak = BFL_streak;
    bflCheckMatch(r, c);
    // If streak didn't increase, this shot was a miss — reset it
    if (BFL_streak === prevStreak) {
        BFL_streak     = 0;
        BFL_streakMult = 1.0;
    }
    if (BFL_phase !== "over") bflCheckFloor();
}

// ── match & clear ─────────────────────────────────────────────────────────────
function bflFloodColor(startR, startC, col) {
    var visited = {}, queue = [[startR, startC]], found = [];
    while (queue.length > 0) {
        var item = queue.pop();
        var r = item[0], c = item[1];
        var key = r + "," + c;
        if (visited[key] || !bflInBounds(r, c)) continue;
        if (bflGet(r, c) !== col)               continue;
        visited[key] = true;
        found.push(item);
        var nbrs = bflNeighbors(r, c);
        for (var i = 0; i < nbrs.length; i++) queue.push(nbrs[i]);
    }
    return found;
}

function bflFloodConnected() {
    var visited = {}, queue = [];
    for (var c = 0; c < bflLen(0); c++) {
        if (bflGet(0, c) !== 0) queue.push([0, c]);
    }
    while (queue.length > 0) {
        var item = queue.pop();
        var r = item[0], cc = item[1];
        var key = r + "," + cc;
        if (visited[key] || !bflInBounds(r, cc) || bflGet(r, cc) === 0) continue;
        visited[key] = true;
        var nbrs = bflNeighbors(r, cc);
        for (var i = 0; i < nbrs.length; i++) queue.push(nbrs[i]);
    }
    return visited;
}

// Called after each successful clear. If bubblesPopped crosses another
// multiple of BFL_SPEED_UP_EVERY, reduce the flow interval.
function bflCheckSpeedUp(prevPopped) {
    var prevLvl = Math.floor(prevPopped      / BFL_SPEED_UP_EVERY);
    var curLvl  = Math.floor(BFL_bubblesPopped / BFL_SPEED_UP_EVERY);
    if (curLvl <= prevLvl) return;
    BFL_speedLvl++;
    bflSnd(BFL_SND_LEVELUP);
    BFL_flowInterval = Math.max(
        Math.round(BFL_flowInterval * BFL_FLOW_ACCEL),
        BFL_FLOW_MIN_MS
    );
    // "FASTER!" popup — centred vertically in the play field
    BFL_popups.push({
        x: BFL_CW / 2,
        y: BFL_PLAY_TOP + Math.round((BFL_PLAY_BOT - BFL_PLAY_TOP) / 2),
        txt: "FASTER! \u25bc",
        life: 1100, maxLife: 1100,
        big: true, col: "#ff6040"
    });
}

function bflCheckMatch(r, c) {
    var col   = bflGet(r, c);
    var group = bflFloodColor(r, c, col);
    if (group.length < 3) { return; }

    for (var i = 0; i < group.length; i++) bflSet(group[i][0], group[i][1], 0);

    // ── streak ────────────────────────────────────────────────────────────────
    BFL_streak++;
    BFL_streakMult = BFL_streak >= 8 ? 3.0
                   : BFL_streak >= 5 ? 2.0
                   : BFL_streak >= 3 ? 1.5
                   : 1.0;

    var cnt  = group.length;
    var mult = cnt >= 20 ? 10 : cnt >= 15 ? 5 : cnt >= 10 ? 3 : cnt >= 6 ? 2 : 1;
    var pts  = Math.round(cnt * 10 * mult * BFL_streakMult);

    var sumX = 0, sumY = 0;
    for (var i = 0; i < group.length; i++) {
        sumX += bflCX(group[i][0], group[i][1]);
        sumY += bflCY(group[i][0]);
    }
    var pcx = sumX / group.length;
    var pcy = sumY / group.length;

    var lbl  = cnt >= 20 ? "AMAZING! \u00d7" + cnt
             : cnt >= 15 ? "GREAT! \u00d7" + cnt
             : cnt >= 10 ? "NICE! \u00d7" + cnt
             : "\u00d7" + cnt;
    if (BFL_streakMult > 1.0)
        lbl += "  \ud83d\udd25" + BFL_streakMult + "x";
    var pcol = cnt >= 20 ? "#ff8040" : cnt >= 15 ? "#f0d020"
             : cnt >= 10 ? "#80e080" : "#ffffff";
    BFL_popups.push({ x: pcx, y: pcy, txt: lbl,
                      life: 1200, maxLife: 1200, big: cnt >= 10, col: pcol });

    var connected = bflFloodConnected();
    var orphans   = [];
    for (var ro = 0; ro < BFL_grid.length; ro++) {
        for (var co = 0; co < bflLen(ro); co++) {
            if (bflGet(ro, co) !== 0 && !connected[ro + "," + co])
                orphans.push([ro, co]);
        }
    }
    var dropCnt = orphans.length;
    for (var j = 0; j < orphans.length; j++) {
        var or2 = orphans[j][0], oc = orphans[j][1];
        var orcol = bflGet(or2, oc);
        BFL_drops.push({
            x: bflCX(or2, oc), y: bflCY(or2),
            vx: (Math.random() - 0.5) * 100, vy: -40 - Math.random() * 80,
            col: BFL_CFILL[orcol],
            life: 900
        });
        bflSet(or2, oc, 0);
    }
    if (dropCnt > 0) {
        pts += dropCnt * 5;
        BFL_popups.push({ x: pcx + 18, y: pcy + 22,
                          txt: "+" + (dropCnt * 5) + " drop",
                          life: 900, maxLife: 900, big: false, col: "#aaffaa" });
        bflSnd(BFL_SND_DROP);
    }

    // ── speed-up check ────────────────────────────────────────────────────────
    var prevPopped = BFL_bubblesPopped;
    BFL_bubblesPopped += cnt + dropCnt;
    bflCheckSpeedUp(prevPopped);

    BFL_score += pts;
    bflSnd(BFL_SND_POP);

    // ── juice: spark burst ────────────────────────────────────────────────────
    var sparkCol = BFL_CFILL[col];
    var sparkCnt = Math.min(6 + cnt * 2, 28);
    for (var sp = 0; sp < sparkCnt; sp++) {
        var spAng = Math.random() * 6.2832;
        var spSpd = 60 + Math.random() * 160;
        BFL_sparks.push({
            x: pcx, y: pcy,
            vx: Math.cos(spAng) * spSpd, vy: Math.sin(spAng) * spSpd,
            col: sparkCol,
            life: 500 + Math.random() * 300, maxLife: 800,
            sz: 2 + Math.random() * 3
        });
    }

    // ── juice: screen flash on big combos (10+) ───────────────────────────────
    if (cnt >= 10) {
        BFL_flash = {
            life:    cnt >= 20 ? 320 : cnt >= 15 ? 240 : 180,
            maxLife: cnt >= 20 ? 320 : cnt >= 15 ? 240 : 180,
            col:     cnt >= 20 ? "255,140,60"
                   : cnt >= 15 ? "240,210,30" : "120,220,120"
        };
    }
}

// ── draw helpers ──────────────────────────────────────────────────────────────
function bflRRect(ctx, x, y, w, h, rad) {
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

function bflDrawBub(ctx, x, y, col, alpha) {
    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.shadowColor = BFL_CFILL[col];
    ctx.shadowBlur  = 10;
    ctx.beginPath();
    ctx.arc(x, y, BFL_R - 1, 0, 6.2832);
    ctx.fillStyle = BFL_CFILL[col];
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur  = 0;
    ctx.lineWidth   = 1.5;
    ctx.strokeStyle = BFL_CDARK[col];
    ctx.stroke();
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
    var gr = ctx.createRadialGradient(x - 5, y - 6, 1, x - 2, y - 3, BFL_R * 0.8);
    gr.addColorStop(0, "rgba(255,255,255,0.72)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    ctx.beginPath();
    ctx.arc(x, y, BFL_R - 1, 0, 6.2832);
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.restore();
}

// ── draw sections ─────────────────────────────────────────────────────────────
function bflDrawBackground(ctx) {
    if (BFL_BG_READY && SHELL_isBgEnabled()) {
        ctx.drawImage(BFL_BG_IMG, 0, 0, BFL_CW, BFL_CH);
    } else {
        ctx.fillStyle = "#0e0e20";
        ctx.fillRect(0, 0, BFL_CW, BFL_CH);
        ctx.fillStyle = "#131326";
        ctx.fillRect(BFL_MAR, BFL_PLAY_TOP,
                     BFL_CW - BFL_MAR * 2, BFL_PLAY_BOT - BFL_PLAY_TOP);
        ctx.fillStyle = "#1e1e40";
        ctx.fillRect(0, BFL_PLAY_TOP, BFL_MAR, BFL_PLAY_BOT - BFL_PLAY_TOP);
        ctx.fillRect(BFL_CW - BFL_MAR, BFL_PLAY_TOP, BFL_MAR, BFL_PLAY_BOT - BFL_PLAY_TOP);
    }

    // Ceiling bar
    ctx.fillStyle = "rgba(58,58,106,0.85)";
    ctx.fillRect(0, BFL_PLAY_TOP, BFL_CW, 3);

    // Floor line (danger — red dashed)
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.lineWidth   = 1.5;
    ctx.strokeStyle = "rgba(220,60,60,0.6)";
    ctx.beginPath();
    ctx.moveTo(BFL_MAR, BFL_PLAY_BOT);
    ctx.lineTo(BFL_CW - BFL_MAR, BFL_PLAY_BOT);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

function bflDrawGrid(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, BFL_PLAY_TOP, BFL_CW, BFL_PLAY_BOT - BFL_PLAY_TOP);
    ctx.clip();
    for (var r = 0; r < BFL_grid.length; r++) {
        var cy = bflCY(r);
        if (cy + BFL_R < BFL_PLAY_TOP - 2 || cy - BFL_R > BFL_PLAY_BOT + 2) continue;
        for (var c = 0; c < bflLen(r); c++) {
            var col = bflGet(r, c);
            if (col === 0) continue;
            bflDrawBub(ctx, bflCX(r, c), cy, col, undefined);
        }
    }
    ctx.restore();
}

function bflDrawDrops(ctx) {
    for (var i = 0; i < BFL_drops.length; i++) {
        var d     = BFL_drops[i];
        var alpha = (d.life / 900) * 0.85;
        ctx.save();
        ctx.globalAlpha   = alpha;
        ctx.shadowColor   = "rgba(0,0,0,0.3)";
        ctx.shadowBlur    = 3;
        ctx.beginPath();
        ctx.arc(d.x, d.y, BFL_R - 1, 0, 6.2832);
        ctx.fillStyle = d.col;
        ctx.fill();
        ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
        var gr = ctx.createRadialGradient(d.x - 4, d.y - 5, 1, d.x - 2, d.y - 2, BFL_R * 0.8);
        gr.addColorStop(0, "rgba(255,255,255,0.6)");
        gr.addColorStop(1, "rgba(255,255,255,0)");
        ctx.beginPath();
        ctx.arc(d.x, d.y, BFL_R - 1, 0, 6.2832);
        ctx.fillStyle = gr;
        ctx.fill();
        ctx.restore();
    }
}

function bflDrawFlyingBub(ctx) {
    if (!BFL_flying) return;
    bflDrawBub(ctx, BFL_fx, BFL_fy, BFL_fcolor, undefined);
}

function bflDrawAimLine(ctx) {
    if (!BFL_aiming || BFL_flying) return;
    var ox  = bflTipX(), oy = bflTipY();
    var pts = bflTraceRay(ox, oy, Math.sin(BFL_aimAng), -Math.cos(BFL_aimAng));
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

function bflDrawShooter(ctx) {
    var x   = BFL_SHT_CX;
    var y   = BFL_SHT_CY;
    var ang = BFL_aiming ? BFL_aimAng : 0;
    var bw  = 10;

    // Barrel — rotates with aim
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    bflRRect(ctx, -bw / 2, -(BFL_BARREL_H + BFL_R - 2), bw, BFL_BARREL_H, 3);
    ctx.fillStyle   = "#445566";
    ctx.fill();
    ctx.lineWidth   = 1.5;
    ctx.strokeStyle = "#778899";
    ctx.stroke();
    ctx.restore();

    // Base platform
    ctx.beginPath();
    ctx.arc(x, y, BFL_R + 6, 0, 6.2832);
    ctx.fillStyle   = "#2a2a4a";
    ctx.fill();
    ctx.strokeStyle = "#4a4a7a";
    ctx.lineWidth   = 2;
    ctx.stroke();

    // Current bubble
    if (!BFL_flying) bflDrawBub(ctx, x, y, BFL_curCol, undefined);
}

function bflDrawNext(ctx) {
    var x = BFL_NXT_CX, y = BFL_NXT_CY;
    ctx.fillStyle = "rgba(200,200,220,0.5)";
    ctx.font      = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("NEXT", x, y - BFL_R - 6);
    bflDrawBub(ctx, x, y, BFL_nxtCol, 0.85);
}

// Flow progress bar — 3 px strip right at the top of the play area.
// Full = lots of time until next row; empty = row incoming.
// Colour shifts blue → yellow → red with speed level.
function bflDrawFlowBar(ctx) {
    if (BFL_phase !== "play") return;
    var ratio = BFL_flowTimer > 0 ? BFL_flowTimer / BFL_flowInterval : 0;
    var barX  = BFL_MAR;
    var barY  = BFL_HUD_H;
    var barW  = BFL_CW - BFL_MAR * 2;
    var barH  = 3;

    // Track
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fillRect(barX, barY, barW, barH);

    // Fill
    var fillW = Math.round(barW * ratio);
    if (fillW > 0) {
        var barCol = BFL_speedLvl >= 7 ? "rgba(255,68,68,0.8)"
                   : BFL_speedLvl >= 4 ? "rgba(240,184,32,0.8)"
                   : "rgba(68,136,255,0.8)";
        ctx.fillStyle = barCol;
        ctx.fillRect(barX, barY, fillW, barH);
    }
}

function bflDrawHUD(ctx) {
    ctx.fillStyle = "#181830";
    ctx.fillRect(0, 0, BFL_CW, BFL_HUD_H);
    ctx.fillStyle = "#2a2a55";
    ctx.fillRect(0, BFL_HUD_H - 1, BFL_CW, 1);

    // Left — score
    ctx.textAlign = "left";
    ctx.fillStyle = "#7777aa";
    ctx.font      = "11px monospace";
    ctx.fillText("SCORE", 14, 16);
    ctx.fillStyle = "#ffffff";
    ctx.font      = "bold 22px monospace";
    ctx.fillText(BFL_score, 14, 38);

    // Centre — personal best
    if (BFL_pb > 0) {
        ctx.textAlign = "center";
        ctx.fillStyle = "#7777aa";
        ctx.font      = "11px monospace";
        ctx.fillText("BEST", BFL_CW / 2, 16);
        ctx.fillStyle = BFL_score >= BFL_pb ? "#60ff60" : "#aaaacc";
        ctx.font      = "bold 22px monospace";
        ctx.fillText(BFL_pb, BFL_CW / 2, 38);
    }

    // Right — speed level
    // Colour shifts white → yellow → red as level rises to signal danger
    ctx.textAlign = "right";
    ctx.fillStyle = "#7777aa";
    ctx.font      = "11px monospace";
    ctx.fillText("LEVEL", BFL_CW - 14, 16);
    var lvlCol = BFL_speedLvl >= 7 ? "#ff4444"
               : BFL_speedLvl >= 4 ? "#f0b820"
               : "#ffffff";
    ctx.fillStyle = lvlCol;
    ctx.font      = "bold 22px monospace";
    ctx.fillText(BFL_speedLvl, BFL_CW - 14, 38);
}

// Streak indicator — centred X, ~1/3 from play top
function bflDrawStreak(ctx) {
    if (BFL_streak < 3) return;
    var sx = BFL_CW / 2;
    var sy = BFL_PLAY_TOP + Math.round((BFL_PLAY_BOT - BFL_PLAY_TOP) / 3);
    ctx.save();
    ctx.textAlign   = "center";
    ctx.font        = "bold 15px sans-serif";
    ctx.fillStyle   = BFL_streakMult >= 3.0 ? "#ff8040"
                    : BFL_streakMult >= 2.0 ? "#f0d020" : "#80e0ff";
    ctx.lineWidth   = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    var txt = "\ud83d\udd25 " + BFL_streak + " STREAK  \u00d7" + BFL_streakMult;
    ctx.strokeText(txt, sx, sy);
    ctx.fillText(txt, sx, sy);
    ctx.restore();
}

function bflDrawPopups(ctx) {
    for (var i = 0; i < BFL_popups.length; i++) {
        var p     = BFL_popups[i];
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

function bflDrawSparks(ctx) {
    for (var i = 0; i < BFL_sparks.length; i++) {
        var sp    = BFL_sparks[i];
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

function bflDrawFlash(ctx) {
    if (!BFL_flash) return;
    var t     = BFL_flash.life / BFL_flash.maxLife;
    var alpha = t * 0.28;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = "rgb(" + BFL_flash.col + ")";
    ctx.fillRect(0, BFL_PLAY_TOP, BFL_CW, BFL_PLAY_BOT - BFL_PLAY_TOP);
    ctx.restore();
}

function bflDrawGameOver(ctx) {
    ctx.fillStyle = "rgba(8,8,24,0.88)";
    ctx.fillRect(0, 0, BFL_CW, BFL_CH);

    var mid = BFL_CH / 2;
    ctx.textAlign = "center";

    ctx.fillStyle = "#ffffff";
    ctx.font      = "bold 34px sans-serif";
    ctx.fillText("BOARD FULL!", BFL_CW / 2, mid - 72);

    ctx.fillStyle = "#8888cc";
    ctx.font      = "14px monospace";
    ctx.fillText("FINAL SCORE", BFL_CW / 2, mid - 28);
    ctx.fillStyle = "#f0d020";
    ctx.font      = "bold 52px monospace";
    ctx.fillText(BFL_score, BFL_CW / 2, mid + 26);

    if (BFL_score >= BFL_pb && BFL_pb > 0) {
        ctx.fillStyle = "#60ff60";
        ctx.font      = "bold 14px sans-serif";
        ctx.fillText("NEW BEST! \ud83c\udf1f", BFL_CW / 2, mid + 50);
    } else if (BFL_pb > 0) {
        ctx.fillStyle = "#6666aa";
        ctx.font      = "12px monospace";
        ctx.fillText("BEST: " + BFL_pb, BFL_CW / 2, mid + 50);
    }

    var bx = BFL_CW / 2 - 100, by = mid + 68;
    var locked = BFL_overLockMs < 1000;
    bflRRect(ctx, bx, by, 200, 52, 14);
    ctx.fillStyle   = locked ? "#222222" : "#1a5a1a";
    ctx.fill();
    ctx.strokeStyle = locked ? "#555555" : "#50c050";
    ctx.lineWidth   = 2;
    ctx.stroke();
    ctx.fillStyle = locked ? "#666666" : "#ffffff";
    ctx.font      = "bold 20px sans-serif";
    ctx.fillText(locked ? "WAIT..." : "PLAY AGAIN", BFL_CW / 2, by + 32);
}

// ── particle update ───────────────────────────────────────────────────────────
function bflUpdateParticles(dt) {
    var s = dt / 1000;
    for (var i = BFL_drops.length - 1; i >= 0; i--) {
        var d = BFL_drops[i];
        d.vy   += 420 * s;
        d.x    += d.vx * s;
        d.y    += d.vy * s;
        d.life -= dt;
        if (d.life <= 0) BFL_drops.splice(i, 1);
    }
    for (var j = BFL_sparks.length - 1; j >= 0; j--) {
        var sp = BFL_sparks[j];
        sp.vy  += 180 * s;
        sp.x   += sp.vx * s;
        sp.y   += sp.vy * s;
        sp.vx  *= 0.97;
        sp.vy  *= 0.97;
        sp.life -= dt;
        if (sp.life <= 0) BFL_sparks.splice(j, 1);
    }
    if (BFL_flash) {
        BFL_flash.life -= dt;
        if (BFL_flash.life <= 0) BFL_flash = null;
    }
    for (var k = BFL_popups.length - 1; k >= 0; k--) {
        BFL_popups[k].life -= dt;
        if (BFL_popups[k].life <= 0) BFL_popups.splice(k, 1);
    }
}

// ── ready countdown overlay ───────────────────────────────────────────────────
function bflDrawReady(ctx) {
    ctx.fillStyle = "rgba(8,8,24,0.78)";
    ctx.fillRect(0, 0, BFL_CW, BFL_CH);

    var num = Math.ceil(BFL_readyMs / 1000);
    if (num < 1) num = 1;

    // t: 1.0 right as the digit appears, 0.0 just before it flips
    var t     = (BFL_readyMs % 1000) / 1000;
    var scale = 1 + t * 0.45;

    ctx.save();
    ctx.textAlign = "center";

    ctx.fillStyle = "#8888cc";
    ctx.font      = "bold 22px sans-serif";
    ctx.fillText("GET READY", BFL_CW / 2, BFL_CH / 2 - 68);

    var numCol = num === 1 ? "#f0b820" : "#ffffff";
    ctx.translate(BFL_CW / 2, BFL_CH / 2);
    ctx.scale(scale, scale);
    ctx.fillStyle    = numCol;
    ctx.font         = "bold 88px monospace";
    ctx.textBaseline = "middle";
    ctx.fillText(num, 0, 0);
    ctx.textBaseline = "alphabetic";

    ctx.restore();

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(140,150,180,0.75)";
    ctx.font      = "12px sans-serif";
    ctx.fillText("go fullscreen \u2022 adjust sound", BFL_CW / 2, BFL_CH / 2 + 78);
}

// ── GAME object ───────────────────────────────────────────────────────────────
var GAME = {
    title: "Bubble Flow",

    init: function(canvas) {
        BFL_ctx = canvas.getContext("2d");
        BFL_pb  = SHELL_getPB("bubble-flow") || 0;
    },

    start: function() {
        BFL_phase      = "ready";
        BFL_readyMs    = 3000;
        BFL_score      = 0;
        BFL_flying     = false;
        BFL_aiming     = false;
        BFL_aimAng     = 0;
        BFL_popups     = [];
        BFL_drops      = [];
        BFL_sparks     = [];
        BFL_flash      = null;
        BFL_streak          = 0;
        BFL_streakMult      = 1.0;
        BFL_overLockMs      = 0;
        BFL_flowInterval    = BFL_FLOW_INTERVAL_BASE;
        BFL_flowTimer       = BFL_FLOW_INTERVAL_BASE;
        BFL_bubblesPopped   = 0;
        BFL_speedLvl        = 1;
        bflInitGrid();
        BFL_curCol     = bflRandCol();
        BFL_nxtCol     = bflRandCol();
    },

    update: function(dt) {
        if (BFL_phase === "ready") {
            BFL_readyMs -= dt;
            if (BFL_readyMs <= 0) BFL_phase = "play";
            return;
        }
        if (BFL_phase === "over") {
            BFL_overLockMs += dt;
            return;
        }

        // Flow timer — counts down; blocked during scroll animation or while a
        // bubble is in the air (avoids snap conflicts), but the timer keeps
        // ticking so the row fires the instant the bubble lands.
        if (BFL_flowTimer > 0) BFL_flowTimer -= dt;
        if (BFL_flowTimer <= 0 && !BFL_scrolling && !BFL_flying) {
            bflTriggerFlow();
            BFL_flowTimer = BFL_flowInterval;
        }

        bflUpdateScroll(dt);
        bflMoveBub(dt);
        bflUpdateParticles(dt);
    },

    draw: function() {
        var ctx = BFL_ctx;
        bflDrawBackground(ctx);
        bflDrawGrid(ctx);
        bflDrawDrops(ctx);
        bflDrawStreak(ctx);
        bflDrawSparks(ctx);
        bflDrawFlash(ctx);
        bflDrawFlyingBub(ctx);
        bflDrawAimLine(ctx);
        bflDrawShooter(ctx);
        bflDrawNext(ctx);
        bflDrawHUD(ctx);
        bflDrawFlowBar(ctx);   // drawn after HUD — sits at y=50, play area entry
        bflDrawPopups(ctx);
        if (BFL_phase === "ready") bflDrawReady(ctx);
        if (BFL_phase === "over")  bflDrawGameOver(ctx);
    },

    onDragStart: function(mx, my) {
        if (BFL_phase === "ready") return;
        if (BFL_phase !== "play" || BFL_flying) return;
        bflEnsureBgm();
        BFL_aiming = true;
        BFL_aimAng = bflCalcAng(mx, my);
    },

    onDrag: function(mx, my) {
        if (BFL_phase === "ready") return;
        if (BFL_aiming) BFL_aimAng = bflCalcAng(mx, my);
    },

    onDragEnd: function(mx, my) {
        if (BFL_phase === "ready") return;
        if (!BFL_aiming) return;
        BFL_aiming = false;
        BFL_aimAng = bflCalcAng(mx, my);
        bflLaunch();
    },

    onClick: function(mx, my) {
        if (BFL_phase === "ready") return;
        if (BFL_phase === "over") {
            if (BFL_overLockMs < 1000) return;
            var mid = BFL_CH / 2;
            if (mx > BFL_CW / 2 - 100 && mx < BFL_CW / 2 + 100
                    && my > mid + 68 && my < mid + 120) {
                GAME.start();
                bflEnsureBgm();   // still inside user gesture — BGM allowed immediately
            }
            return;
        }
        if (BFL_flying) return;
        bflEnsureBgm();
        BFL_aimAng = bflCalcAng(mx, my);
        bflLaunch();
    },

    onMuteChange: function(muted) {
        if (muted) {
            bflBgmStop();
        } else {
            bflEnsureBgm();   // only restarts if phase is "play" and BGM is paused
        }
    }
};
