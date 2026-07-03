import { addRecord, getAllRecords } from "./db.js";
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
    // date は "YYYY-MM-DD" 形式の文字列のため、文字列比較で日付順になる
    if (a.date !== b.date) {
      return a.date < b.date ? 1 : -1;
    }
    // 同じ記録日の場合は createdAt（数値）の新しい順
    return b.createdAt - a.createdAt;
  });
}

export { saveRecord, getSortedRecords };