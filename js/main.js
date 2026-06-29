import { openDB } from "./db.js";

// 収支区分ごとのカテゴリ定義
// 内部値は工程3（新規登録）の実装前に TBD-004 として確定する
const CATEGORIES = {
    expense: [
      { value: "food",           label: "食費" },
      { value: "daily",          label: "日用品" },
      { value: "transport",      label: "交通費" },
      { value: "leisure",        label: "趣味・娯楽" },
      { value: "clothing",       label: "衣服" },
      { value: "medical",        label: "医療" },
      { value: "fixed",          label: "固定費" },
      { value: "other_expense",  label: "その他" },
    ],
    income: [
      { value: "salary",         label: "給与" },
      { value: "extra",          label: "臨時収入" },
      { value: "other_income",   label: "その他" },
    ],
  };
  
  /**
   * 今日の日付を YYYY-MM-DD 形式で返す。
   * date 入力欄の value に直接使用できる形式。
   * @returns {string}
   */
  function getTodayString() {
    const today = new Date();
    const year  = today.getFullYear();
    // getMonth() は 0 始まりのため +1 する
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day   = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  
  /**
   * カテゴリ選択欄を、指定した収支区分の選択肢で再構築する。
   * @param {HTMLSelectElement} selectEl - カテゴリの <select> 要素
   * @param {string} type - "expense" または "income"
   */
  function updateCategoryOptions(selectEl, type) {
    const categories = CATEGORIES[type];
    if (!categories) {
      // 想定外の type が渡された場合は処理を中断する
      console.error(`updateCategoryOptions: 不明な type "${type}"`);
      return;
    }
  
    // 既存の選択肢をすべて削除する
    selectEl.innerHTML = "";
  
    // 先頭に「選択してください」プレースホルダを追加する
    const placeholder = document.createElement("option");
    placeholder.value    = "";
    placeholder.textContent = "選択してください";
    placeholder.disabled = true;
    placeholder.selected = true;
    selectEl.appendChild(placeholder);
  
    // 収支区分に対応するカテゴリを追加する
    categories.forEach(({ value, label }) => {
      const option = document.createElement("option");
      option.value       = value;
      option.textContent = label;
      selectEl.appendChild(option);
    });
  }
  
  /**
   * アプリケーションの初期化処理。
   * DOM が読み込まれた後に一度だけ呼び出す。
   */
  async function init() {
    // IndexedDB への接続（工程3以降で db オブジェクトを各処理へ渡す）
    let db;
    try{
      db = await openDB();
      console.log("IndexDBに接続しました",db.name);
    }catch(error){
      console.error("IndexDBに接続できませんでした",error);
      return;
       // 接続失敗時もUIは表示するが、工程3以降の保存処理は動作しない
    }

    const form       = document.getElementById("record-form");
    const dateInput  = document.getElementById("date");
    const categoryEl = document.getElementById("category");
    const statusEl   = document.getElementById("form-status");
  
    // DOM 取得に失敗した場合は後続処理を止める
    if (!form || !dateInput || !categoryEl || !statusEl) {
      console.error("init: 必要な DOM 要素が見つかりません。");
      return;
    }
  
    // 当日の日付を記録日の初期値として設定する
    dateInput.value = getTodayString();
  
    // 収支区分ラジオボタンを取得する
    const typeRadios = form.querySelectorAll('input[name="type"]');
    if (typeRadios.length === 0) {
      console.error("init: 収支区分のラジオボタンが見つかりません。");
      return;
    }
  
    // 収支区分の変更時にカテゴリ選択肢を切り替えるイベントを登録する
    typeRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        updateCategoryOptions(categoryEl, radio.value);
      });
    });
  
    // ページ読み込み時点で選択されている収支区分（expense）に合わせてカテゴリを初期化する
    const initialType = form.querySelector('input[name="type"]:checked');
    if (initialType) {
      updateCategoryOptions(categoryEl, initialType.value);
    }
  
    // フォーム送信時の仮処理（工程3で IndexedDB への保存へ置き換える）
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      statusEl.textContent = "（保存機能は未実装です。工程3で実装します。）";
    });
  }
  
  // DOM の読み込み完了後に初期化する
  document.addEventListener("DOMContentLoaded", init);