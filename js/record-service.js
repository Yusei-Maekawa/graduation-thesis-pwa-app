import { addRecord } from "./db.js";
import { validateRecord } from "./validation.js";

/**
 * 入力値を検証し、問題がなければ家計記録を IndexedDB へ保存する。
 * @param {IDBDatabase} db
 * @param {object} input - フォームから取り出した入力値
 * @returns {Promise<{ok: boolean, errors: object}>}
 *   ok: 保存できたか, errors: 検証エラーの項目とメッセージ
 */
async function saveRecord(db, input) {
  const errors = validateRecord(input);

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const record = {
    type:      input.type,
    // Number() で文字列から数値へ変換する
    amount:    Number(input.amount),
    category:  input.category,
    date:      input.date,
    // 空白のみのメモは空文字として保存する
    memo:      input.memo.trim(),
    createdAt: Date.now(),
  };

  await addRecord(db, record);
  return { ok: true, errors: {} };
}

export { saveRecord };