// ============================================================
//   MK WORLD VR SYSTEM — app.js
// ============================================================

// ---- DOM Elements ----
const vrInput       = document.getElementById('vrInput');
const saveBtn       = document.getElementById('saveBtn');
const historyList   = document.getElementById('historyList');
const chartEmpty    = document.getElementById('chartEmpty');

// ---- State ----
let vrData = JSON.parse(localStorage.getItem('mk_vr_data')) || [];
let vrChartInstance = null;
let currentChartPeriod = 'all';

// ---- Utilities ----
const formatDate = (isoString) => {
    const d = new Date(isoString);
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    const hh   = String(d.getHours()).padStart(2, '0');
    const min  = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
};

const formatShortDate = (isoString) => {
    const d = new Date(isoString);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

const fmtDiff = (n) => n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString();

// ---- Save ----
const saveVR = () => {
    const val = vrInput.value.trim();
    if (!val || isNaN(val) || Number(val) <= 0) {
        vrInput.focus();
        vrInput.style.animation = 'none';
        requestAnimationFrame(() => {
            vrInput.style.animation = 'shake 0.3s ease';
        });
        return;
    }
    const newEntry = {
        id:         crypto.randomUUID(),
        vr_score:   parseInt(val, 10),
        created_at: new Date().toISOString()
    };
    vrData.push(newEntry);
    localStorage.setItem('mk_vr_data', JSON.stringify(vrData));
    vrInput.value = '';
    renderAll();
};

// ---- Render All ----
const renderAll = () => {
    renderKPI();
    renderCondition();
    renderAnalysis();
    renderChart();
    renderHistory();
};

// ---- Condition: Form Meter & Win Rate ----
const DOW_NAMES = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
const TIME_BRACKETS = [
    { label: '深夜 (0〜5時)',   start: 0,  end: 5  },
    { label: '朝  (6〜11時)',  start: 6,  end: 11 },
    { label: '昼  (12〜17時)', start: 12, end: 17 },
    { label: '夜  (18〜23時)', start: 18, end: 23 },
];

const getTimeBracket = (hour) => TIME_BRACKETS.find(b => hour >= b.start && hour <= b.end);

// 勝率計算: chronologicalなデータ列から「指定インデックスのdiffが正」を勝ちとみなす
const calcWinRate = (records) => {
    // recordsは時系列順。各recordに対し「前の記録より上昇したか」を判定
    if (records.length < 2) return null;
    const sorted = [...records].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    let wins = 0, total = 0;
    for (let i = 1; i < sorted.length; i++) {
        total++;
        if (sorted[i].vr_score > sorted[i - 1].vr_score) wins++;
    }
    return { wins, total, rate: Math.round(wins / total * 100) };
};

const setWinrateBar = (fillEl, pctEl, subEl, result, labelEl, bracketLabel) => {
    if (!result || result.total === 0) {
        fillEl.style.width = '0%';
        fillEl.className = 'winrate-bar-fill';
        pctEl.textContent = '--%';
        subEl.textContent = 'データ不足';
        labelEl.textContent = bracketLabel;
        return;
    }
    const { wins, total, rate } = result;
    fillEl.style.width = `${rate}%`;
    fillEl.className = 'winrate-bar-fill ' + (rate >= 60 ? 'good' : rate >= 40 ? 'average' : 'bad');
    pctEl.textContent = `${rate}%`;
    subEl.textContent = `${total}記録中 ${wins}回上昇`;
    labelEl.textContent = bracketLabel;
};

const renderCondition = () => {
    const now = new Date();
    const currentDow   = now.getDay();
    const currentHour  = now.getHours();
    const bracket      = getTimeBracket(currentHour);

    // --- 調子メーター（直近5セッション）---
    const formFill  = document.getElementById('formMeterFill');
    const formPct   = document.getElementById('formPct');
    const formLbl   = document.getElementById('formLabel');
    const formBasis = document.getElementById('formBasis');

    const sorted = [...vrData].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const SESSION_N = 5;
    const recent = sorted.slice(-Math.min(sorted.length, SESSION_N + 1));
    const recentDiffs = recent.slice(1).map((r, i) => r.vr_score - recent[i].vr_score);

    if (recentDiffs.length === 0) {
        formFill.style.width = '0%';
        formPct.textContent = '--';
        formPct.className = 'meter-pct';
        formLbl.textContent = 'データ不足';
        formLbl.className = 'meter-label-text';
        formBasis.textContent = '直近5セッション';
    } else {
        const wins = recentDiffs.filter(d => d > 0).length;
        const pct  = Math.round(wins / recentDiffs.length * 100);
        formFill.style.width = `${pct}%`;
        formPct.textContent = `${pct}%`;
        formBasis.textContent = `直近${recentDiffs.length}セッション`;

        let level, labelText, colorClass;
        if      (pct >= 80) { level = 'excellent'; labelText = '絶好調！'; }
        else if (pct >= 60) { level = 'good';      labelText = '好調';     }
        else if (pct >= 40) { level = 'average';   labelText = '普通';     }
        else if (pct >= 20) { level = 'poor';      labelText = '不調';     }
        else                { level = 'bad';       labelText = '絶不調…';  }

        formPct.className = `meter-pct form-${level}`;
        formLbl.textContent = labelText;
        formLbl.className = `meter-label-text form-${level}`;
    }

    // --- 曜日 & 時間帯 勝率 ---
    document.getElementById('winrateTitle').textContent =
        `${DOW_NAMES[currentDow]} / ${bracket ? bracket.label.trim() : '--'} の勝率`;

    // 同じ曜日のデータ（前のレコードとの差分を当日分として計算）
    const dowRecords = sorted.filter(r => new Date(r.created_at).getDay() === currentDow);
    const dowResult  = calcWinRate(dowRecords);
    setWinrateBar(
        document.getElementById('dowBarFill'),
        document.getElementById('dowPct'),
        document.getElementById('dowSub'),
        dowResult,
        document.getElementById('dowLabel'),
        DOW_NAMES[currentDow]
    );

    // 同じ時間帯のデータ
    const timeRecords = bracket
        ? sorted.filter(r => {
            const h = new Date(r.created_at).getHours();
            return h >= bracket.start && h <= bracket.end;
          })
        : [];
    const timeResult = calcWinRate(timeRecords);
    setWinrateBar(
        document.getElementById('timeBarFill'),
        document.getElementById('timePct'),
        document.getElementById('timeSub'),
        timeResult,
        document.getElementById('timeLabel'),
        bracket ? bracket.label : '---'
    );
};

// ---- KPI ----
const renderKPI = () => {
    const elCurrent = document.getElementById('kpiCurrent');
    const elDiff    = document.getElementById('kpiDiff');
    const elPB      = document.getElementById('kpiPB');
    const elPBDate  = document.getElementById('kpiPBDate');
    const elAvg     = document.getElementById('kpiAvg');
    const elAvgSub  = document.getElementById('kpiAvgSub');
    const elCount   = document.getElementById('kpiCount');
    const elPeriod  = document.getElementById('kpiPeriod');

    if (vrData.length === 0) {
        [elCurrent, elPB, elAvg].forEach(el => { el.textContent = '---'; });
        [elDiff, elPBDate, elAvgSub, elPeriod].forEach(el => { el.textContent = ''; });
        elCount.textContent = '0';
        return;
    }

    // Sort chronologically
    const sorted = [...vrData].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const latest = sorted[sorted.length - 1];
    const prev   = sorted.length >= 2 ? sorted[sorted.length - 2] : null;

    // Current VR
    elCurrent.textContent = latest.vr_score.toLocaleString();

    // Diff from previous
    if (prev) {
        const d = latest.vr_score - prev.vr_score;
        elDiff.textContent = fmtDiff(d);
        elDiff.className = 'kpi-diff ' + (d > 0 ? 'diff-up' : d < 0 ? 'diff-down' : 'diff-none');
    } else {
        elDiff.textContent = '最初の記録';
        elDiff.className = 'kpi-diff diff-none';
    }

    // Personal Best
    const pbEntry = vrData.reduce((best, cur) => cur.vr_score > best.vr_score ? cur : best, vrData[0]);
    elPB.textContent = pbEntry.vr_score.toLocaleString();
    elPBDate.textContent = formatShortDate(pbEntry.created_at);

    // Average
    const avg = Math.round(vrData.reduce((s, r) => s + r.vr_score, 0) / vrData.length);
    elAvg.textContent = avg.toLocaleString();
    const diffFromAvg = latest.vr_score - avg;
    elAvgSub.textContent = `LATEST ${fmtDiff(diffFromAvg)}`;
    elAvgSub.style.color = diffFromAvg >= 0 ? 'var(--green)' : 'var(--red)';

    // Count & Period
    elCount.textContent = vrData.length;
    if (vrData.length >= 2) {
        const first = sorted[0];
        const ms = new Date(latest.created_at) - new Date(first.created_at);
        const days = Math.floor(ms / 86400000);
        elPeriod.textContent = days === 0 ? '本日' : `${days}日間`;
    } else {
        elPeriod.textContent = '';
    }
};

// ---- Session Analysis ----
const renderAnalysis = () => {
    const elMaxGain     = document.getElementById('statMaxGain');
    const elMaxLoss     = document.getElementById('statMaxLoss');
    const elWinStreak   = document.getElementById('statWinStreak');
    const elLoseStreak  = document.getElementById('statLoseStreak');
    const elTrend7d     = document.getElementById('statTrend7d');
    const elTrend30d    = document.getElementById('statTrend30d');
    const elLast10Rate  = document.getElementById('statLast10Rate');
    const elLast10Sub   = document.getElementById('statLast10Sub');

    if (vrData.length < 2) {
        [elMaxGain, elMaxLoss, elWinStreak, elLoseStreak, elTrend7d, elTrend30d]
            .forEach(el => { el.textContent = '---'; el.className = 'stat-value'; });
        elLast10Rate.textContent = '---';
        elLast10Rate.className = 'stat-value';
        elLast10Sub.textContent = '';
        return;
    }

    const sorted = [...vrData].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const diffs = sorted.slice(1).map((cur, i) => cur.vr_score - sorted[i].vr_score);

    // Max gain / loss
    const maxGain = Math.max(...diffs);
    const maxLoss = Math.min(...diffs);
    elMaxGain.textContent = `+${maxGain.toLocaleString()}`;
    elMaxGain.className = 'stat-value gain';
    elMaxLoss.textContent = maxLoss.toLocaleString();
    elMaxLoss.className = 'stat-value loss';

    // Current win/lose streak
    let winStreak = 0, loseStreak = 0;
    for (let i = diffs.length - 1; i >= 0; i--) {
        if (diffs[i] > 0) {
            if (loseStreak > 0) break;
            winStreak++;
        } else if (diffs[i] < 0) {
            if (winStreak > 0) break;
            loseStreak++;
        } else {
            break;
        }
    }
    elWinStreak.textContent  = winStreak  > 0 ? `${winStreak}連続` : '---';
    elLoseStreak.textContent = loseStreak > 0 ? `${loseStreak}連続` : '---';
    elWinStreak.className  = winStreak  > 0 ? 'stat-value gain' : 'stat-value';
    elLoseStreak.className = loseStreak > 0 ? 'stat-value loss' : 'stat-value';

    // Trend helper
    const computeTrend = (days, el) => {
        const cutoff = new Date(Date.now() - days * 86400000);
        const recent = sorted.filter(r => new Date(r.created_at) >= cutoff);
        if (recent.length < 2) {
            el.textContent = 'データなし';
            el.className = 'stat-value trend-flat';
            return;
        }
        const delta = recent[recent.length - 1].vr_score - recent[0].vr_score;
        el.textContent = (delta >= 0 ? '▲ +' : '▼ ') + delta.toLocaleString();
        el.className = 'stat-value ' + (delta > 0 ? 'trend-up' : delta < 0 ? 'trend-down' : 'trend-flat');
    };

    computeTrend(7,  elTrend7d);
    computeTrend(30, elTrend30d);

    // 通算 線形回帰の傾き
    const raceRecords = sorted;
    if (raceRecords.length < 2) {
        elLast10Rate.textContent = '---';
        elLast10Rate.className = 'stat-value';
        elLast10Sub.textContent = '';
    } else {
        const xs = raceRecords.map((_, i) => i);
        const ys = raceRecords.map(r => r.vr_score);
        const n  = xs.length;
        const sumX  = xs.reduce((s, x) => s + x, 0);
        const sumY  = ys.reduce((s, y) => s + y, 0);
        const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
        const sumX2 = xs.reduce((s, x) => s + x * x, 0);
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const sign  = slope >= 0 ? '+' : '';
        elLast10Rate.textContent = `${sign}${slope.toFixed(1)}`;
        elLast10Rate.className = 'stat-value ' + (slope > 0 ? 'gain' : slope < 0 ? 'loss' : '');
        elLast10Sub.textContent = `全${raceRecords.length - 1}レース / 1レースあたり平均`;
    }
};

// ---- Chart ----
const renderChart = () => {
    const now = new Date();
    let filtered = vrData;

    if (currentChartPeriod === '1w') {
        const ago = new Date(now - 7 * 86400000);
        filtered = vrData.filter(r => new Date(r.created_at) >= ago);
    } else if (currentChartPeriod === '1m') {
        const ago = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        filtered = vrData.filter(r => new Date(r.created_at) >= ago);
    }

    if (vrChartInstance) { vrChartInstance.destroy(); vrChartInstance = null; }

    if (filtered.length === 0) {
        chartEmpty.style.display = 'flex';
        return;
    }
    chartEmpty.style.display = 'none';

    const chrono = [...filtered].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const labels = chrono.map(r => formatShortDate(r.created_at));
    const scores = chrono.map(r => r.vr_score);



    // Linear regression
    const n = scores.length;
    const sumX  = scores.reduce((s, _, i) => s + i, 0);
    const sumY  = scores.reduce((s, v) => s + v, 0);
    const sumXY = scores.reduce((s, v, i) => s + i * v, 0);
    const sumX2 = scores.reduce((s, _, i) => s + i * i, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const regression = scores.map((_, i) => Math.round(intercept + slope * i));
    const regressionColor = slope >= 0 ? 'rgba(251, 146, 60, 0.9)' : 'rgba(248, 113, 113, 0.9)';

    const ctx = document.getElementById('vrChart').getContext('2d');

    vrChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'VR',
                    data: scores,
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.08)',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#111827',
                    pointBorderColor: '#38bdf8',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    pointHoverBackgroundColor: '#38bdf8',
                    fill: true,
                    tension: 0.3,
                },
                {
                    label: '線形回帰',
                    data: regression,
                    borderColor: regressionColor,
                    borderWidth: 2,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    fill: false,
                    tension: 0,
                },
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 500, easing: 'easeInOutQuart' },
            scales: {
                x: {
                    ticks: {
                        color: '#6b7f96',
                        font: { family: "'JetBrains Mono', monospace", size: 11 },
                        maxTicksLimit: 8,
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    border: { color: 'rgba(255,255,255,0.08)' },
                },
                y: {
                    beginAtZero: false,
                    ticks: {
                        color: '#6b7f96',
                        font: { family: "'JetBrains Mono', monospace", size: 11 },
                        callback: (v) => v.toLocaleString(),
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    border: { color: 'rgba(255,255,255,0.08)' },
                }
            },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: '#8899aa',
                        font: { family: "'Inter', sans-serif", size: 12 },
                        boxWidth: 16,
                        padding: 20,
                        usePointStyle: true,
                        pointStyleWidth: 10,
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.97)',
                    borderColor: 'rgba(56, 189, 248, 0.35)',
                    borderWidth: 1,
                    titleColor: '#8899aa',
                    titleFont: { family: "'Inter', sans-serif", size: 12 },
                    bodyColor: '#f0f4f8',
                    bodyFont: { family: "'JetBrains Mono', monospace", size: 13, weight: '500' },
                    padding: 14,
                    cornerRadius: 8,
                    callbacks: {
                        label: (ctx) => {
                            if (ctx.datasetIndex === 0) return `  VR : ${ctx.parsed.y.toLocaleString()}`;
                            return `  回帰: ${ctx.parsed.y.toLocaleString()}`;
                        }
                    }
                }
            }
        }
    });
};

// ---- History ----
const renderHistory = () => {
    historyList.innerHTML = '';

    if (vrData.length === 0) {
        historyList.innerHTML = '<li class="history-empty">記録がありません</li>';
        return;
    }

    const sorted = [...vrData].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    sorted.forEach((item, index) => {
        const prev = index < sorted.length - 1 ? sorted[index + 1] : null;
        const diff = prev ? item.vr_score - prev.vr_score : null;

        const li = document.createElement('li');
        li.className = 'history-item' + (diff === null ? '' : diff > 0 ? ' up' : diff < 0 ? ' down' : '');

        let diffHtml = '';
        if (diff !== null) {
            const cls = diff > 0 ? 'diff-up' : diff < 0 ? 'diff-down' : 'diff-none';
            diffHtml = `<span class="history-diff ${cls}">${fmtDiff(diff)}</span>`;
        } else {
            diffHtml = `<span class="history-diff diff-none">FIRST</span>`;
        }

        li.innerHTML = `
            <div class="history-left">
                <span class="history-score">${item.vr_score.toLocaleString()}</span>
                ${diffHtml}
                <span class="history-date">${formatDate(item.created_at)}</span>
            </div>
            <button class="history-del" data-id="${item.id}">削除</button>
        `;

        li.querySelector('.history-del').addEventListener('click', () => deleteVR(item.id));
        historyList.appendChild(li);
    });
};

// ---- Delete ----
const deleteVR = (targetId) => {
    if (!confirm('この記録を削除しますか？')) return;
    vrData = vrData.filter(r => r.id !== targetId);
    localStorage.setItem('mk_vr_data', JSON.stringify(vrData));
    renderAll();
};

// ---- Export CSV ----
const exportCSV = () => {
    if (vrData.length === 0) { alert('エクスポートするデータがありません。'); return; }
    let csv = 'id,vr_score,created_at\n';
    vrData.forEach(r => { csv += `${r.id},${r.vr_score},${r.created_at}\n`; });
    const bom  = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href  = URL.createObjectURL(blob);
    link.download = `mkvr_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
};

// ---- Import CSV ----
const importCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!confirm('現在のデータが上書きされます。インポートしてもよろしいですか？')) {
        event.target.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        const lines   = e.target.result.split('\n');
        const newData = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const [id, vr_score, created_at] = line.split(',');
            if (id && vr_score && created_at) {
                newData.push({ id, vr_score: parseInt(vr_score, 10), created_at });
            }
        }
        if (newData.length > 0) {
            vrData = newData;
            localStorage.setItem('mk_vr_data', JSON.stringify(vrData));
            renderAll();
            alert(`${newData.length}件のデータをインポートしました。`);
        } else {
            alert('有効なデータが見つかりませんでした。');
        }
        event.target.value = '';
    };
    reader.readAsText(file);
};

// ---- Event Listeners ----
saveBtn.addEventListener('click', saveVR);
vrInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveVR(); });

document.getElementById('exportBtn').addEventListener('click', exportCSV);
document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('csvFileInput').click();
});
document.getElementById('csvFileInput').addEventListener('change', importCSV);

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentChartPeriod = e.currentTarget.getAttribute('data-period');
        renderChart();
    });
});

// Set initial active filter button
document.querySelector('.filter-btn[data-period="all"]').classList.add('active');

// ---- Init ----
renderAll();