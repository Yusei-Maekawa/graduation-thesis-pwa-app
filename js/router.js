// アプリケーションで使用する画面（ハッシュ）の一覧
const ROUTES = ["home", "form", "history", "summary"];
const DEFAULT_ROUTE = "form";

/**
 * 現在のハッシュから画面名を取り出す。
 * 不正なハッシュや空の場合は既定の画面名を返す。
 * @returns {string}
 */
function getCurrentRoute() {
  // 先頭の "#" を除いた文字列を得る
  const hash = location.hash.replace(/^#/, "");
  return ROUTES.includes(hash) ? hash : DEFAULT_ROUTE;
}

/**
 * 指定した画面名に対応する section を表示し、他を隠す。
 * タブボタンの aria-current も更新する。
 * @param {string} route
 * @param {HTMLElement[]} tabButtons
 * @param {HTMLElement[]} tabPanels
 */
function applyRoute(route, tabButtons, tabPanels) {
  tabPanels.forEach((panel) => {
    panel.hidden = panel.id !== `tab-${route}`;
  });

  tabButtons.forEach((button) => {
    button.setAttribute("aria-current", String(button.dataset.tab === route));
  });
}

/**
 * ルーティングを初期化する。
 * hashchange を監視し、画面切替時に onRouteChange を呼ぶ。
 * @param {object} params
 * @param {HTMLElement[]} params.tabButtons
 * @param {HTMLElement[]} params.tabPanels
 * @param {(route: string) => void} params.onRouteChange - 画面切替後に呼ばれるコールバック
 */
function initRouter({ tabButtons, tabPanels, onRouteChange }) {
  const handleRoute = () => {
    const route = getCurrentRoute();
    applyRoute(route, tabButtons, tabPanels);
    onRouteChange(route);
  };

  window.addEventListener("hashchange", handleRoute);

  // 初期表示：ハッシュがなければ既定の画面へ整える
  if (!location.hash) {
    location.hash = `#${DEFAULT_ROUTE}`;
  } else {
    handleRoute();
  }
}

/**
 * 指定した画面へ遷移する（ハッシュを変更する）。
 * @param {string} route
 */
function navigateTo(route) {
  location.hash = `#${route}`;
}

export { initRouter, navigateTo, getCurrentRoute };