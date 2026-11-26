/* pw-eye.js — 2026-11-26 (permintaan user): ikon mata di setiap kolom kata sandi (login, daftar, ganti sandi)
   untuk melihat/menyembunyikan sandi. Generik & mandiri: memantau DOM, membungkus tiap input[type=password]
   dengan tombol ikon mata. Salinan identik dipakai di semua app JB3 (HOME, Budget, Salary, Kinerja, Board, DJ). */
(function () {
  if (window.__pwEye) return; window.__pwEye = 1;
  var EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  var css = '.pweye-w{position:relative;display:block;width:100%}' +
    '.pweye-w>input{width:100%;box-sizing:border-box;padding-right:44px!important}' +
    '.pweye-b{position:absolute;right:4px;top:50%;transform:translateY(-50%);width:36px;height:36px;display:flex;align-items:center;justify-content:center;' +
    'border:0;background:none;padding:0;margin:0;cursor:pointer;color:inherit;opacity:.55;border-radius:8px;-webkit-tap-highlight-color:transparent}' +
    '.pweye-b:hover,.pweye-b:focus-visible{opacity:.9}.pweye-b:active{transform:translateY(-50%)}';
  function addCss() {
    if (document.getElementById('pweye-css')) return;
    var s = document.createElement('style'); s.id = 'pweye-css'; s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }
  function setBtn(b, shown) {
    b.innerHTML = shown ? EYE_OFF : EYE;
    b.setAttribute('aria-label', shown ? 'Sembunyikan kata sandi' : 'Lihat kata sandi');
    b.title = b.getAttribute('aria-label');
    b.setAttribute('aria-pressed', shown ? 'true' : 'false');
  }
  function enhance(inp) {
    if (inp.dataset.pweye || inp.dataset.noeye != null) return;
    inp.dataset.pweye = '1';
    var cs = getComputedStyle(inp);
    var w = document.createElement('span'); w.className = 'pweye-w';
    w.style.margin = cs.marginTop + ' ' + cs.marginRight + ' ' + cs.marginBottom + ' ' + cs.marginLeft;
    if (cs.display !== 'none' && cs.flexGrow !== '0') w.style.flex = '1 1 auto';
    inp.parentNode.insertBefore(w, inp); w.appendChild(inp); inp.style.margin = '0';
    var b = document.createElement('button'); b.type = 'button'; b.className = 'pweye-b'; b.tabIndex = 0;
    setBtn(b, false); w.appendChild(b);
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });   // fokus tetap di input
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var show = inp.type === 'password';
      inp.type = show ? 'text' : 'password'; setBtn(b, show);
    });
  }
  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    if (root.matches && root.matches('input[type=password]')) enhance(root);
    var l = root.querySelectorAll('input[type=password]');
    for (var i = 0; i < l.length; i++) enhance(l[i]);
  }
  function start() {
    addCss(); scan(document.body);
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) { var a = ms[i].addedNodes; for (var j = 0; j < a.length; j++) if (a[j].nodeType === 1) scan(a[j]); }
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
