import { openDB } from "./db.js";
import { saveRecord, getSortedRecords } from "./record-service.js";
import { VALID_CATEGORIES } from "./validation.js";

// カテゴリのラベルと内部値のマッピング
const CATEGORY_LABELS = {
  expense: {
    food:          "食費",
    daily:         "日用品",
    housing:       "住居・光熱費",
    transport:     "交通費",
    communication: "通信費",
    leisure:       "趣味・娯楽",
    clothing:      "衣服・美容",
    medical:       "医療",
    other_expense: "その他",
  },
  income: {
    salary:       "給与",
    extra:        "臨時収入",
    other_income: "その他",
  },
};

/**
 * 今日の日付を YYYY-MM-DD 形式で返す。
 * @returns {string}
 */
function getTodayString() {
  const today = new Date();
  const year  = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day   = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * カテゴリ選択欄を、指定した収支区分の選択肢で再構築する。
 * @param {HTMLSelectElement} selectEl
 * @param {string} type - "expense" または "income"
 */
function updateCategoryOptions(selectEl, type) {
  const categories = VALID_CATEGORIES[type];
  if (!categories) {
    console.error(`updateCategoryOptions: 不明な type "${type}"`);
    return;
  }

  selectEl.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value       = "";
  placeholder.textContent = "選択してください";
  placeholder.disabled    = true;
  placeholder.selected    = true;
  selectEl.appendChild(placeholder);

  categories.forEach((value) => {
    const option = document.createElement("option");
    option.value       = value;
    option.textContent = CATEGORY_LABELS[type][value];
    selectEl.appendChild(option);
  });
}

/**
 * フォームのエラーメッセージ表示を更新する。
 * @param {object} errors - 項目名をキー、メッセージを値とするオブジェクト
 */
function showErrors(errors) {
  // 既存のエラー表示をすべてリセットする
  document.querySelectorAll(".field-error").forEach((el) => {
    el.textContent = "";
  });

  Object.entries(errors).forEach(([field, message]) => {
    const errorEl = document.getElementById(`error-${field}`);
    if (errorEl) {
      errorEl.textContent = message;
    }
  });
}

/**
 * 金額を「1,200円」のような表示用文字列に整形する。
 * 保存値自体には影響しない（表示専用）。
 * @param {number} amount
 * @returns {string}
 */
function formatAmount(amount) {
  return `${amount.toLocaleString("ja-JP")}円`;
}

/**
 * 記録日（YYYY-MM-DD）を表示用に整形する。
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  const [year, month, day] = dateStr.split("-");
  return `${year}/${month}/${day}`;
}

/**
 * 履歴一覧を DOM へ描画する。
 * @param {HTMLElement} listEl - <ul> 要素
 * @param {object[]} records - 表示する記録の配列（並べ替え済み）
 */
function renderHistory(listEl, records) {
  listEl.innerHTML = "";

  if (records.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className   = "history-empty";
    emptyItem.textContent = "記録がまだありません。";
    listEl.appendChild(emptyItem);
    return;
  }

  records.forEach((record) => {
    const item = document.createElement("li");
    item.className = `history-item history-item--${record.type}`;

    const typeLabel = record.type === "expense" ? "支出" : "収入";
    const categoryLabel = CATEGORY_LABELS[record.type]?.[record.category] ?? record.category;

    item.innerHTML = `
      <div class="history-item-main">
        <span class="history-item-type">${typeLabel}</span>
        <span class="history-item-amount">${formatAmount(record.amount)}</span>
      </div>
      <div class="history-item-sub">
        <span class="history-item-category">${categoryLabel}</span>
        <span class="history-item-date">${formatDate(record.date)}</span>
      </div>
      ${record.memo ? `<p class="history-item-memo">${record.memo}</p>` : ""}
      <div class="history-item-actions">
        <button type="button" class="btn-edit" data-id="${record.id}">編集</button>
        <button type="button" class="btn-delete" data-id="${record.id}">削除</button>
      </div>
    `;

    listEl.appendChild(item);
  });
}

/**
 * IndexedDB から最新の履歴を取得し、画面へ再描画する。
 * @param {IDBDatabase} db
 * @param {HTMLElement} listEl
 * @param {HTMLElement} statusEl
 */
async function refreshHistory(db, listEl, statusEl) {
  try {
    const records = await getSortedRecords(db);
    renderHistory(listEl, records);
  } catch (error) {
    console.error("履歴の取得に失敗しました:", error);
    statusEl.textContent = "履歴の取得に失敗しました。";
  }
}

/**
 * タブを切り替える。
 * @param {string} tabName - "home" | "form" | "history" | "summary"
 * @param {HTMLElement[]} tabButtons
 * @param {HTMLElement[]} tabPanels
 */
function switchTab(tabName, tabButtons, tabPanels) {
  tabPanels.forEach((panel) => {
    const isTarget = panel.id === `tab-${tabName}`;
    panel.hidden = !isTarget;
  });

  tabButtons.forEach((button) => {
    const isTarget = button.dataset.tab === tabName;
    button.setAttribute("aria-current", String(isTarget));
  });
}

/**
 * アプリケーションの初期化処理。
 */
async function init() {
  let db;
  try {
    db = await openDB();
    console.log("IndexedDB に接続しました:", db.name);
  } catch (error) {
    console.error("IndexedDB の接続に失敗しました:", error);
    return;
  }

  const form        = document.getElementById("record-form");
  const dateInput    = document.getElementById("date");
  const categoryEl   = document.getElementById("category");
  const statusEl     = document.getElementById("form-status");
  const historyList   = document.getElementById("history-list");
  const historyStatus = document.getElementById("history-status");
  const tabButtons    = Array.from(document.querySelectorAll(".tab-button"));
  const tabPanels      = Array.from(document.querySelectorAll(".tab-panel"));

  if (!form || !dateInput || !categoryEl || !statusEl || !historyList || !historyStatus) {
    console.error("init: 必要な DOM 要素が見つかりません。");
    return;
  }

  // タブ切替イベントを登録する
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabName = button.dataset.tab;
      switchTab(tabName, tabButtons, tabPanels);

      // 履歴タブを開いたときに最新の記録を取得する
      if (tabName === "history") {
        refreshHistory(db, historyList, historyStatus);
      }
    });
  });

  dateInput.value = getTodayString();

  const typeRadios = form.querySelectorAll('input[name="type"]');
  if (typeRadios.length === 0) {
    console.error("init: 収支区分のラジオボタンが見つかりません。");
    return;
  }

  typeRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      updateCategoryOptions(categoryEl, radio.value);
    });
  });

  const initialType = form.querySelector('input[name="type"]:checked');
  if (initialType) {
    updateCategoryOptions(categoryEl, initialType.value);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!db) {
      statusEl.textContent = "データベースに接続できていません。ページを再読み込みしてください。";
      return;
    }

    const input = {
      type:     form.querySelector('input[name="type"]:checked')?.value ?? "",
      amount:   form.querySelector('#amount').value,
      category: categoryEl.value,
      date:     dateInput.value,
      memo:     document.querySelector('#memo').value,
    };

    statusEl.textContent = "";
    showErrors({});

    const { ok, errors } = await saveRecord(db, input);

    if (!ok) {
      showErrors(errors);
      statusEl.textContent = "入力内容に誤りがあります。";
      return;
    }

    statusEl.textContent = "記録を保存しました。";
    form.reset();

    dateInput.value = getTodayString();
    updateCategoryOptions(categoryEl, "expense");
    const expenseRadio = form.querySelector('input[name="type"][value="expense"]');
    if (expenseRadio) {
      expenseRadio.checked = true;
    }

    // 新規登録後に履歴を最新化しておく（履歴タブを開いたときにすぐ反映されるように）
    refreshHistory(db, historyList, historyStatus);
  });
}

document.addEventListener("DOMContentLoaded", init);