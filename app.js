const STORAGE_KEY = "bvtracker:doubles:v2";

/** Target average for next rank (hardcoded per your request) */
const NEXT_RANK_TARGET_AVG = 457; // you said: “need 457 points in total, currently 254”

/** BV points table */
const POINTS_BY_CLASS = {
    1: 2831, 2: 1961, 3: 1359, 4: 942, 5: 652, 6: 452,
    7: 313, 8: 217, 9: 150, 10: 104, 11: 72, 12: 50
};

function doublesWinPoints(oppClass1, oppClass2) {
    const p1 = POINTS_BY_CLASS[oppClass1];
    const p2 = POINTS_BY_CLASS[oppClass2];
    return Math.round((p1 + p2) / 2);
}

function calculateStijgenAverage(matches) {
    const window = [...matches]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 20);

    const totalPoints = window.reduce((sum, m) => sum + (m.points || 0), 0);
    const validCount = window.length;
    const divisor = validCount < 7 ? 7 : validCount;

    const avg = Math.floor(totalPoints / divisor);
    return { avg, totalPoints, windowCount: validCount };
}

function loadMatches() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}
function saveMatches(matches) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
}

/** DD-MM-YYYY */
function formatDateDDMMYYYY(isoDate) {
    const d = new Date(isoDate + "T00:00:00");
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
}

/** Random but consistent with win/loss */
function randomScore(isWin) {
    const winSets = isWin ? 2 : 0;
    const loseSets = isWin ? 0 : 2;

    // simple straight-sets results
    if (isWin) {
        const s1 = [21, 14 + Math.floor(Math.random() * 7)];
        const s2 = [21, 14 + Math.floor(Math.random() * 7)];
        return [s1, s2];
    } else {
        const s1 = [14 + Math.floor(Math.random() * 7), 21];
        const s2 = [14 + Math.floor(Math.random() * 7), 21];
        return [s1, s2];
    }
}

/** Infer opponent ranks from a doubles points value (works for ALL values) */
function inferOppRanksFromPoints(points) {
    // Build all rank pairs (1..12) and see which ones round-average to `points`
    const candidates = [];

    for (let r1 = 1; r1 <= 12; r1++) {
        for (let r2 = r1; r2 <= 12; r2++) {
            const p1 = POINTS_BY_CLASS[r1];
            const p2 = POINTS_BY_CLASS[r2];
            const avgRounded = Math.round((p1 + p2) / 2);

            if (avgRounded === points) {
                candidates.push([r1, r2]);
            }
        }
    }

    // If nothing matches, fall back (this can happen if points is not a real rounded average)
    if (candidates.length === 0) return [6, 7];

    // Prefer pairs that look "reasonable":
    // 1) smallest rank difference (e.g., 6-7 is nicer than 3-12)
    // 2) then lowest total (leans to stronger opponents when tie)
    candidates.sort((a, b) => {
        const diffA = Math.abs(a[0] - a[1]);
        const diffB = Math.abs(b[0] - b[1]);
        if (diffA !== diffB) return diffA - diffB;

        const sumA = a[0] + a[1];
        const sumB = b[0] + b[1];
        return sumA - sumB;
    });

    return candidates[0];
}


/* Seed baseline if empty */
function seedBaselineIfEmpty() {
    const existing = loadMatches();
    if (existing.length) return;

    const rawBaseline = [
        { date: "2026-02-15", points: 452, isWin: true },
        { date: "2026-02-14", points: 383, isWin: true },
        { date: "2026-02-14", points: 0, isWin: false },

        { date: "2026-02-08", points: 552, isWin: true },
        { date: "2026-02-08", points: 0, isWin: false },

        { date: "2026-02-07", points: 0, isWin: false },
        { date: "2026-02-07", points: 0, isWin: false },
        { date: "2026-02-07", points: 0, isWin: false },

        { date: "2026-01-11", points: 797, isWin: true },
        { date: "2026-01-11", points: 0, isWin: false },

        { date: "2026-01-10", points: 552, isWin: true },
        { date: "2026-01-10", points: 483, isWin: true },
        { date: "2026-01-10", points: 0, isWin: false },
        { date: "2026-01-10", points: 0, isWin: false },

        { date: "2026-01-03", points: 383, isWin: true },
        { date: "2026-01-03", points: 483, isWin: true },
        { date: "2026-01-03", points: 452, isWin: true },

        { date: "2025-12-21", points: 0, isWin: false },
        { date: "2025-12-21", points: 0, isWin: false },

        { date: "2025-12-20", points: 552, isWin: true },
        { date: "2025-12-20", points: 452, isWin: true },
        { date: "2025-12-20", points: 383, isWin: true },
        { date: "2025-12-20", points: 452, isWin: true }
    ];

    const seeded = rawBaseline.map(m => {
        const [opp1, opp2] = m.isWin ? inferOppRanksFromPoints(m.points) : [6, 7];
        return {
            date: m.date,
            myClass: 5,
            partnerClass: 5,
            opp1Class: opp1,
            opp2Class: opp2,
            isWin: m.isWin,
            points: m.points,
            score: randomScore(m.isWin)
        };
    });

    saveMatches(seeded);
}

/* UI elements */
const els = {
    tabs: document.querySelectorAll(".tab"),
    pages: {
        doubles: document.getElementById("page-doubles"),
        singles: document.getElementById("page-singles"),
        mix: document.getElementById("page-mix")
    },
    avgValue: document.getElementById("avgValue"),
    neededValue: document.getElementById("neededValue"),
    neededSub: document.getElementById("neededSub"),
    progressBar: document.getElementById("progressBar"),
    matchCount: document.getElementById("matchCount"),
    tbody: document.getElementById("matchesTbody"),

    btnAddMatch: document.getElementById("btnAddMatch"),
    btnReset: document.getElementById("btnReset"),

    modal: document.getElementById("modal"),
    btnCloseModal: document.getElementById("btnCloseModal"),
    matchForm: document.getElementById("matchForm"),

    mDate: document.getElementById("mDate"),
    myClass: document.getElementById("myClass"),
    partnerClass: document.getElementById("partnerClass"),
    opp1Class: document.getElementById("opp1Class"),
    opp2Class: document.getElementById("opp2Class"),

    s1a: document.getElementById("s1a"),
    s1b: document.getElementById("s1b"),
    s2a: document.getElementById("s2a"),
    s2b: document.getElementById("s2b"),
    s3a: document.getElementById("s3a"),
    s3b: document.getElementById("s3b"),
    set3Row: document.getElementById("set3Row"),
    btnAutoThird: document.getElementById("btnAutoThird"),

    computedResult: document.getElementById("computedResult"),
    computedPoints: document.getElementById("computedPoints")
};

function setActiveTab(key) {
    els.tabs.forEach(btn => {
        const active = btn.dataset.tab === key;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    Object.entries(els.pages).forEach(([k, el]) => {
        el.classList.toggle("is-active", k === key);
    });
}

function openModal() {
    els.modal.classList.add("is-open");
    els.modal.setAttribute("aria-hidden", "false");
}
function closeModal() {
    els.modal.classList.remove("is-open");
    els.modal.setAttribute("aria-hidden", "true");
}

function formatScore(score) {
    if (!score || !score.length) return "–";
    return score.map(s => `${s[0]}–${s[1]}`).join(", ");
}

function render() {
    const matches = loadMatches().sort((a, b) => new Date(b.date) - new Date(a.date));

    const { avg } = calculateStijgenAverage(matches);
    els.avgValue.textContent = String(avg);
    els.matchCount.textContent = String(matches.length);

    const needed = Math.max(0, NEXT_RANK_TARGET_AVG - avg);
    els.neededValue.textContent = String(needed);
    els.neededSub.textContent = `Target: ${NEXT_RANK_TARGET_AVG} · Current: ${avg}`;

    const progress = Math.max(0, Math.min(1, avg / NEXT_RANK_TARGET_AVG));
    els.progressBar.style.width = `${Math.round(progress * 100)}%`;

    els.tbody.innerHTML = "";

    matches.forEach((m, idx) => {
        const tr = document.createElement("tr");
        tr.classList.add(m.isWin ? "row-win" : "row-loss");

        const pointsBadge = m.isWin
            ? `<span class="badge win"><span class="points">${m.points}</span></span>`
            : `<span class="badge loss"><span class="points">0</span></span>`;

        tr.innerHTML = `
      <td>${formatDateDDMMYYYY(m.date)}</td>
      <td><strong>${formatScore(m.score)}</strong></td>
      <td>${pointsBadge}</td>
      <td>
        <button class="iconbtn" data-del="${idx}">Delete</button>
      </td>
    `;

        els.tbody.appendChild(tr);
    });

    document.querySelectorAll("[data-del]").forEach(btn => {
        btn.addEventListener("click", () => {
            const i = Number(btn.getAttribute("data-del"));
            const current = loadMatches().sort((a, b) => new Date(b.date) - new Date(a.date));
            current.splice(i, 1);
            saveMatches(current);
            render();
        });
    });
}

/* Add match form logic (unchanged core behavior) */
function parseIntSafe(v) {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
}

function computeWinnerFromSets(sets) {
    let usWins = 0;
    let themWins = 0;

    for (const [a, b] of sets) {
        if (a == null || b == null) continue;
        if (a === b) continue;
        if (a > b) usWins++;
        else themWins++;
    }
    if (usWins >= 2) return true;
    if (themWins >= 2) return false;
    return null;
}

function getSetsFromForm() {
    const s1 = [parseIntSafe(els.s1a.value), parseIntSafe(els.s1b.value)];
    const s2 = [parseIntSafe(els.s2a.value), parseIntSafe(els.s2b.value)];
    const sets = [s1, s2];

    const thirdVisible = els.set3Row.style.display !== "none";
    if (thirdVisible) {
        sets.push([parseIntSafe(els.s3a.value), parseIntSafe(els.s3b.value)]);
    }
    return sets;
}

function updateComputedPreview() {
    const opp1 = parseIntSafe(els.opp1Class.value);
    const opp2 = parseIntSafe(els.opp2Class.value);

    const sets = getSetsFromForm();
    const isWin = computeWinnerFromSets(sets);

    els.computedResult.textContent = isWin === null ? "–" : (isWin ? "WIN" : "LOSS");
    if (isWin === null) return (els.computedPoints.textContent = "–");

    els.computedPoints.textContent = String(isWin ? doublesWinPoints(opp1, opp2) : 0);
}

/* Events */
els.tabs.forEach(btn => btn.addEventListener("click", () => setActiveTab(btn.dataset.tab)));

els.btnAddMatch.addEventListener("click", () => {
    const today = new Date();
    els.mDate.value = today.toISOString().slice(0, 10);

    els.s1a.value = ""; els.s1b.value = "";
    els.s2a.value = ""; els.s2b.value = "";
    els.s3a.value = ""; els.s3b.value = "";
    els.set3Row.style.display = "none";

    updateComputedPreview();
    openModal();
});

els.btnReset.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    seedBaselineIfEmpty();
    render();
});

document.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", closeModal));
els.btnCloseModal.addEventListener("click", closeModal);

els.btnAutoThird.addEventListener("click", () => {
    const visible = els.set3Row.style.display !== "none";
    els.set3Row.style.display = visible ? "none" : "flex";
    updateComputedPreview();
});

[
    els.opp1Class, els.opp2Class,
    els.s1a, els.s1b, els.s2a, els.s2b, els.s3a, els.s3b
].forEach(el => el.addEventListener("input", updateComputedPreview));

els.matchForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const date = els.mDate.value;
    const myClass = parseIntSafe(els.myClass.value);
    const partnerClass = parseIntSafe(els.partnerClass.value);
    const opp1Class = parseIntSafe(els.opp1Class.value);
    const opp2Class = parseIntSafe(els.opp2Class.value);

    const sets = getSetsFromForm();
    const isWin = computeWinnerFromSets(sets);

    if (!date) return alert("Please select a date.");
    if ([myClass, partnerClass, opp1Class, opp2Class].some(v => v == null || v < 1 || v > 12)) {
        return alert("All rank fields must be between 1 and 12.");
    }
    if (isWin === null) return alert("Enter valid set scores (best of 3).");

    const points = isWin ? doublesWinPoints(opp1Class, opp2Class) : 0;

    const newMatch = {
        date,
        myClass,
        partnerClass,
        opp1Class,
        opp2Class,
        isWin,
        points,
        score: sets.filter(s => s[0] != null && s[1] != null)
    };

    const matches = loadMatches();
    matches.push(newMatch);
    saveMatches(matches);

    closeModal();
    render();
});

/* Init */
seedBaselineIfEmpty();
render();
