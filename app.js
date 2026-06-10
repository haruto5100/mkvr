// DOM要素の取得
const vrInput = document.getElementById('vrInput');
const saveBtn = document.getElementById('saveBtn');
const historyList = document.getElementById('historyList');

// データの初期化（ローカルストレージから取得、なければ空配列）
let vrData = JSON.parse(localStorage.getItem('mk_vr_data')) || [];

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
    // TODO: vrDataを新しい順にソートし、ul要素(historyList)に追加する
};

// 3. グラフを描画・更新する関数
const renderChart = () => {
    // TODO: Chart.jsを使ってvrDataを折れ線グラフにする
};

// イベントリスナーの登録
saveBtn.addEventListener('click', saveVR);

// 初期表示時の実行
renderHistory();
renderChart();