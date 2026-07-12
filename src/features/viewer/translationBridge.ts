export type BridgeCommand =
  | { type: "mode"; mode: "source" | "dual" }
  | { type: "translations"; items: { id: string; text: string }[] }
  | { type: "errors"; ids: string[] }
  | { type: "scan" };

export function buildTranslationBridge(session: string): string {
  return `
    (function () {
      var SESSION = ${JSON.stringify(session)};
      var BLOCK_SELECTOR = 'article h1, article h2, article h3, article h4, article h5, article h6, article p, article li';
      var SKIP_SELECTOR = 'nav,header,footer,pre,code,math,table,figure,figcaption,.ltx_bibliography,.ltx_authors,.ltx_author_notes';
      var reported = new Set();
      var blocks = [];
      var observer;

      function post(payload) {
        window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ session: SESSION }, payload)));
      }
      function scanVisible() {
        var visible = blocks.filter(function (node) {
          var rect = node.getBoundingClientRect();
          return rect.bottom >= -window.innerHeight && rect.top <= window.innerHeight * 2;
        }).filter(function (node) { return !reported.has(node.dataset.arxivtokId); });
        if (!visible.length) return;
        visible.forEach(function (node) { reported.add(node.dataset.arxivtokId); });
        post({ type: 'visible', blocks: visible.map(function (node) {
          return { id: node.dataset.arxivtokId, text: node.dataset.arxivtokSource };
        }) });
      }
      function install() {
        if (document.getElementById('arxivtok-translation-style')) return;
        var style = document.createElement('style');
        style.id = 'arxivtok-translation-style';
        style.textContent = '.arxivtok-translation{display:block;margin:.55em 0 .9em;padding-left:.8em;border-left:3px solid #8b5cf6;color:#4c1d95;line-height:1.65}.arxivtok-source-mode .arxivtok-translation{display:none}[data-arxivtok-error="true"]{border-left:3px solid #ef4444}';
        document.head.appendChild(style);
        blocks = Array.prototype.slice.call(document.querySelectorAll(BLOCK_SELECTOR)).filter(function (node) {
          if (node.closest(SKIP_SELECTOR)) return false;
          var text = (node.textContent || '').replace(/\\s+/g, ' ').trim();
          if (text.length < 2) return false;
          node.dataset.arxivtokSource = text;
          return true;
        });
        blocks.forEach(function (node, index) { node.dataset.arxivtokId = 'b' + index; });
        document.documentElement.classList.add('arxivtok-source-mode');
        observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var node = entry.target;
            if (reported.has(node.dataset.arxivtokId)) return;
            reported.add(node.dataset.arxivtokId);
            post({ type: 'visible', blocks: [{ id: node.dataset.arxivtokId, text: node.dataset.arxivtokSource }] });
          });
        }, { rootMargin: '100% 0px' });
        blocks.forEach(function (node) { observer.observe(node); });
        post({ type: 'ready', total: blocks.length });
      }
      window.arxivtokReceive = function (command) {
        if (!command || typeof command.type !== 'string') return;
        if (command.type === 'mode') {
          document.documentElement.classList.toggle('arxivtok-source-mode', command.mode === 'source');
        } else if (command.type === 'translations' && Array.isArray(command.items)) {
          command.items.forEach(function (item) {
            var node = document.querySelector('[data-arxivtok-id="' + String(item.id).replace(/"/g, '') + '"]');
            if (!node || typeof item.text !== 'string') return;
            var translation = node.nextElementSibling;
            if (!translation || !translation.classList.contains('arxivtok-translation')) {
              translation = document.createElement('span');
              translation.className = 'arxivtok-translation';
              if (node.tagName === 'LI') node.appendChild(translation);
              else node.insertAdjacentElement('afterend', translation);
            }
            translation.textContent = item.text;
            node.removeAttribute('data-arxivtok-error');
          });
        } else if (command.type === 'errors' && Array.isArray(command.ids)) {
          command.ids.forEach(function (id) {
            var node = document.querySelector('[data-arxivtok-id="' + String(id).replace(/"/g, '') + '"]');
            if (node) node.dataset.arxivtokError = 'true';
          });
        } else if (command.type === 'scan') {
          reported.clear();
          scanVisible();
        }
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
      else install();
    })();
    true;
  `;
}

export function bridgeCommand(command: BridgeCommand): string {
  return `window.arxivtokReceive && window.arxivtokReceive(${JSON.stringify(command)}); true;`;
}
