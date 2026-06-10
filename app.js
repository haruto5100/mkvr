// DOM要素の取得
const vrInput = document.getElementById('vrInput');
const saveBtn = document.getElementById('saveBtn');
const historyList = document.getElementById('historyList');

// データの初期化（ローカルストレージから取得、なければ空配列）
let vrData = JSON.parse(localStorage.getItem('mk_vr_data')) || [];
// Chartインスタンスを保持する変数（再描画時のバグを防ぐため）
let vrChartInstance = null;

// --- 今後実装していくメイン機能の枠組み ---

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
};

// 2. 履歴を画面に描画する関数
const renderHistory = () => {
    // 履歴リストの表示を一旦クリア（重複描画を防ぐため）
    historyList.innerHTML = '';

    // データが空の場合はメッセージを表示して終了
    if (vrData.length === 0) {
        historyList.innerHTML = '<li>まだ記録がありません。</li>';
        return;
    }

    // 新しい順（降順）にソートした新しい配列を作成
    // ※元のvrDataの並び順を変えないよう [...vrData] とスプレッド構文でコピーしています
    const sortedData = [...vrData].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // ソートされたデータをループ処理してリスト(li)を生成
    sortedData.forEach(item => {
        const li = document.createElement('li');

        // 日時を日本人が見やすい形式にフォーマット (例: 2026/06/10 13:21)
        const date = new Date(item.created_at);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const formattedDate = `${yyyy}/${mm}/${dd} ${hh}:${min}`;

        // リスト要素にHTMLを流し込む
        li.innerHTML = `<strong>VR: ${item.vr_score.toLocaleString()}</strong> <span style="font-size: 0.8em; color: #666; margin-left: 10px;">${formattedDate}</span>`;
        
        // ul要素に追加
        historyList.appendChild(li);
    });
};

// 3. グラフを描画・更新する関数
const renderChart = () => {
    // データがない場合は描画処理をスキップ
    if (vrData.length === 0) return;

    // グラフは「左から右へ（古い順から新しい順へ）」表示したいので、時系列順にソートした配列を用意
    const chronologicalData = [...vrData].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // X軸（ラベル：月/日 時:分）とY軸（データ：VR）の配列を抽出
    const labels = chronologicalData.map(item => {
        const date = new Date(item.created_at);
        // グラフの下部が窮屈にならないよう、短めのフォーマット（例: 6/10 13:21）にします
        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    });
    const dataPoints = chronologicalData.map(item => item.vr_score);

    // canvas要素のコンテキストを取得
    const ctx = document.getElementById('vrChart').getContext('2d');

    // すでにグラフが描画されている場合は破棄する
    if (vrChartInstance) {
        vrChartInstance.destroy();
    }

    // Chart.jsで新しい折れ線グラフを生成
    vrChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'VR',
                data: dataPoints,
                borderColor: '#E52521', // マリオを意識した赤色
                backgroundColor: 'rgba(229, 37, 33, 0.1)', // 薄い赤色でグラフ下部を塗りつぶし
                borderWidth: 2,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#E52521',
                pointRadius: 4,
                fill: true,
                tension: 0.1 // 少しだけ線を滑らかにする
            }]
        },
        options: {
            responsive: true,
            // CSSで親要素の高さを指定してグラフサイズを制御できるようにする
            maintainAspectRatio: false, 
            scales: {
                y: {
                    // VRの推移の「変化」を強調するため、Y軸を0から始めない
                    beginAtZero: false 
                }
            },
            plugins: {
                legend: {
                    display: false // 「VR」という凡例は自明なので非表示にしてスペースを確保
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
};

// イベントリスナーの登録
saveBtn.addEventListener('click', saveVR);

// 初期表示時の実行
renderHistory();
renderChart();