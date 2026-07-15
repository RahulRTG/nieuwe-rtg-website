/* Weergave van de apps: twee stijlen voor de gebruiker.
   - "donker": de vertrouwde kleurstelling, strak en rustig
   - "licht": offwhite met veel wit, zwart, en een vleugje bordeaux en goud
   Beide stijlen zijn zakelijk: emoticons in lopende tekst worden weggelaten
   (losse glyphs die als pictogram dienen blijven staan). De keuze wordt per
   apparaat onthouden. */
(function () {
  const KEY = 'rtg_thema';
  const root = document.documentElement;

  function huidig() {
    try { return localStorage.getItem(KEY) === 'licht' ? 'licht' : 'donker'; }
    catch (e) { return 'donker'; }
  }
  function pas(t) {
    root.setAttribute('data-thema', t);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'licht' ? '#FBFAF7' : '#0C0C0B');
    knopBij();
  }
  function zet(t) {
    try { localStorage.setItem(KEY, t); } catch (e) {}
    pas(t);
  }
  function wissel() { zet(huidig() === 'licht' ? 'donker' : 'licht'); }

  /* ---------- licht thema: token-overrides op de gedeelde app-tokens ---------- */
  function injectStijl() {
    if (document.getElementById('rtg-thema-stijl')) return;
    const s = document.createElement('style');
    s.id = 'rtg-thema-stijl';
    s.textContent = `
    :root[data-thema="licht"]{
      color-scheme:light;
      --bg:#FBFAF7; --card:#FFFFFF; --card2:#F3F0E9;
      --line:rgba(20,18,16,0.13);
      --txt:#161310; --muted:rgba(22,19,16,0.72); --soft:rgba(22,19,16,0.55);
      --burgundy:#7F1634; --burgundy-deep:#5E0F26;
      --gold:#8A7414; --green:#2E6B4F; --amber:#8F6E12;
      --knop:#161310; --knop-txt:#FFFFFF;
    }
    :root[data-thema="licht"] body{background:#E9E6DE;}
    @media (min-width:540px){
      :root[data-thema="licht"] #shell{border:1px solid rgba(20,18,16,0.14);box-shadow:0 40px 90px -45px rgba(12,12,11,0.35);}
    }
    :root[data-thema="licht"] .tabbar{background:rgba(251,250,247,0.94);}
    :root[data-thema="licht"] #station{background:#EFECE5;}
    :root[data-thema="licht"] #toast{background:#161310;color:#FFFFFF;}
    :root[data-thema="licht"] .vlin{color-scheme:light;background:rgba(12,12,11,0.04);}
    .rtg-thema-knop{position:fixed;left:104px;bottom:14px;z-index:9990;display:inline-flex;align-items:center;gap:0.45rem;
      background:rgba(12,12,11,0.82);color:#fff;border:1px solid rgba(255,255,255,0.16);border-radius:999px;
      padding:0.42rem 0.85rem;font-family:'Inter',-apple-system,sans-serif;font-size:0.72rem;font-weight:600;
      letter-spacing:0.04em;cursor:pointer;backdrop-filter:blur(8px);box-shadow:0 6px 20px rgba(0,0,0,0.25);
      transition:background .18s;padding-bottom:calc(0.42rem + env(safe-area-inset-bottom,0));}
    .rtg-thema-knop:hover{background:#7F1634;border-color:#7F1634;}
    .rtg-thema-dot{width:0.7rem;height:0.7rem;border-radius:50%;border:1px solid rgba(255,255,255,0.5);}
    :root[data-thema="licht"] .rtg-thema-knop{background:rgba(251,250,247,0.9);color:#161310;border-color:rgba(20,18,16,0.2);}
    :root[data-thema="licht"] .rtg-thema-dot{border-color:rgba(20,18,16,0.4);}
    @media print{.rtg-thema-knop{display:none;}}`;
    document.head.appendChild(s);
  }

  /* ---------- wisselknop, naast de taalknop ---------- */
  function bouwKnop() {
    if (document.getElementById('rtg-thema-knop')) return;
    const b = document.createElement('button');
    b.id = 'rtg-thema-knop';
    b.className = 'rtg-thema-knop';
    b.setAttribute('aria-label', 'Weergave wisselen (licht/donker)');
    b.addEventListener('click', wissel);
    document.body.appendChild(b);
    knopBij();
  }
  function knopBij() {
    const b = document.getElementById('rtg-thema-knop');
    if (!b) return;
    const doel = huidig() === 'licht' ? 'donker' : 'licht';
    b.innerHTML = '<span class="rtg-thema-dot" style="background:' + (doel === 'licht' ? '#FBFAF7' : '#161310') + ';"></span>' +
      (doel === 'licht' ? 'Licht' : 'Donker');
  }

  /* ---------- zakelijke tekst: emoticons uit lopende tekst ----------
     Alleen tekstknopen met echte woorden worden geschoond; staat een glyph er
     alleen (pictogram, avatar, sterren), dan blijft hij staan. */
  const RX = /(?:[\u{1F000}-\u{1FAFF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{2600}-\u{27BF}]|[\u{2B00}-\u{2BFF}]|[\u{2300}-\u{23FF}]|[\u{FE0F}\u{200D}\u{20E3}\u{2049}\u{203C}\u{2139}]|[\u{3030}\u{303D}\u{3297}\u{3299}\u{24C2}\u{2934}\u{2935}])/gu;
  const WOORD = /[A-Za-zÀ-ɏ]{2}/;
  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1 };

  function schoonNode(n) {
    const t = n.nodeValue;
    if (!t || !WOORD.test(t)) return;
    if (n.parentNode && SKIP[n.parentNode.nodeName]) return;
    RX.lastIndex = 0;
    if (!RX.test(t)) return;
    RX.lastIndex = 0;
    n.nodeValue = t.replace(RX, '').replace(/  +/g, ' ').replace(/^ +/, '');
  }
  function veeg(el) {
    if (!el) return;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) schoonNode(n);
  }
  function startVeger() {
    veeg(document.body);
    const mo = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === 'characterData') schoonNode(m.target);
        else if (m.addedNodes) m.addedNodes.forEach(n => {
          if (n.nodeType === 3) schoonNode(n);
          else if (n.nodeType === 1) veeg(n);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function start() {
    injectStijl();
    pas(huidig());
    bouwKnop();
    startVeger();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.RTGThema = { huidig, zet, wissel };
})();
