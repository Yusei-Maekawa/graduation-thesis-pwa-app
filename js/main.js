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

// 現在編集中の記録の id。null のときは新規登録モード。
let editingId = null;

// 削除確認中の記録の id。null のときは削除対象なし。
let pendingDeleteId = null;

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

  // 収支区分に対応するカテゴリを先に用意してから値を選択する
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

  const form          = document.getElementById("record-form");
  const dateInput     = document.getElementById("date");
  const categoryEl    = document.getElementById("category");
  const statusEl      = document.getElementById("form-status");
  const submitButton  = form?.querySelector('button[type="submit"]');
  const historyList   = document.getElementById("history-list");
  const historyStatus = document.getElementById("history-status");
  const tabButtons    = Array.from(document.querySelectorAll(".tab-button"));
  const tabPanels     = Array.from(document.querySelectorAll(".tab-panel"));
  const deleteDialog  = document.getElementById("delete-dialog");
  const deleteTargetInfo = document.getElementById("delete-target-info");

  if (
    !form || !dateInput || !categoryEl || !statusEl || !submitButton ||
    !historyList || !historyStatus || !deleteDialog || !deleteTargetInfo
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
      }
    },
  });

  // タブボタンはハッシュを変更するだけにする（実際の切替は router が行う）
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      navigateTo(button.dataset.tab);
    });
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

    // editingId の有無で新規登録・編集を分岐する
    const result = editingId === null
      ? await saveRecord(db, input)
      : await updateExistingRecord(db, editingId, input);

    if (!result.ok) {
      showErrors(result.errors);
      statusEl.textContent = "入力内容に誤りがあります。";
      return;
    }

    const wasEditing = editingId !== null;
    resetFormToNewMode(form, dateInput, categoryEl, submitButton);

    // 履歴を最新化する
    refreshHistory(db, historyList, historyStatus);

    if (wasEditing) {
      // 編集後は履歴画面へ戻る
      statusEl.textContent = "";
      navigateTo("history");
    } else {
      statusEl.textContent = "記録を保存しました。";
    }
  });
}

document.addEventListener("DOMContentLoaded", init);