/**
 * 今日の支出合計を算出する。
 * @param {object[]} records
 * @param {string} today - "YYYY-MM-DD"
 * @returns {number}
 */
function sumTodayExpense(records, today) {
    return records
      .filter((record) => record.type === "expense" && record.date === today)
      .reduce((total, record) => total + record.amount, 0);
  }
  
  /**
   * 対象月の支出合計を算出する。
   * @param {object[]} records
   * @param {string} yearMonth - "YYYY-MM"
   * @returns {number}
   */
  function sumMonthExpense(records, yearMonth) {
    return records
      .filter((record) => record.type === "expense" && record.date.startsWith(yearMonth))
      .reduce((total, record) => total + record.amount, 0);
  }
  
  /**
   * 対象月の収入合計を算出する。
   * @param {object[]} records
   * @param {string} yearMonth - "YYYY-MM"
   * @returns {number}
   */
  function sumMonthIncome(records, yearMonth) {
    return records
      .filter((record) => record.type === "income" && record.date.startsWith(yearMonth))
      .reduce((total, record) => total + record.amount, 0);
  }
  
  /**
   * 収支（収入合計 - 支出合計）を算出する。
   * @param {number} income
   * @param {number} expense
   * @returns {number}
   */
  function calcMonthBalance(income, expense) {
    return income - expense;
  }
  
  /**
   * 対象月のカテゴリ別支出を、金額の大きい順の配列で返す。
   * @param {object[]} records
   * @param {string} yearMonth - "YYYY-MM"
   * @returns {{category: string, total: number}[]}
   */
  function sumExpenseByCategory(records, yearMonth) {
    const totals = {};
  
    records
      .filter((record) => record.type === "expense" && record.date.startsWith(yearMonth))
      .forEach((record) => {
        // カテゴリごとに金額を積み上げる
        totals[record.category] = (totals[record.category] ?? 0) + record.amount;
      });
  
    // オブジェクトを配列に変換し、金額の大きい順に並べ替える
    return Object.entries(totals)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }
  
  export {
    sumTodayExpense,
    sumMonthExpense,
    sumMonthIncome,
    calcMonthBalance,
    sumExpenseByCategory,
  };