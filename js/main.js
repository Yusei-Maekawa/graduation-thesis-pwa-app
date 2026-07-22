import { openDB } from "./db.js";
import {
  saveRecord,
  getSortedRecords,
  getRecord,
  updateExistingRecord,
  removeRecord,
} from "./record-service.js";
import { VALID_CATEGORIES } from "./validation.js";
import { initRouter, navigateTo } from "./router.js";
import {
  sumTodayExpense,
  sumMonthExpense,
  sumMonthIncome,
  calcMonthBalance,
  sumExpenseByCategory,
} from "./summary-service.js";

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

let editingId = null;
let pendingDeleteId = null;

// 集計画面で表示している対象月（"YYYY-MM"）。null なら未設定（初回に今月を入れる）。
let currentYearMonth = null;

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
 * 今月を YYYY-MM 形式で返す。
 * @returns {string}
 */
function getCurrentYearMonth() {
  const today = new Date();
  const year  = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * "YYYY-MM" を指定した月数だけ移動した "YYYY-MM" を返す。
 * @param {string} yearMonth - "YYYY-MM"
 * @param {number} diff - 移動する月数（-1で前月、+1で翌月）
 * @returns {string}
 */
function shiftYearMonth(yearMonth, diff) {
  const [year, month] = yearMonth.split("-").map(Number);
  // Date を使って月をまたぐ計算を安全に行う（12月→1月などを自動処理）
  const date = new Date(year, month - 1 + diff, 1);
  const newYear  = date.getFullYear();
  const newMonth = String(date.getMonth() + 1).padStart(2, "0");
  return `${newYear}-${newMonth}`;
}

/**
 * "YYYY-MM" を表示用（YYYY年M月）に整形する。
 * @param {string} yearMonth
 * @returns {string}
 */
function formatYearMonth(yearMonth) {
  const [year, month] = yearMonth.split("-");
  return `${year}年${Number(month)}月`;
}

/**
 * カテゴリ選択欄を、指定した収支区分の選択肢で再構築する。
 * @param {HTMLSelectElement} selectEl
 * @param {string} type
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
 * @param {object} errors
 */
function showErrors(errors) {
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
 * 金額を表示用に整形する。
 * @param {number} amount
 * @returns {string}
 */
function formatAmount(amount) {
  return `${amount.toLocaleString("ja-JP")}円`;
}

/**
 * 記録日を表示用に整形する。
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  const [year, month, day] = dateStr.split("-");
  return `${year}/${month}/${day}`;
}

/**
 * フォームを新規登録の初期状態に戻す。
 * @param {HTMLFormElement} form
 * @param {HTMLInputElement} dateInput
 * @param {HTMLSelectElement} categoryEl
 * @param {HTMLButtonElement} submitButton
 */
function resetFormToNewMode(form, dateInput, categoryEl, submitButton) {
  editingId = null;
  form.reset();
  dateInput.value = getTodayString();
  updateCategoryOptions(categoryEl, "expense");
  const expenseRadio = form.querySelector('input[name="type"][value="expense"]');
  if (expenseRadio) {
    expenseRadio.checked = true;
  }
  submitButton.textContent = "記録する";
}

/**
 * 指定した記録の内容をフォームへ反映し、編集モードにする。
 * @param {object} record
 * @param {HTMLFormElement} form
 * @param {HTMLSelectElement} categoryEl
 * @param {HTMLInputElement} dateInput
 * @param {HTMLButtonElement} submitButton
 */
function fillFormForEdit(record, form, categoryEl, dateInput, submitButton) {
  editingId = record.id;

  const typeRadio = form.querySelector(`input[name="type"][value="${record.type}"]`);
  if (typeRadio) {
    typeRadio.checked = true;
  }

  updateCategoryOptions(categoryEl, record.type);
  categoryEl.value = record.category;

  form.querySelector("#amount").value = record.amount;
  dateInput.value                     = record.date;
  form.querySelector("#memo").value   = record.memo;

  submitButton.textContent = "更新する";
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

    const typeLabel     = record.type === "expense" ? "支出" : "収入";
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
 * ホーム画面の集計値を再計算して描画する。
 * @param {IDBDatabase} db
 * @param {HTMLElement} todayEl
 * @param {HTMLElement} monthEl
 */
async function refreshHome(db, todayEl, monthEl) {
  try {
    const records = await getSortedRecords(db);
    const today     = getTodayString();
    const yearMonth = getCurrentYearMonth();

    todayEl.textContent = formatAmount(sumTodayExpense(records, today));
    monthEl.textContent = formatAmount(sumMonthExpense(records, yearMonth));
  } catch (error) {
    console.error("ホームの集計に失敗しました:", error);
  }
}

/**
 * カテゴリ別支出のリストを描画する。
 * @param {HTMLElement} listEl
 * @param {{category: string, total: number}[]} categoryTotals
 */
function renderCategoryList(listEl, categoryTotals) {
  listEl.innerHTML = "";

  if (categoryTotals.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className   = "summary-category-empty";
    emptyItem.textContent = "支出の記録がありません。";
    listEl.appendChild(emptyItem);
    return;
  }

  categoryTotals.forEach(({ category, total }) => {
    const item = document.createElement("li");
    item.className = "summary-category-item";

    const label = CATEGORY_LABELS.expense[category] ?? category;
    item.innerHTML = `
      <span class="summary-category-name">${label}</span>
      <span class="summary-category-total">${formatAmount(total)}</span>
    `;
    listEl.appendChild(item);
  });
}

/**
 * 集計画面を、現在の対象月（currentYearMonth）で再計算して描画する。
 * @param {IDBDatabase} db
 * @param {object} elements - 集計画面の各表示要素
 */
async function refreshSummary(db, elements) {
  const { monthInput, incomeEl, expenseEl, balanceEl, categoryListEl } = elements;

  try {
    const records = await getSortedRecords(db);

    const income  = sumMonthIncome(records, currentYearMonth);
    const expense = sumMonthExpense(records, currentYearMonth);
    const balance = calcMonthBalance(income, expense);
    const categoryTotals = sumExpenseByCategory(records, currentYearMonth);

    // month 入力の表示を対象月に合わせる
    monthInput.value = currentYearMonth;

    incomeEl.textContent  = formatAmount(income);
    expenseEl.textContent = formatAmount(expense);
    balanceEl.textContent = formatAmount(balance);

    renderCategoryList(categoryListEl, categoryTotals);
  } catch (error) {
    console.error("集計に失敗しました:", error);
  }
}

/**
 * 削除対象の記録情報をダイアログへ表示し、ダイアログを開く。
 * @param {object} record
 * @param {HTMLElement} targetInfoEl
 * @param {HTMLDialogElement} dialog
 */
function openDeleteDialog(record, targetInfoEl, dialog) {
  pendingDeleteId = record.id;

  const typeLabel     = record.type === "expense" ? "支出" : "収入";
  const categoryLabel = CATEGORY_LABELS[record.type]?.[record.category] ?? record.category;
  targetInfoEl.textContent =
    `${formatDate(record.date)} / ${typeLabel} / ${categoryLabel} / ${formatAmount(record.amount)}`;

  dialog.showModal();
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

  const form             = document.getElementById("record-form");
  const dateInput        = document.getElementById("date");
  const categoryEl       = document.getElementById("category");
  const statusEl         = document.getElementById("form-status");
  const submitButton     = form?.querySelector('button[type="submit"]');
  const historyList      = document.getElementById("history-list");
  const historyStatus    = document.getElementById("history-status");
  const tabButtons       = Array.from(document.querySelectorAll(".tab-button"));
  const tabPanels        = Array.from(document.querySelectorAll(".tab-panel"));
  const deleteDialog     = document.getElementById("delete-dialog");
  const deleteTargetInfo = document.getElementById("delete-target-info");
  const homeTodayExpense = document.getElementById("home-today-expense");
  const homeMonthExpense = document.getElementById("home-month-expense");
  const homeAddButton    = document.getElementById("home-add-button");

  // 集計画面の要素
  const summaryElements = {
    monthInput:     document.getElementById("summary-month"),
    incomeEl:       document.getElementById("summary-income"),
    expenseEl:      document.getElementById("summary-expense"),
    balanceEl:      document.getElementById("summary-balance"),
    categoryListEl: document.getElementById("summary-category-list"),
  };
  const prevMonthButton = document.getElementById("prev-month-button");
  const nextMonthButton = document.getElementById("next-month-button");

  if (
    !form || !dateInput || !categoryEl || !statusEl || !submitButton ||
    !historyList || !historyStatus || !deleteDialog || !deleteTargetInfo ||
    !homeTodayExpense || !homeMonthExpense || !homeAddButton ||
    !summaryElements.monthInput || !summaryElements.incomeEl ||
    !summaryElements.expenseEl || !summaryElements.balanceEl ||
    !summaryElements.categoryListEl || !prevMonthButton || !nextMonthButton
  ) {
    console.error("init: 必要な DOM 要素が見つかりません。");
    return;
  }

  // ルーティングの初期化
  initRouter({
    tabButtons,
    tabPanels,
    onRouteChange: (route) => {
      if (route === "history") {
        refreshHistory(db, historyList, historyStatus);
      } else if (route === "home") {
        refreshHome(db, homeTodayExpense, homeMonthExpense);
      } else if (route === "summary") {
        // 対象月が未設定なら今月を初期値にする
        if (currentYearMonth === null) {
          currentYearMonth = getCurrentYearMonth();
        }
        refreshSummary(db, summaryElements);
      }
    },
  });

  // タブボタンはハッシュを変更するだけにする（実際の切替は router が行う）
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      navigateTo(button.dataset.tab);
    });
  });

  // ホームの「記録を追加する」ボタンで記録入力画面へ移動する
  homeAddButton.addEventListener("click", () => {
    navigateTo("form");
  });

  // 対象月の切替：前月ボタン
  prevMonthButton.addEventListener("click", () => {
    currentYearMonth = shiftYearMonth(currentYearMonth, -1);
    refreshSummary(db, summaryElements);
  });

  // 対象月の切替：翌月ボタン
  nextMonthButton.addEventListener("click", () => {
    currentYearMonth = shiftYearMonth(currentYearMonth, 1);
    refreshSummary(db, summaryElements);
  });

  // 対象月の切替：month 入力
  summaryElements.monthInput.addEventListener("change", (event) => {
    const value = event.target.value;
    // month 入力が空になる場合があるため、その場合は今月へ戻す
    currentYearMonth = value || getCurrentYearMonth();
    refreshSummary(db, summaryElements);
  });

  dateInput.value = getTodayString();

  const typeRadios = form.querySelectorAll('input[name="type"]');
  typeRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      updateCategoryOptions(categoryEl, radio.value);
    });
  });

  const initialType = form.querySelector('input[name="type"]:checked');
  if (initialType) {
    updateCategoryOptions(categoryEl, initialType.value);
  }

  // 履歴の編集ボタン（イベント委譲でまとめて扱う）
  historyList.addEventListener("click", async (event) => {
    const editButton   = event.target.closest(".btn-edit");
    const deleteButton = event.target.closest(".btn-delete");

    if (editButton) {
      const id = Number(editButton.dataset.id);
      try {
        const record = await getRecord(db, id);
        if (!record) {
          historyStatus.textContent = "対象の記録が見つかりませんでした。";
          return;
        }
        fillFormForEdit(record, form, categoryEl, dateInput, submitButton);
        statusEl.textContent = "";
        showErrors({});
        navigateTo("form");
      } catch (error) {
        console.error("記録の取得に失敗しました:", error);
        historyStatus.textContent = "記録の取得に失敗しました。";
      }
      return;
    }

    if (deleteButton) {
      const id = Number(deleteButton.dataset.id);
      try {
        const record = await getRecord(db, id);
        if (!record) {
          historyStatus.textContent = "対象の記録が見つかりませんでした。";
          return;
        }
        openDeleteDialog(record, deleteTargetInfo, deleteDialog);
      } catch (error) {
        console.error("記録の取得に失敗しました:", error);
        historyStatus.textContent = "記録の取得に失敗しました。";
      }
    }
  });

  // 削除ダイアログの結果を処理する
  deleteDialog.addEventListener("close", async () => {
    // returnValue には押されたボタンの value が入る
    const result = deleteDialog.returnValue;

    if (result === "confirm" && pendingDeleteId !== null) {
      try {
        await removeRecord(db, pendingDeleteId);
        historyStatus.textContent = "記録を削除しました。";
        refreshHistory(db, historyList, historyStatus);
        // 削除で集計が変わるため、ホームの値も再計算しておく
        refreshHome(db, homeTodayExpense, homeMonthExpense);
        // 集計画面の対象月が設定済みなら再計算する
        if (currentYearMonth !== null) {
          refreshSummary(db, summaryElements);
        }
      } catch (error) {
        console.error("記録の削除に失敗しました:", error);
        historyStatus.textContent = "記録の削除に失敗しました。";
      }
    }

    pendingDeleteId = null;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!db) {
      statusEl.textContent = "データベースに接続できませんでした。";
      return;
    }

    const input = {
      type:     form.querySelector('input[name="type"]:checked')?.value ?? "",
      amount:   form.querySelector("#amount").value,
      category: categoryEl.value,
      date:     dateInput.value,
      memo:     form.querySelector("#memo").value,
    };

    statusEl.textContent = "";
    showErrors({});

    const wasEditing = editingId !== null;
    const result = wasEditing
      ? await updateExistingRecord(db, editingId, input)
      : await saveRecord(db, input);

    if (!result.ok) {
      showErrors(result.errors);
      statusEl.textContent = "入力内容に誤りがあります。";
      return;
    }

    resetFormToNewMode(form, dateInput, categoryEl, submitButton);

    // 履歴を最新化する
    refreshHistory(db, historyList, historyStatus);
    refreshHome(db, homeTodayExpense, homeMonthExpense);
    if (currentYearMonth !== null) {
      refreshSummary(db, summaryElements);
    }

    if (wasEditing) {
      // 編集後は履歴画面へ戻る
      statusEl.textContent = "";
      navigateTo("history");
    } else {
      // 新規登録後はホーム画面へ戻る（specification.md 7.1節）
      statusEl.textContent = "";
      navigateTo("home");
    }
  });
}

document.addEventListener("DOMContentLoaded", init);


// Service Worker を登録する（PWA・オフライン対応）
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then((registration) => {
        console.log("Service Worker を登録しました:", registration.scope);
      })
      .catch((error) => {
        console.error("Service Worker の登録に失敗しました:", error);
      });
  });
}