/**
 * 今日の支出合計を算出する。
 * type が "expense" かつ date が today と一致する記録の amount を合計する。
 * @param {object[]} records - 家計記録の配列
 * @param {string} today - "YYYY-MM-DD" 形式の当日
 * @returns {number} 今日の支出合計
 */
function sumTodayExpense(records, today) {
    return records
      .filter((record) => record.type === "expense" && record.date === today)
      .reduce((total, record) => total + record.amount, 0);
  }
  
  /**
   * 今月の支出合計を算出する。
   * type が "expense" かつ date が yearMonth で始まる記録の amount を合計する。
   * @param {object[]} records - 家計記録の配列
   * @param {string} yearMonth - "YYYY-MM" 形式の対象月
   * @returns {number} 今月の支出合計
   */
  function sumMonthExpense(records, yearMonth) {
    return records
      .filter((record) => record.type === "expense" && record.date.startsWith(yearMonth))
      .reduce((total, record) => total + record.amount, 0);
  }
  
  export { sumTodayExpense, sumMonthExpense };