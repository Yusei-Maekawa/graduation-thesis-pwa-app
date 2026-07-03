import { openDB } from "./db.js";
import { saveRecord } from "./record-service.js";
import { VALID_CATEGORIES } from "./validation.js";

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
  // カテゴリのラベルと内部値のマッピング
  const CATEGORY_LABELS = {
    food:          "食費",
    daily:         "日用品",
    housing:       "住居・光熱費",
    transport:     "交通費",
    communication: "通信費",
    leisure:       "趣味・娯楽",
    clothing:      "衣服・美容",
    medical:       "医療",
    other_expense: "その他",
    salary:        "給与",
    extra:         "臨時収入",
    other_income:  "その他",
  };

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
    option.textContent = CATEGORY_LABELS[value];
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
 * アプリケーションの初期化処理。
 */
async function init() {
  let db;
  try {
    db = await openDB();
    console.log("IndexedDB に接続しました:", db.name);
  } catch (error) {
    console.error("IndexedDB の接続に失敗しました:", error);
  }

  const form       = document.getElementById("record-form");
  const dateInput  = document.getElementById("date");
  const categoryEl = document.getElementById("category");
  const statusEl   = document.getElementById("form-status");

  if (!form || !dateInput || !categoryEl || !statusEl) {
    console.error("init: 必要な DOM 要素が見つかりません。");
    return;
  }

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

    // フォームの入力値を取り出す
    const input = {
      type:     form.querySelector('input[name="type"]:checked')?.value ?? "",
      amount:   form.querySelector('#amount').value,
      category: categoryEl.value,
      date:     dateInput.value,
      memo:     form.querySelector('#memo').value,
    };

    statusEl.textContent = "";
    showErrors({});

    const { ok, errors } = await saveRecord(db, input);

    if (!ok) {
      showErrors(errors);
      statusEl.textContent = "入力内容を確認してください。";
      return;
    }

    statusEl.textContent = "記録しました。";
    form.reset();
    // reset() で日付とカテゴリが消えるため再設定する
    dateInput.value = getTodayString();
    updateCategoryOptions(categoryEl, "expense");
    // リセット後に支出ラジオボタンを選択状態に戻す
    const expenseRadio = form.querySelector('input[name="type"][value="expense"]');
    if (expenseRadio) expenseRadio.checked = true;
  });
}

document.addEventListener("DOMContentLoaded", init);