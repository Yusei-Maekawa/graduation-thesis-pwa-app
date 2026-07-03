const DB_NAME    = "householdAccountingDB";
const DB_VERSION = 1;
const STORE_NAME = "records";

/**
 * IndexedDB を開き、IDBDatabase オブジェクトを返す。
 * データベースが存在しない場合は onupgradeneeded でストアを作成する。
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
    // promiseでラップ(既存の機能やプログラムを「別のコードで包み込んで、使いやすくする・互換性を持たせる処理)する理由
    // => IndexedDB のAPIはイベントベースで設計されており、await indexedDB.open(...) とは書けない。Promise でラップすることで、呼び出し側が await openDB() という読みやすい形で使える
    // 呼び出すのが、コールバック関数の入れ子ではなく、Promise オブジェクトを返すことで、呼び出し側が await openDB() という読みやすい形で使える(コードが直線的になる)
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // records ストアがなければ作成する
      // autoIncrement により id を自動採番する
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(new Error(`IndexedDB を開けませんでした: ${event.target.error}`));
    };
  });
}

/**
 * 家計記録をrecordsストアへ追加する
 * @param {IDBDatabase} db
 * @param {object} record -idとcreatedAtを除いた記録オブジェクト
 * @returns {Promise<number>} 採番されたid
 */

function addRecord(db,record){
    return new Promise((resolve,reject) => {
        //readwriteトランザクションを開始する
        const transaction = db.transaction(STORE_NAME,"readwrite");
        //recordsストアを取得する
        const store = transaction.objectStore(STORE_NAME);
        //記録を追加する
        const request = store.add(record);
        //成功したら採番されたidを返す
        request.onsuccess = (event) => {
            resolve(event.target.result);
        };
        //失敗したらエラーを返す
        request.onerror = (event) => {
            reject(new Error(`記録の追加に失敗しました: ${event.target.error}`));
        };
    });
}

export { openDB,addRecord, STORE_NAME };