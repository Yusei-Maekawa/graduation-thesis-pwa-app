const VALID_TYPES = ["expense", "income"];

// TBD-004 で確定したカテゴリの内部値
const VALID_CATEGORIES = {
  expense: ["food", "daily", "housing", "transport", "communication", "leisure", "clothing", "medical", "other_expense"],
  income:  ["salary", "extra", "other_income"],
};

const MEMO_MAX_LENGTH = 100;

/**
 * 家計記録の入力値を検証する。
 * @param {object} input
 * @param {string} input.type
 * @param {string} input.amount
 * @param {string} input.category
 * @param {string} input.date
 * @param {string} input.memo
 * @returns {object} エラーがある項目名をキー、メッセージを値とするオブジェクト。
 *                   エラーがなければ空オブジェクト {}
 */
function validateRecord(input) {
  const errors = {};

  // 収支区分
  if (!VALID_TYPES.includes(input.type)) {
    errors.type = "収支区分を選択してください。";
  }

  // 金額：0より大きい整数であることを確認する
  const amount = Number(input.amount);
  if (!input.amount || isNaN(amount) || !Number.isInteger(amount) || amount <= 0) {
    errors.amount = "金額は1以上の整数を入力してください。";
  }

  // カテゴリ：収支区分に対応する選択肢の中に含まれているか確認する
  const validCategories = VALID_CATEGORIES[input.type] ?? [];
  if (!validCategories.includes(input.category)) {
    errors.category = "カテゴリを選択してください。";
  }

  // 記録日：有効な日付であることを確認する
  // TBD-005 の決定により未来の日付も許可する
  if (!input.date || isNaN(Date.parse(input.date))) {
    errors.date = "有効な日付を入力してください。";
  }

  // メモ：任意だが、上限を超えた場合はエラーにする
  if (input.memo.length > MEMO_MAX_LENGTH) {
    errors.memo = `メモは${MEMO_MAX_LENGTH}文字以内で入力してください。`;
  }

  return errors;
}

export { validateRecord, VALID_CATEGORIES, MEMO_MAX_LENGTH };