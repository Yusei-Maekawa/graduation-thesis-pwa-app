import {
  addRecord,
  getAllRecords,
  getRecordById,
  updateRecord,
} from "./db.js";
import { validateRecord } from "./validation.js";

/**
 * 入力値を検証し、問題がなければ家計記録を IndexedDB へ保存する。
 * @param {IDBDatabase} db
 * @param {object} input - フォームから取り出した入力値
 * @returns {Promise<{ok: boolean, errors: object}>}
 */
async function saveRecord(db, input) {
  const errors = validateRecord(input);

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const record = {
    type:      input.type,
    amount:    Number(input.amount),
    category:  input.category,
    date:      input.date,
    memo:      input.memo.trim(),
    createdAt: Date.now(),
  };

  await addRecord(db, record);
  return { ok: true, errors: {} };
}

/**
 * 全記録を取得し、記録日の新しい順に並べ替えて返す。
 * 同じ記録日の場合は、登録日時（createdAt）の新しい順とする。
 * @param {IDBDatabase} db
 * @returns {Promise<object[]>}
 */
async function getSortedRecords(db) {
  const records = await getAllRecords(db);

  return records.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date < b.date ? 1 : -1;
    }
    return b.createdAt - a.createdAt;
  });
}

/**
 * id を指定して記録を1件取得する。
 * @param {IDBDatabase} db
 * @param {number} id
 * @returns {Promise<object|undefined>}
 */
async function getRecord(db, id) {
  return getRecordById(db, id);
}

/**
 * 既存の記録を検証・更新する。
 * createdAt は元の値を維持し、id も変更しない。
 * @param {IDBDatabase} db
 * @param {number} id - 更新対象の id
 * @param {object} input - フォームから取り出した入力値
 * @returns {Promise<{ok: boolean, errors: object}>}
 */
async function updateExistingRecord(db, id, input) {
  const errors = validateRecord(input);

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  // 既存記録を取得し、createdAt を引き継ぐ
  const existing = await getRecordById(db, id);
  if (!existing) {
    return { ok: false, errors: { form: "対象の記録が見つかりませんでした。" } };
  }

  const updated = {
    id:        existing.id,
    type:      input.type,
    amount:    Number(input.amount),
    category:  input.category,
    date:      input.date,
    memo:      input.memo.trim(),
    createdAt: existing.createdAt,
  };

  await updateRecord(db, updated);
  return { ok: true, errors: {} };
}

export {
  saveRecord,
  getSortedRecords,
  getRecord,
  updateExistingRecord,
};