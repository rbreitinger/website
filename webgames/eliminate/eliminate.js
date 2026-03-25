// =============================================================================
// eliminate.js  —  v2 desktop / tablet shell (960 × 640)
// Click a group of 2+ connected same-colour gems to remove them.
// Board falls down, empty columns slide inward. Score = removed² per click.
// =============================================================================

// V2_CW = 960  V2_CH = 640  —  injected globally by game-v2.html

// =============================================================================
// CONSTANTS
// =============================================================================

// ---------- grid ----------
const ELM_CELLPX     = 36;
const ELM_GCOLS      = 15;
const ELM_GROWS      = 12;
const ELM_MAX_COLORS = 7;    // colour indices 1–7

// ---------- board geometry ----------
const ELM_HUD_H = 44;
const ELM_BW    = ELM_GCOLS * ELM_CELLPX;
const ELM_BH    = ELM_GROWS * ELM_CELLPX;
const ELM_BX    = Math.floor((V2_CW - ELM_BW) / 2);
const ELM_BY    = ELM_HUD_H + Math.floor((V2_CH - ELM_HUD_H - ELM_BH) / 2);

// ---------- animation speeds ----------
const ELM_POP_DUR      = 300;   // ms  — gem scale-down duration
const ELM_FALL_SPD     = 8;     // px per 10 ms step
const ELM_SLIDE_SPD    = 5;     // px per 10 ms step
const ELM_SHUFFLE_DUR  = 550;   // ms  — joker scatter-fly duration

// ---------- clear tier thresholds (gem count) ----------
const ELM_TIER_MEDIUM = 8;
const ELM_TIER_BIG    = 15;
const ELM_TIER_HUGE   = 20;

// ---------- combo label display ----------
const ELM_COMBO_TOTAL_DUR = 2000;   // ms total display time
const ELM_COMBO_FADE_DUR  =  700;   // ms of fade-out at end

// ---------- HUD column x positions ----------
const ELM_HUD_LVL_X = 16;
const ELM_HUD_BLK_X = 140;
const ELM_HUD_SCR_X = Math.floor(V2_CW / 2);
const ELM_HUD_PB_X  = V2_CW - 16;

// ---------- joker button (right margin, centred on board) ----------
const ELM_JOKER_MAX = 3;
const ELM_JKR_W     = 80;
const ELM_JKR_H     = 80;
const ELM_JKR_X     = ELM_BX + ELM_BW + Math.floor((V2_CW - ELM_BX - ELM_BW - ELM_JKR_W) / 2);
const ELM_JKR_Y     = Math.floor(ELM_BY + (ELM_BH - ELM_JKR_H) / 2);
const ELM_JKR_R     = 12;

// ---------- mercy table — remaining gems still allowed for level advance ----------
// L1-L4: 10,  L5: 7,  L6: 5,  L7: 3,  L8: 1,  L9+: 0
const ELM_MERCY_TAB = [10, 10, 10, 10, 7, 5, 3, 1];

// ---------- colours ----------
const ELM_CLR_BG         = "#0a0c0f";
const ELM_CLR_PF_BG      = "rgba(11,13,16,0.86)";
const ELM_CLR_HUD_BG     = "#181830";
const ELM_CLR_HUD_SEP    = "#2a2a55";
const ELM_CLR_HUD_LBL    = "#7777aa";
const ELM_CLR_HUD_VAL    = "#ffffff";
const ELM_CLR_HUD_PB_HI  = "#60ff60";
const ELM_CLR_OVR        = "rgba(8,8,24,0.88)";
const ELM_CLR_OVR_HDL    = "#ffffff";
const ELM_CLR_OVR_LBL    = "#8888cc";
const ELM_CLR_OVR_SCR    = "#f0d020";
const ELM_CLR_OVR_PB_HI  = "#60ff60";
const ELM_CLR_OVR_PB     = "#6666aa";
const ELM_CLR_BTN_OFF_BG = "#222222";
const ELM_CLR_BTN_OFF_BD = "#555555";
const ELM_CLR_BTN_ON_BG  = "#1a5a1a";
const ELM_CLR_BTN_ON_BD  = "#50c050";
const ELM_CLR_BTN_TXT    = "#ffffff";
const ELM_CLR_SPL_BG     = "rgba(8,8,24,0.78)";
const ELM_CLR_SPL_TXT    = "#ffffff";
const ELM_CLR_SPL_SUB    = "#8888cc";
const ELM_CLR_JKR_BG     = "rgba(15,31,15,0.88)";
const ELM_CLR_JKR_BD     = "#50c050";
const ELM_CLR_JKR_TXT    = "#90e890";
const ELM_CLR_JKR_OFF_BG = "rgba(16,16,16,0.88)";
const ELM_CLR_JKR_OFF_BD = "#555555";
const ELM_CLR_JKR_OFF_TXT= "#555566";
const ELM_CLR_COMBO_MED  = "#f0d020";
const ELM_CLR_COMBO_BIG  = "#ff8020";
const ELM_CLR_COMBO_HUGE = "#ff44ff";

// ---------- gem palette (index 0 = empty) ----------
const ELM_GEM_COL = [
    "#000000",   // 0  empty
    "#4455ff",   // 1  blue
    "#44dd44",   // 2  green
    "#ee4444",   // 3  red
    "#eeee44",   // 4  yellow
    "#ee44ee",   // 5  magenta
    "#44eeee",   // 6  cyan
    "#aaaaaa"    // 7  grey
];

// ---------- personal best ----------
const ELM_PB_KEY = "elim_score";

// ---------- background image ----------
const ELM_BG_IMG  = new Image();
let   elmBgReady  = false;
ELM_BG_IMG.onload = () => { elmBgReady = true; };
ELM_BG_IMG.src    = "eliminate/bg.png";

// ---------- sounds ----------
const ELM_SND_NOMATCH  = new Audio("eliminate/snd_nomatch.ogg");
const ELM_SND_ELIM     = new Audio("eliminate/snd_elim.ogg");
const ELM_SND_MEDIUM   = new Audio("eliminate/snd_medium.ogg");
const ELM_SND_BIG      = new Audio("eliminate/snd_big.ogg");
const ELM_SND_HUGE     = new Audio("eliminate/snd_huge.ogg");
const ELM_SND_FALL     = new Audio("eliminate/snd_fall.ogg");     // gems settle
const ELM_SND_SLIDE    = new Audio("eliminate/snd_slide.ogg");    // column slides in
const ELM_SND_LEVELUP  = new Audio("eliminate/snd_levelup.ogg");
const ELM_SND_GAMEOVER = new Audio("eliminate/snd_gameover.ogg");
const ELM_SND_SHUFFLE  = new Audio("eliminate/snd_shuffle.ogg");

// =============================================================================
// STATE
// =============================================================================

let elmGrid;
let elmCLeft, elmCRight;
let elmScore, elmBroke, elmRemaining;
let elmPB = 0;
let elmLevel;
let elmSlideToggle;

// phase:  "splash" | "playing" | "popping" | "falling" | "sliding" | "shuffling" | "over"
let elmPhase;
let elmOverLockMs;   // ms elapsed since game over  (1 s button lock)
let elmSplashMs;     // ms remaining in level-announcement splash

// popping animation
let elmPopGems;      // [{gx, gy, col}]  — captured before flood-fill
let elmPopMs;        // ms elapsed in pop phase
let elmPopCount;     // gems removed this click (tier + combo label)
let elmPopScore;     // score gained this click  (combo label)

// falling animation
let elmFallData;     // elmFallData[col][row] = remaining pixel drop offset

// sliding animation
let elmSlideBatch;   // {colFirst, colLast, xOff}

// joker
let elmJokerCount;

// shuffle animation
let elmShuffleGems;  // [{col, fromX, fromY, toX, toY}]  pixel coords
let elmShuffleMs;    // ms elapsed in shuffle phase

// combo label timer (9999 = inactive / not yet triggered)
let elmComboMs;

let _cv, _cx;

// =============================================================================
// GAME INTERFACE
// =============================================================================

const GAME = {
    title:      "Eliminate",
    resetLabel: "RESET",

    init(canvas) {
        _cv  = canvas;
        _cx  = canvas.getContext("2d");
        elmPB    = SHELL_getPB(ELM_PB_KEY) || 0;
        elmPhase = "playing";   // safe default; start() is called immediately after
    },

    start() { _elmResetAll(); },
    reset() { _elmResetAll(); },

    update(dt) {
        if (elmPhase === "over") {
            elmOverLockMs += dt;
            return;
        }
        // advance combo label fade timer in all non-over phases
        if (elmPhase !== "splash" && elmComboMs < ELM_COMBO_TOTAL_DUR)
            elmComboMs += dt;
        if (elmPhase === "splash") {
            elmSplashMs -= dt;
            if (elmSplashMs <= 0) {
                _elmStartNextLevel();
                elmPhase = "playing";
            }
            return;
        }
        if (elmPhase === "popping") {
            elmPopMs += dt;
            if (elmPopMs >= ELM_POP_DUR) _elmBeginFall();
            return;
        }
        if (elmPhase === "shuffling") {
            elmShuffleMs += dt;
            if (elmShuffleMs >= ELM_SHUFFLE_DUR) _elmEndShuffle();
            return;
        }
        if (elmPhase === "falling") {
            _elmUpdateFall();
            return;
        }
        if (elmPhase === "sliding") {
            _elmUpdateSlide();
            return;
        }
        // "playing" — purely event-driven via onClick
    },

    draw() { _elmDraw(); },

    onClick(mx, my) {
        if (elmPhase === "over") {
            if (elmOverLockMs < 1000) return;
            const midX = Math.floor(V2_CW / 2);
            const midY = Math.floor(V2_CH / 2);
            if (mx >= midX - 100 && mx <= midX + 100 &&
                my >= midY + 68  && my <= midY + 120)
                GAME.start();
            return;
        }
        if (elmPhase !== "playing") return;

        // Joker button
        if (elmJokerCount > 0 &&
            mx >= ELM_JKR_X && mx <= ELM_JKR_X + ELM_JKR_W &&
            my >= ELM_JKR_Y && my <= ELM_JKR_Y + ELM_JKR_H) {
            _elmDoJoker();
            return;
        }

        // Board click
        const cell = _elmScreenToGrid(mx, my);
        if (!cell) return;
        _elmDoAction(cell.gx, cell.gy);
    }
};

// =============================================================================
// INIT / RESET
// =============================================================================

function _elmMakeGrid() {
    const grp = new Array(ELM_GCOLS + 1);
    for (let x = 0; x <= ELM_GCOLS; x++)
        grp[x] = new Array(ELM_GROWS + 1).fill(0);
    return grp;
}

function _elmResetAll() {
    elmGrid        = _elmMakeGrid();
    elmScore       = 0;
    elmBroke       = 0;
    elmLevel       = 0;
    elmCLeft       = 1;
    elmCRight      = ELM_GCOLS;
    elmSlideToggle = 0;
    elmOverLockMs  = 0;
    elmJokerCount  = 1;
    elmShuffleGems = [];
    elmShuffleMs   = 0;
    elmComboMs     = 9999;
    elmPopGems     = [];
    elmPopMs       = 0;
    elmPopCount    = 0;
    elmPopScore    = 0;
    elmFallData    = [];
    elmSlideBatch  = { colFirst: 1, colLast: 1, xOff: 0 };
    elmPhase       = "splash";
    elmSplashMs    = 900;
}

function _elmStartNextLevel() {
    elmLevel++;
    const colCount = Math.min(elmLevel + 2, ELM_MAX_COLORS);   // L1=3 colours, ramps to ELM_MAX_COLORS
    elmRemaining   = ELM_GCOLS * ELM_GROWS;
    elmCLeft       = 1;
    elmCRight      = ELM_GCOLS;
    elmSlideToggle = 0;
    for (let y = 1; y <= ELM_GROWS; y++)
        for (let x = 1; x <= ELM_GCOLS; x++)
            elmGrid[x][y] = Math.floor(Math.random() * colCount) + 1;
    _elmFixSingles();
}

// Ensure no gem is a complete loner — 3 passes, recolour isolated gems
// to match a random neighbour. Never adds or removes gems; only recolours.
function _elmFixSingles() {
    for (let pass = 0; pass < 3; pass++) {
        for (let y = 1; y <= ELM_GROWS; y++) {
            for (let x = 1; x <= ELM_GCOLS; x++) {
                if (!elmGrid[x][y] || _elmHasNeighbour(x, y)) continue;
                const nb = [];
                if (x > 1         && elmGrid[x-1][y]) nb.push(elmGrid[x-1][y]);
                if (x < ELM_GCOLS && elmGrid[x+1][y]) nb.push(elmGrid[x+1][y]);
                if (y > 1         && elmGrid[x][y-1]) nb.push(elmGrid[x][y-1]);
                if (y < ELM_GROWS && elmGrid[x][y+1]) nb.push(elmGrid[x][y+1]);
                if (nb.length) elmGrid[x][y] = nb[Math.floor(Math.random() * nb.length)];
            }
        }
    }
}

// =============================================================================
// GAME LOGIC
// =============================================================================

function _elmHasNeighbour(x, y) {
    const gem = elmGrid[x][y];
    if (!gem) return false;
    if (x > 1         && elmGrid[x-1][y] === gem) return true;
    if (y > 1         && elmGrid[x][y-1] === gem) return true;
    if (x < ELM_GCOLS && elmGrid[x+1][y] === gem) return true;
    if (y < ELM_GROWS && elmGrid[x][y+1] === gem) return true;
    return false;
}

// Non-destructive flood collect — captures gems for pop animation
// before _elmFloodFill removes them from the grid.
function _elmCollectGroup(x0, y0, gem) {
    const visited = new Set();
    const stk     = [[x0, y0]];
    const result  = [];
    while (stk.length) {
        const [x, y] = stk.pop();
        if (x < 1 || x > ELM_GCOLS || y < 1 || y > ELM_GROWS) continue;
        if (elmGrid[x][y] !== gem) continue;
        const key = x * 100 + y;   // safe: GCOLS=16 < 100
        if (visited.has(key)) continue;
        visited.add(key);
        result.push({ gx: x, gy: y, col: ELM_GEM_COL[gem] });
        stk.push([x+1,y], [x-1,y], [x,y+1], [x,y-1]);
    }
    return result;
}

// Destructive flood fill — removes gems and updates counters
function _elmFloodFill(x0, y0, gem) {
    const stk = [[x0, y0]];
    while (stk.length) {
        const [x, y] = stk.pop();
        if (x < 1 || x > ELM_GCOLS || y < 1 || y > ELM_GROWS) continue;
        if (elmGrid[x][y] !== gem) continue;
        elmGrid[x][y] = 0;
        elmBroke++;
        elmRemaining--;
        stk.push([x+1,y], [x-1,y], [x,y+1], [x,y-1]);
    }
}

function _elmDoAction(gx, gy) {
    if (!_elmHasNeighbour(gx, gy)) {
        _elmSfx(ELM_SND_NOMATCH);
        return;
    }
    const gem     = elmGrid[gx][gy];
    const popList = _elmCollectGroup(gx, gy, gem);   // save before fill removes them
    const before  = elmBroke;
    _elmFloodFill(gx, gy, gem);
    const cnt    = elmBroke - before;
    const gained = cnt * cnt;
    elmScore    += gained;

    elmPopGems  = popList;
    elmPopMs    = 0;
    elmPopCount = cnt;
    elmPopScore = gained;
    elmPhase    = "popping";

    if      (cnt >= ELM_TIER_HUGE)   { elmComboMs = 0; _elmSfx(ELM_SND_HUGE); }
    else if (cnt >= ELM_TIER_BIG)    { elmComboMs = 0; _elmSfx(ELM_SND_BIG); }
    else if (cnt >= ELM_TIER_MEDIUM) { elmComboMs = 0; _elmSfx(ELM_SND_MEDIUM); }
    else                               _elmSfx(ELM_SND_ELIM);
}

function _elmSfx(snd) {
    if (SHELL_isMuted()) return;
    snd.currentTime = 0;
    snd.play().catch(() => {});
}

// =============================================================================
// FALL ANIMATION
// =============================================================================

// Apply full gravity to the grid in one pass, recording per-cell pixel drop
// distances so each gem animates from its old row to its new row.
function _elmBeginFall() {
    elmFallData = [];
    for (let x = 0; x <= ELM_GCOLS; x++)
        elmFallData.push(new Array(ELM_GROWS + 1).fill(0));

    let anyFell = false;

    for (let x = elmCLeft; x <= elmCRight; x++) {
        // Snapshot column: collect non-empty gems with their source rows
        const colGems = [];
        for (let y = 1; y <= ELM_GROWS; y++)
            if (elmGrid[x][y] > 0) colGems.push({ srcY: y, colorIdx: elmGrid[x][y] });

        // Clear column, pack gems to bottom, record drop distance per final cell
        for (let y = 1; y <= ELM_GROWS; y++) elmGrid[x][y] = 0;
        const baseY = ELM_GROWS - colGems.length + 1;
        for (let i = 0; i < colGems.length; i++) {
            const toY  = baseY + i;
            const dist = (toY - colGems[i].srcY) * ELM_CELLPX;
            elmGrid[x][toY] = colGems[i].colorIdx;
            if (dist > 0) {
                elmFallData[x][toY] = dist;
                anyFell = true;
            }
        }
    }

    if (anyFell) {
        elmPhase = "falling";
    } else {
        _elmAfterFall();
    }
}

function _elmUpdateFall() {
    let anyLeft = false;
    for (let x = elmCLeft; x <= elmCRight; x++) {
        if (!elmFallData[x]) continue;
        for (let y = 1; y <= ELM_GROWS; y++) {
            if (elmFallData[x][y] > 0) {
                elmFallData[x][y] = Math.max(0, elmFallData[x][y] - ELM_FALL_SPD);
                if (elmFallData[x][y] > 0) anyLeft = true;
            }
        }
    }
    if (!anyLeft) {
        _elmSfx(ELM_SND_FALL);
        _elmAfterFall();
    }
}

// After fall settles: check for empty columns to slide, else check for no moves.
function _elmAfterFall() {
    for (let x = elmCLeft; x <= elmCRight; x++) {
        if (elmGrid[x][ELM_GROWS] === 0) {   // bottom empty = whole column empty after gravity
            _elmBeginSlide(x);
            return;
        }
    }
    _elmCheckNoMoves();
}

// =============================================================================
// SLIDE ANIMATION
// =============================================================================

// Apply one column swap to the grid immediately, then animate the xOff to 0.
// Alternates left/right groups on each call (elmSlideToggle).
//
// Case 1 (toggle=1): content from [cLeft..gapX-1] moves right into [cLeft+1..gapX].
//   Visual: new columns start drawn at -CELLPX (appears one col left), animate to 0.
//
// Case 2 (toggle=0): content from [gapX+1..cRight] moves left into [gapX..cRight-1].
//   Visual: new columns start drawn at +CELLPX (appears one col right), animate to 0.
function _elmBeginSlide(gapX) {
    elmSlideToggle ^= 1;
    if (elmSlideToggle) {
        for (let n = gapX; n > elmCLeft; n--)
            for (let y = 1; y <= ELM_GROWS; y++)
                [elmGrid[n][y], elmGrid[n-1][y]] = [elmGrid[n-1][y], elmGrid[n][y]];
        elmSlideBatch = { colFirst: elmCLeft + 1, colLast: gapX, xOff: -ELM_CELLPX };
        elmCLeft++;
    } else {
        for (let n = gapX; n < elmCRight; n++)
            for (let y = 1; y <= ELM_GROWS; y++)
                [elmGrid[n][y], elmGrid[n+1][y]] = [elmGrid[n+1][y], elmGrid[n][y]];
        elmSlideBatch = { colFirst: gapX, colLast: elmCRight - 1, xOff: ELM_CELLPX };
        elmCRight--;
    }
    elmPhase = "sliding";
}

function _elmUpdateSlide() {
    if (elmSlideBatch.xOff > 0) {
        elmSlideBatch.xOff = Math.max(0, elmSlideBatch.xOff - ELM_SLIDE_SPD);
    } else {
        elmSlideBatch.xOff = Math.min(0, elmSlideBatch.xOff + ELM_SLIDE_SPD);
    }
    if (elmSlideBatch.xOff === 0) {
        _elmSfx(ELM_SND_SLIDE);
        _elmAfterSlide();
    }
}

// After a slide completes: check for more empty columns, else check for no moves.
function _elmAfterSlide() {
    for (let x = elmCLeft; x <= elmCRight; x++) {
        if (elmGrid[x][ELM_GROWS] === 0) {
            _elmBeginSlide(x);
            return;
        }
    }
    _elmCheckNoMoves();
}

// =============================================================================
// NO-MOVES CHECK
// =============================================================================

function _elmCheckNoMoves() {
    let hasMoves = false;
    outer:
    for (let x = elmCLeft; x <= elmCRight; x++)
        for (let y = 1; y <= ELM_GROWS; y++)
            if (_elmHasNeighbour(x, y)) { hasMoves = true; break outer; }

    if (!hasMoves) {
        const maxLeft = elmLevel <= ELM_MERCY_TAB.length ? ELM_MERCY_TAB[elmLevel - 1] : 0;
        if (elmLevel > 0 && elmRemaining > maxLeft) {
            // no moves AND too many blocks left — but let the joker bail us out first
            if (elmJokerCount > 0) {
                elmPhase = "playing";
                return;
            }
            if (elmScore > elmPB) { elmPB = elmScore; SHELL_setPB(ELM_PB_KEY, elmPB); }
            _elmSfx(ELM_SND_GAMEOVER);
            elmPhase      = "over";
            elmOverLockMs = 0;
        } else {
            // level complete — award perfect-clear bonus here so it's tied to the advance
            if (elmRemaining === 0) {
                elmScore     += 2500;
                elmJokerCount = Math.min(ELM_JOKER_MAX, elmJokerCount + 1);
            }
            _elmSfx(ELM_SND_LEVELUP);
            elmPhase    = "splash";
            elmSplashMs = 1000;
        }
    } else {
        elmPhase = "playing";
    }
}

// =============================================================================
// JOKER
// =============================================================================

function _elmDoJoker() {
    if (elmJokerCount <= 0) return;
    elmJokerCount--;

    // Collect source gems (position + colour)
    const srcList = [];
    for (let x = elmCLeft; x <= elmCRight; x++)
        for (let y = 1; y <= ELM_GROWS; y++)
            if (elmGrid[x][y] > 0)
                srcList.push({ x, y, col: elmGrid[x][y] });

    // Build a shuffled list of ALL cells in the active area as scatter targets
    const allCells = [];
    for (let x = elmCLeft; x <= elmCRight; x++)
        for (let y = 1; y <= ELM_GROWS; y++)
            allCells.push({ x, y });
    for (let i = allCells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allCells[i], allCells[j]] = [allCells[j], allCells[i]];
    }

    // Write gems to their new (random, possibly floating) target cells
    for (let x = elmCLeft; x <= elmCRight; x++)
        for (let y = 1; y <= ELM_GROWS; y++)
            elmGrid[x][y] = 0;
    for (let i = 0; i < srcList.length; i++)
        elmGrid[allCells[i].x][allCells[i].y] = srcList[i].col;

    // Fix isolated loners in the destination grid
    _elmFixSingles();

    // Build animation records — from = old pixel pos, to = new pixel pos.
    // Colours are read from the grid after _elmFixSingles so they match exactly.
    elmShuffleGems = [];
    for (let i = 0; i < srcList.length; i++) {
        const src = srcList[i];
        const dst = allCells[i];
        elmShuffleGems.push({
            col:   ELM_GEM_COL[elmGrid[dst.x][dst.y]],
            fromX: ELM_BX + (src.x - 1) * ELM_CELLPX,
            fromY: ELM_BY + (src.y - 1) * ELM_CELLPX,
            toX:   ELM_BX + (dst.x - 1) * ELM_CELLPX,
            toY:   ELM_BY + (dst.y - 1) * ELM_CELLPX
        });
    }

    elmShuffleMs = 0;
    elmPhase     = "shuffling";
    _elmSfx(ELM_SND_SHUFFLE);
}

// Called when the scatter-fly animation finishes — hand off to gravity chain.
function _elmEndShuffle() {
    elmShuffleGems = [];
    _elmBeginFall();
}

// Smooth ease-in-out for shuffle flight  (t in [0,1] → [0,1])
function _elmEaseInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// =============================================================================
// INPUT
// =============================================================================

function _elmScreenToGrid(mx, my) {
    if (mx < ELM_BX || mx >= ELM_BX + ELM_BW ||
        my < ELM_BY || my >= ELM_BY + ELM_BH) return null;
    const gx = 1 + Math.floor((mx - ELM_BX) / ELM_CELLPX);
    const gy = 1 + Math.floor((my - ELM_BY) / ELM_CELLPX);
    if (gx < 1 || gx > ELM_GCOLS || gy < 1 || gy > ELM_GROWS) return null;
    return { gx, gy };
}

// =============================================================================
// DRAWING HELPERS
// =============================================================================

function _elmMf(sz)  { return sz + "px monospace"; }
function _elmMbf(sz) { return "bold " + sz + "px monospace"; }
function _elmMsf(sz) { return "bold " + sz + "px sans-serif"; }

function _elmRrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y,     x + w, y + r,     r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x,      y + h, x,       y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x,      y,     x + r,   y,         r);
    ctx.closePath();
}

// Gem cell with subtle 2-tone bevel — lighter top-left, darker bottom-right
function _elmDrawGem(px, py, col) {
    const ctx = _cx;
    const pad = 1;
    const sz  = ELM_CELLPX - 2;
    ctx.fillStyle = col;
    ctx.fillRect(px + pad, py + pad, sz, sz);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(px + pad, py + pad, sz, 3);
    ctx.fillRect(px + pad, py + pad, 3, sz);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(px + pad, py + pad + sz - 3, sz, 3);
    ctx.fillRect(px + pad + sz - 3, py + pad, 3, sz);
}

// =============================================================================
// DRAW — HUD strip
// =============================================================================

function _elmDrawHUD() {
    const ctx = _cx;
    ctx.fillStyle = ELM_CLR_HUD_BG;
    ctx.fillRect(0, 0, V2_CW, ELM_HUD_H);
    ctx.fillStyle = ELM_CLR_HUD_SEP;
    ctx.fillRect(0, ELM_HUD_H - 1, V2_CW, 1);
    ctx.textBaseline = "alphabetic";

    // During splash, show the incoming level number so HUD matches announcement
    const hudLevel = (elmPhase === "splash") ? elmLevel + 1 : elmLevel;

    ctx.textAlign = "left";
    ctx.font      = _elmMf(11);
    ctx.fillStyle = ELM_CLR_HUD_LBL;
    ctx.fillText("LEVEL",   ELM_HUD_LVL_X, 19);
    ctx.fillText("CLEARED", ELM_HUD_BLK_X, 19);
    ctx.font      = _elmMbf(20);
    ctx.fillStyle = ELM_CLR_HUD_VAL;
    ctx.fillText(String(hudLevel),                       ELM_HUD_LVL_X, 38);
    ctx.fillText(String(elmBroke).padStart(5, "0"),      ELM_HUD_BLK_X, 38);

    ctx.textAlign = "center";
    ctx.font      = _elmMf(11);
    ctx.fillStyle = ELM_CLR_HUD_LBL;
    ctx.fillText("SCORE", ELM_HUD_SCR_X, 19);
    ctx.font      = _elmMbf(20);
    ctx.fillStyle = ELM_CLR_HUD_VAL;
    ctx.fillText(String(elmScore).padStart(7, "0"), ELM_HUD_SCR_X, 38);

    // BEST — hidden until at least one personal best is recorded
    if (elmPB > 0) {
        const pbHi = elmScore >= elmPB;
        ctx.textAlign = "right";
        ctx.font      = _elmMf(11);
        ctx.fillStyle = ELM_CLR_HUD_LBL;
        ctx.fillText("BEST", ELM_HUD_PB_X, 19);
        ctx.font      = _elmMbf(20);
        ctx.fillStyle = pbHi ? ELM_CLR_HUD_PB_HI : ELM_CLR_HUD_VAL;
        ctx.fillText(String(elmPB).padStart(7, "0"), ELM_HUD_PB_X, 38);
    }
    ctx.textAlign = "left";
}

// =============================================================================
// DRAW — board  (handles all animation phases inline)
// =============================================================================

function _elmDrawBoard() {
    const ctx = _cx;

    ctx.fillStyle = ELM_CLR_PF_BG;
    ctx.fillRect(ELM_BX, ELM_BY, ELM_BW, ELM_BH);

    // Shuffle animation — draw each gem lerped between its old and new pixel position.
    // The normal grid loop is skipped entirely during this phase.
    if (elmPhase === "shuffling") {
        const t = _elmEaseInOut(Math.min(1.0, elmShuffleMs / ELM_SHUFFLE_DUR));
        for (const sg of elmShuffleGems) {
            const px = sg.fromX + (sg.toX - sg.fromX) * t;
            const py = sg.fromY + (sg.toY - sg.fromY) * t;
            _elmDrawGem(px, py, sg.col);
        }
        return;
    }

    // Active gems — with fall / slide offsets applied per phase
    for (let y = 1; y <= ELM_GROWS; y++) {
        for (let x = 1; x <= ELM_GCOLS; x++) {
            const v = elmGrid[x][y];
            if (!v) continue;
            let drawX = ELM_BX + (x - 1) * ELM_CELLPX;
            let drawY = ELM_BY + (y - 1) * ELM_CELLPX;

            if (elmPhase === "falling" && elmFallData[x] && elmFallData[x][y] > 0)
                drawY -= elmFallData[x][y];

            if (elmPhase === "sliding" &&
                x >= elmSlideBatch.colFirst && x <= elmSlideBatch.colLast)
                drawX += elmSlideBatch.xOff;

            _elmDrawGem(drawX, drawY, ELM_GEM_COL[v]);
        }
    }

    // Popping gems: scale from 1.0 -> 0 over ELM_POP_DUR ms, centred on each cell.
    // Grid cells are already cleared so these draw on top of empty space.
    if (elmPhase === "popping") {
        const scl      = Math.max(0, 1.0 - elmPopMs / ELM_POP_DUR);
        const halfCell = ELM_CELLPX / 2;
        for (const pg of elmPopGems) {
            const pcx = ELM_BX + (pg.gx - 1) * ELM_CELLPX + halfCell;
            const pcy = ELM_BY + (pg.gy - 1) * ELM_CELLPX + halfCell;
            const sz  = Math.max(0, (ELM_CELLPX - 2) * scl);
            if (sz < 1) continue;
            ctx.fillStyle = pg.col;
            ctx.fillRect(pcx - sz / 2, pcy - sz / 2, sz, sz);
            if (sz > 6) {
                const hi = Math.max(1, Math.round(sz * 0.09));
                ctx.fillStyle = "rgba(255,255,255,0.22)";
                ctx.fillRect(pcx - sz / 2, pcy - sz / 2, sz, hi);
                ctx.fillRect(pcx - sz / 2, pcy - sz / 2, hi, sz);
            }
        }
    }
}

// =============================================================================
// DRAW — combo label (triggered by medium / big / huge clears, fades out)
// =============================================================================

function _elmDrawComboLabel() {
    if (elmPopCount < ELM_TIER_MEDIUM) return;
    if (elmComboMs >= ELM_COMBO_TOTAL_DUR) return;
    if (elmPhase === "splash" || elmPhase === "over") return;

    const ctx  = _cx;
    const midX = ELM_BX + Math.floor(ELM_BW / 2);
    const yp   = ELM_BY + Math.round(ELM_BH / 3);

    let txt, col;
    if (elmPopCount >= ELM_TIER_HUGE) {
        txt = "INSANE!  +" + elmPopScore;
        col = ELM_CLR_COMBO_HUGE;
    } else if (elmPopCount >= ELM_TIER_BIG) {
        txt = "HUGE!  +" + elmPopScore;
        col = ELM_CLR_COMBO_BIG;
    } else {
        txt = "NICE!  +" + elmPopScore;
        col = ELM_CLR_COMBO_MED;
    }

    // alpha: full until fade window, then ramp to 0
    const fadeStart = ELM_COMBO_TOTAL_DUR - ELM_COMBO_FADE_DUR;
    let alpha = 1.0;
    if (elmComboMs > fadeStart)
        alpha = Math.max(0.0, 1.0 - (elmComboMs - fadeStart) / ELM_COMBO_FADE_DUR);

    ctx.font         = _elmMsf(30);
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha  = alpha;

    // double-stroke outline: thick dark behind, thin white on top, colour fill last
    ctx.lineWidth   = 6;
    ctx.strokeStyle = "#000000";
    ctx.strokeText(txt, midX, yp);
    ctx.lineWidth   = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.70)";
    ctx.strokeText(txt, midX, yp);
    ctx.fillStyle   = col;
    ctx.fillText(txt, midX, yp);

    ctx.globalAlpha  = 1.0;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign    = "left";
}

// =============================================================================
// DRAW — joker button (right margin, hidden during splash / over)
// =============================================================================

function _elmDrawJoker() {
    if (elmPhase === "splash" || elmPhase === "over" || elmPhase === "shuffling") return;
    const ctx       = _cx;
    const clickable = elmPhase === "playing" && elmJokerCount > 0;
    const bx        = ELM_JKR_X;
    const by        = ELM_JKR_Y;
    const bcx       = bx + ELM_JKR_W / 2;

    ctx.fillStyle = clickable ? ELM_CLR_JKR_BG : ELM_CLR_JKR_OFF_BG;
    _elmRrect(ctx, bx, by, ELM_JKR_W, ELM_JKR_H, ELM_JKR_R);
    ctx.fill();
    ctx.strokeStyle = clickable ? ELM_CLR_JKR_BD : ELM_CLR_JKR_OFF_BD;
    ctx.lineWidth   = 1.5;
    _elmRrect(ctx, bx, by, ELM_JKR_W, ELM_JKR_H, ELM_JKR_R);
    ctx.stroke();

    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle    = clickable ? ELM_CLR_JKR_TXT : ELM_CLR_JKR_OFF_TXT;
    ctx.font         = _elmMf(26);
    ctx.fillText("\u21BA", bcx, by + ELM_JKR_H / 2 - 10);   // anticlockwise open circle arrow
    ctx.font         = _elmMbf(15);
    ctx.fillText("\xD7" + elmJokerCount, bcx, by + ELM_JKR_H / 2 + 16);

    ctx.textAlign    = "left";
    ctx.textBaseline = "alphabetic";
}

// =============================================================================
// DRAW — level splash (board-area overlay only)
// =============================================================================

function _elmDrawSplash() {
    if (elmPhase !== "splash") return;
    const ctx  = _cx;
    const midX = ELM_BX + Math.floor(ELM_BW / 2);
    const midY = ELM_BY + Math.floor(ELM_BH / 2);

    ctx.fillStyle = ELM_CLR_SPL_BG;
    ctx.fillRect(ELM_BX, ELM_BY, ELM_BW, ELM_BH);

    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.font         = _elmMsf(22);
    ctx.fillStyle    = ELM_CLR_SPL_SUB;
    ctx.fillText(elmLevel === 0 ? "GET READY" : "LEVEL COMPLETE!", midX, midY - 34);
    ctx.font         = _elmMsf(52);
    ctx.fillStyle    = ELM_CLR_SPL_TXT;
    ctx.fillText("LEVEL " + (elmLevel + 1), midX, midY + 18);

    ctx.textAlign    = "left";
    ctx.textBaseline = "alphabetic";
}

// =============================================================================
// DRAW — game over overlay (full canvas)
// =============================================================================

function _elmDrawGameOver() {
    if (elmPhase !== "over") return;
    const ctx  = _cx;
    const midX = Math.floor(V2_CW / 2);
    const midY = Math.floor(V2_CH / 2);

    ctx.fillStyle = ELM_CLR_OVR;
    ctx.fillRect(0, 0, V2_CW, V2_CH);

    ctx.textAlign    = "center";
    ctx.textBaseline = "alphabetic";

    ctx.font      = _elmMsf(34);
    ctx.fillStyle = ELM_CLR_OVR_HDL;
    ctx.fillText("NO MOVES!", midX, midY - 72);

    ctx.font      = _elmMf(14);
    ctx.fillStyle = ELM_CLR_OVR_LBL;
    ctx.fillText("FINAL SCORE", midX, midY - 28);

    ctx.font      = _elmMbf(52);
    ctx.fillStyle = ELM_CLR_OVR_SCR;
    ctx.fillText(String(elmScore).padStart(7, "0"), midX, midY + 26);

    if (elmPB > 0) {
        const isNew   = elmScore >= elmPB;
        ctx.font      = isNew ? _elmMbf(14) : _elmMf(12);
        ctx.fillStyle = isNew ? ELM_CLR_OVR_PB_HI : ELM_CLR_OVR_PB;
        ctx.fillText(
            isNew ? "NEW BEST! \u2B50" : "BEST: " + String(elmPB).padStart(7, "0"),
            midX, midY + 50
        );
    }

    // PLAY AGAIN button — locked / grey for first 1000 ms
    const locked = elmOverLockMs < 1000;
    const btnX   = midX - 100;
    const btnY   = midY + 68;
    ctx.fillStyle = locked ? ELM_CLR_BTN_OFF_BG : ELM_CLR_BTN_ON_BG;
    _elmRrect(ctx, btnX, btnY, 200, 52, 14);
    ctx.fill();
    ctx.strokeStyle = locked ? ELM_CLR_BTN_OFF_BD : ELM_CLR_BTN_ON_BD;
    ctx.lineWidth   = 2;
    _elmRrect(ctx, btnX, btnY, 200, 52, 14);
    ctx.stroke();
    ctx.font         = _elmMsf(20);
    ctx.fillStyle    = ELM_CLR_BTN_TXT;
    ctx.textBaseline = "middle";
    ctx.fillText(locked ? "WAIT..." : "PLAY AGAIN", midX, btnY + 26);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign    = "left";
}

// =============================================================================
// DRAW — main
// =============================================================================

function _elmDraw() {
    const ctx = _cx;

    // Solid base — always drawn as bg fallback
    ctx.fillStyle = ELM_CLR_BG;
    ctx.fillRect(0, 0, V2_CW, V2_CH);

    // Background image — cover-cropped below HUD strip
    if (SHELL_isBgEnabled() && elmBgReady) {
        const areaW = V2_CW;
        const areaH = V2_CH - ELM_HUD_H;
        const scl   = Math.max(areaW / ELM_BG_IMG.naturalWidth, areaH / ELM_BG_IMG.naturalHeight);
        const dw    = ELM_BG_IMG.naturalWidth  * scl;
        const dh    = ELM_BG_IMG.naturalHeight * scl;
        const ddx   = (areaW - dw) / 2;
        const ddy   = ELM_HUD_H + (areaH - dh) / 2;
        ctx.drawImage(ELM_BG_IMG, ddx, ddy, dw, dh);
    }

    _elmDrawHUD();
    _elmDrawBoard();
    _elmDrawComboLabel();
    _elmDrawJoker();
    _elmDrawSplash();
    _elmDrawGameOver();
}
