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

/**
 * records ストアの全件を取得する。
 * 並べ替えは行わない（並べ替えは record-service.js の責務）。
 * @param {IDBDatabase} db
 * @returns {Promise<object[]>}
 */
function getAllRecords(db) {
  return new Promise((resolve, reject) => {
    // 読み取りのみのため "readonly" を使う
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store       = transaction.objectStore(STORE_NAME);
    const request     = store.getAll();

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(new Error(`記録の取得に失敗しました: ${event.target.error}`));
    };
  });
}

/**
 * id を指定して記録を1件取得する。
 * @param {IDBDatabase} db
 * @param {number} id
 * @returns {Promise<object|undefined>} 該当記録。なければ undefined
 */
function getRecordById(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store       = transaction.objectStore(STORE_NAME);
    const request     = store.get(id);

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(new Error(`記録の取得に失敗しました: ${event.target.error}`));
    };
  });
}

/**
 * 記録を更新する。record には既存の id を含める。
 * put は同じ主キーが存在すれば上書き、なければ新規追加する。
 * ここでは既存 id を含めて呼ぶため、上書きとして機能する。
 * @param {IDBDatabase} db
 * @param {object} record - id を含む記録オブジェクト
 * @returns {Promise<number>} 更新した記録の id
 */
function updateRecord(db, record) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store       = transaction.objectStore(STORE_NAME);
    const request     = store.put(record);

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(new Error(`記録の更新に失敗しました: ${event.target.error}`));
    };
  });
}

export {
  openDB,
  addRecord,
  getAllRecords,
  getRecordById,
  updateRecord,
  STORE_NAME,
};