// DOM要素の取得
const vrInput = document.getElementById('vrInput');
const saveBtn = document.getElementById('saveBtn');
const historyList = document.getElementById('historyList');

// データの初期化（ローカルストレージから取得、なければ空配列）
let vrData = JSON.parse(localStorage.getItem('mk_vr_data')) || [];

// --- 今後実装していくメイン機能の枠組み ---

// 1. データを保存する関数
const saveVR = () => {
    // TODO: 入力値の取得、タイムスタンプの生成、配列への追加、ローカルストレージへの保存
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