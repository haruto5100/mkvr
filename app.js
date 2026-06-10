// DOM要素の取得
const vrInput = document.getElementById('vrInput');
const saveBtn = document.getElementById('saveBtn');
const historyList = document.getElementById('historyList');

// 現在選択されているグラフの表示期間（初期値は 'all'）
let currentChartPeriod = 'all';

// 初期状態のボタンに 'active' クラスを付与
document.querySelector('.filter-btn[data-period="all"]').classList.add('active');

// 期間切り替えボタンのイベントリスナー
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // 全ボタンから 'active' クラスを外し、クリックされたボタンに付与
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');

        // 選択された期間を変数に格納し、グラフを再描画
        currentChartPeriod = e.target.getAttribute('data-period');
        renderChart();
    });
});

// データの初期化（ローカルストレージから取得、なければ空配列）
let vrData = JSON.parse(localStorage.getItem('mk_vr_data')) || [];
// Chartインスタンスを保持する変数（再描画時のバグを防ぐため）
let vrChartInstance = null;

// 1. データを保存する関数
const saveVR = () => {
    // 入力値の取得
    const vrValue = vrInput.value;

    // バリデーション（空入力などの不正な値を防ぐ）
    if (!vrValue || isNaN(vrValue)) {
        alert('有効なVR数値を入力してください。');
        return;
    }

    // 保存するデータオブジェクトの作成
    const newData = {
        // ブラウザ標準機能でUUIDを生成
        id: crypto.randomUUID(), 
        // 文字列から整数に変換
        vr_score: parseInt(vrValue, 10), 
        // タイムスタンプ（後で扱いやすいようにISO 8601形式で保存）
        created_at: new Date().toISOString() 
    };

    // 配列の末尾に追加（新しいデータが後ろに追加される）
    vrData.push(newData);

    // ローカルストレージにJSON文字列として保存
    localStorage.setItem('mk_vr_data', JSON.stringify(vrData));

    // 入力完了後、フィールドを空にして次の入力に備える
    vrInput.value = '';

    // 画面の更新（この2つの関数はこの後実装します）
    renderHistory();
    renderChart();
    updateMaxVr();
};

// 2. 履歴を画面に描画する関数（削除ボタン ＆ 差分表示 追加版）
const renderHistory = () => {
    historyList.innerHTML = '';

    if (vrData.length === 0) {
        historyList.innerHTML = '<li>まだ記録がありません。</li>';
        return;
    }

    // 新しい順（降順）にソート
    const sortedData = [...vrData].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // forEachの第二引数(index)を利用して、配列内の前後のデータを比較します
    sortedData.forEach((item, index) => {
        const li = document.createElement('li');
        
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.marginBottom = '8px';

        const date = new Date(item.created_at);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const formattedDate = `${yyyy}/${mm}/${dd} ${hh}:${min}`;

        // 差分の計算とHTML生成
        let diffHtml = '';
        // 最後の要素（一番最初の記録）以外の場合、1つ古い記録（index + 1）と比較する
        if (index < sortedData.length - 1) {
            const previousItem = sortedData[index + 1];
            const diff = item.vr_score - previousItem.vr_score;
            
            let diffColor = '#999'; // デフォルトはグレー（変化なし）
            let diffSign = '±';
            
            if (diff > 0) {
                diffColor = '#E52521'; // プラスは赤
                diffSign = '+';
            } else if (diff < 0) {
                diffColor = '#0066cc'; // マイナスは青
                diffSign = ''; // 負の数はマイナス記号が自動で付くので空文字
            }
            
            diffHtml = `<span style="font-size: 0.9em; font-weight: bold; color: ${diffColor}; margin-left: 8px;">(${diffSign}${diff})</span>`;
        } else {
            // 一番最初の記録には差分がないためハイフンを表示
            diffHtml = `<span style="font-size: 0.9em; font-weight: bold; color: #999; margin-left: 8px;">(-)</span>`;
        }

        // テキスト部分の作成（差分表示を追加）
        const textSpan = document.createElement('span');
        textSpan.innerHTML = `<strong>VR: ${item.vr_score.toLocaleString()}</strong>${diffHtml} <span style="font-size: 0.8em; color: #666; margin-left: 10px;">${formattedDate}</span>`;
        
        // 削除ボタンの作成
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '削除';
        deleteBtn.style.padding = '4px 8px';
        deleteBtn.style.fontSize = '12px';
        deleteBtn.style.color = '#fff';
        deleteBtn.style.backgroundColor = '#666';
        deleteBtn.style.border = 'none';
        deleteBtn.style.borderRadius = '4px';
        deleteBtn.style.cursor = 'pointer';

        deleteBtn.addEventListener('click', () => {
            deleteVR(item.id);
        });

        li.appendChild(textSpan);
        li.appendChild(deleteBtn);
        historyList.appendChild(li);
    });
};

// 3. グラフを描画・更新する関数（期間絞り込み機能付き）
const renderChart = () => {
    if (vrData.length === 0) return;

    // --- 現在の時刻を基準にデータを絞り込む ---
    const now = new Date();
    let filteredData = vrData;

    if (currentChartPeriod === '1w') {
        // 7日前の日時を計算
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filteredData = vrData.filter(item => new Date(item.created_at) >= oneWeekAgo);
    } else if (currentChartPeriod === '1m') {
        // 1ヶ月前の日時を計算（日付のズレを防ぐため年月日を設定）
        const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        filteredData = vrData.filter(item => new Date(item.created_at) >= oneMonthAgo);
    }

    // 絞り込んだ結果、表示するデータがない場合はグラフをクリアして終了
    if (filteredData.length === 0) {
        if (vrChartInstance) {
            vrChartInstance.destroy();
            vrChartInstance = null;
        }
        return;
    }

    // 古い順（昇順）にソート
    const chronologicalData = [...filteredData].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const labels = chronologicalData.map(item => {
        const date = new Date(item.created_at);
        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    });
    const dataPoints = chronologicalData.map(item => item.vr_score);

    const ctx = document.getElementById('vrChart').getContext('2d');

    if (vrChartInstance) {
        vrChartInstance.destroy();
    }

    vrChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'VR',
                data: dataPoints,
                borderColor: '#E52521',
                backgroundColor: 'rgba(229, 37, 33, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#E52521',
                pointRadius: 4,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
};

// 4. 特定の記録を削除する関数
const deleteVR = (targetId) => {
    // 誤操作防止の確認ダイアログ
    if (!confirm('この記録を削除してもよろしいですか？')) {
        return;
    }

    // 指定されたID「以外」のデータだけを残す（＝指定IDを削除）
    vrData = vrData.filter(item => item.id !== targetId);

    // ローカルストレージを新しい配列で上書き保存
    localStorage.setItem('mk_vr_data', JSON.stringify(vrData));

    // 履歴リストとグラフを最新の状態で再描画
    renderHistory();
    renderChart();
    updateMaxVr();
};

// 5. 最高値を計算して表示する関数
const updateMaxVr = () => {
    const display = document.getElementById('maxVrDisplay');
    if (vrData.length === 0) {
        display.textContent = '---';
        return;
    }

    // vrDataの中から最大値を探す
    const maxVr = Math.max(...vrData.map(item => item.vr_score));
    display.textContent = maxVr.toLocaleString();
};

// --- 5. CSVエクスポート機能 ---
const exportCSV = () => {
    if (vrData.length === 0) {
        alert('エクスポートするデータがありません。');
        return;
    }

    // ヘッダー行を作成
    let csvContent = "id,vr_score,created_at\n";

    // データをCSV形式の文字列に変換
    vrData.forEach(item => {
        csvContent += `${item.id},${item.vr_score},${item.created_at}\n`;
    });

    // Blobオブジェクトを作成（BOMを付与してExcelで開いた時の文字化けを防ぐ）
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // ダウンロード用のリンクを動的に生成してクリックさせる
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    // ファイル名に今日の日付を入れる
    const today = new Date().toISOString().slice(0, 10);
    link.download = `mariokart_vr_data_${today}.csv`;
    link.click();
    
    // 生成したURLのメモリ解放
    URL.revokeObjectURL(link.href);
};

// --- 6. CSVインポート機能 ---
const importCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 誤操作防止の確認（インポートすると現在のデータが上書きされる仕様とします）
    if (!confirm('現在のデータが上書きされます。インポートしてもよろしいですか？\n（※必要に応じて事前にエクスポートをお願いします）')) {
        event.target.value = ''; // ファイル選択をリセット
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n');
        const newData = [];

        // 1行目（ヘッダー）を飛ばして2行目から処理
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const [id, vr_score, created_at] = line.split(',');
            
            // 簡単なデータチェック
            if (id && vr_score && created_at) {
                newData.push({
                    id: id,
                    vr_score: parseInt(vr_score, 10),
                    created_at: created_at
                });
            }
        }

        if (newData.length > 0) {
            // データを上書きしてローカルストレージに保存
            vrData = newData;
            localStorage.setItem('mk_vr_data', JSON.stringify(vrData));
            
            // 画面の再描画
            renderHistory();
            renderChart();
            updateMaxVr(); // 先ほど作成した自己ベスト更新関数
            
            alert(`${newData.length}件のデータをインポートしました。`);
        } else {
            alert('有効なデータが見つかりませんでした。');
        }
        
        event.target.value = ''; // ファイル選択をリセット
    };
    
    // ファイルをテキストとして読み込む
    reader.readAsText(file);
};

// --- ボタンへのイベントリスナー登録 ---
document.getElementById('exportBtn').addEventListener('click', exportCSV);

// インポートボタンを押したら、隠してある <input type="file"> をクリックしたことにする
document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('csvFileInput').click();
});

// ファイルが選択されたらインポート処理を実行
document.getElementById('csvFileInput').addEventListener('change', importCSV);

// イベントリスナーの登録
saveBtn.addEventListener('click', saveVR);

// 初期表示時の実行
renderHistory();
renderChart();
updateMaxVr();