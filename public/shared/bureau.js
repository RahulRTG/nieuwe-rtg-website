/* RTG Bureau: op een ruim scherm staat het leden-OS als een gecentreerd
   tablet-venster; de lege ruimte links en rechts vult zich met widgets die je
   zelf neerzet. Elke widget LEENT een echte kaart uit de app (De Salon, Chat,
   Reis, Betalen, RTFoundation): de kaart wordt met huid en haar naar de widget
   verplaatst, dus hij werkt en ververst gewoon door -- klikken, sturen, openen,
   alles doet het. Je sleept ze waarheen je wilt (links of rechts) en hun plek
   wordt onthouden. Met de plus-knop haal je widgets bij of terug; met het
   kruisje geef je een kaart weer terug aan het beginscherm.

   Alleen op brede schermen en pas nadat je binnen bent (de app is actief).
   Zodra het scherm te smal wordt, keren alle kaarten netjes terug naar hun
   plek in de app. */
(function () {
  if (window.RTGBureau) return;
  // het leden-OS staat op de computer op normaal (telefoon-)formaat; zodra er
  // naast dat toestel ruimte is voor een widgetkolom, vult die zich vanzelf
  var MIN = 1120;
  var BREED = 288;
  var SLEUTEL = 'rtg_bureau_v2';
  var RUSTIG = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var SOORTEN = [
    { id: 'salon', naam: 'De Salon', bron: 'homeSalon' },
    { id: 'chat', naam: 'Chat', bron: 'homeContacts' },
    { id: 'reis', naam: 'Reis', bron: 'homeTrip' },
    { id: 'betalen', naam: 'Betalen', bron: 'homePay' },
    { id: 'foundation', naam: 'RTFoundation', bron: 'homeFoundation' }
  ];
  function soort(id) { for (var i = 0; i < SOORTEN.length; i++) if (SOORTEN[i].id === id) return SOORTEN[i]; return null; }
  // een ROS-app als widget: id 'app:<url>', ingeladen als klein, live kader
  function isApp(w) { return w && typeof w.id === 'string' && w.id.indexOf('app:') === 0; }
  function rosApps() {
    if (window.RTGApps && window.RTGApps.length) return window.RTGApps;
    return [
      { naam: 'De Salon', url: '/apps/app.html#salon' },
      { naam: 'RTG Mall', url: '/apps/mall.html' },
      { naam: 'Food Court', url: '/apps/foodcourt.html' },
      { naam: 'RTG OV', url: '/apps/ov.html' },
      { naam: 'Spelen', url: '/apps/spelen.html' }
    ];
  }

  var laag = null, plusKnop = null, menu = null, actief = false;
  var staat = laadStaat();

  function laadStaat() {
    try { var s = JSON.parse(localStorage.getItem(SLEUTEL)); if (s && s.widgets) return s; } catch (e) {}
    // standaard: Chat links, De Salon rechts -- beide marges gevuld
    return { widgets: [{ id: 'chat', kant: 'links', x: null, y: 40 }, { id: 'salon', kant: 'rechts', x: null, y: 40 }] };
  }
  function bewaar() { try { localStorage.setItem(SLEUTEL, JSON.stringify(staat)); } catch (e) {} }

  // de randen van het gecentreerde leden-OS-toestel (#shell), zodat de widgets
  // er precies naast komen -- ongeacht welk formaat het toestel heeft
  function osRect() {
    var el = document.getElementById('shell');
    if (el) return el.getBoundingClientRect();
    var w = Math.min(460, window.innerWidth - 48);
    return { left: (window.innerWidth - w) / 2, right: (window.innerWidth + w) / 2 };
  }
  function rechterMarge() { return Math.round(osRect().right + 26); }
  function linkerMarge() { return Math.max(16, Math.round(osRect().left - BREED - 26)); }
  function beginX(w) { return w.x != null ? w.x : (w.kant === 'links' ? linkerMarge() : rechterMarge()); }

  function stijl() {
    if (document.getElementById('bureauCss')) return;
    var st = document.createElement('style'); st.id = 'bureauCss';
    st.textContent =
      '#bureau{position:fixed;inset:0;z-index:1;pointer-events:none;}' +
      '.bw{position:absolute;width:' + BREED + 'px;max-height:52vh;pointer-events:auto;' +
        'background:color-mix(in srgb, var(--card,#151312) 80%, transparent);' +
        'backdrop-filter:blur(22px) saturate(1.3);-webkit-backdrop-filter:blur(22px) saturate(1.3);' +
        'border:1px solid var(--line,rgba(255,255,255,.1));border-radius:18px;overflow:hidden;' +
        'box-shadow:0 24px 60px rgba(0,0,0,.55);display:flex;flex-direction:column;' +
        (RUSTIG ? '' : 'transition:box-shadow .16s ease,transform .16s ease;') + '}' +
      '.bw.pak{box-shadow:0 34px 80px rgba(0,0,0,.7);' + (RUSTIG ? '' : 'transform:scale(1.012);') + '}' +
      '.bw-kop{display:flex;align-items:center;gap:.5rem;padding:.55rem .8rem;cursor:grab;' +
        'border-bottom:1px solid var(--line,rgba(255,255,255,.08));user-select:none;flex:0 0 auto;}' +
      '.bw.pak .bw-kop{cursor:grabbing;}' +
      '.bw-grip{display:flex;gap:2px;}.bw-grip i{width:3px;height:3px;border-radius:50%;background:var(--soft,#8A8680);display:block;}' +
      '.bw-naam{flex:1;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:var(--txt,#F4F1EC);}' +
      '.bw-x{background:none;border:none;color:var(--soft,#8A8680);cursor:pointer;font-size:1rem;line-height:1;padding:.1rem .3rem;}' +
      '.bw-x:hover{color:var(--txt,#F4F1EC);}' +
      '.bw-body{padding:.7rem .8rem 1rem;overflow-y:auto;overflow-x:hidden;flex:1 1 auto;min-height:0;}' +
      '.bw-resize{position:absolute;right:0;bottom:0;width:20px;height:20px;cursor:nwse-resize;pointer-events:auto;z-index:2;touch-action:none;}' +
      '.bw-resize::after{content:"";position:absolute;right:4px;bottom:4px;width:8px;height:8px;' +
        'border-right:2px solid var(--soft,#8A8680);border-bottom:2px solid var(--soft,#8A8680);opacity:.65;}' +
      '.bw-resize:hover::after{opacity:1;border-color:var(--gold,#857007);}' +
      '.bw-body > .card,.bw-body > .os-social{margin:0!important;background:none!important;border:none!important;box-shadow:none!important;padding:0!important;}' +
      '.bw-leeg{color:var(--soft,#8A8680);font-size:.8rem;}' +
      '#bureauPlus{position:fixed;pointer-events:auto;z-index:2;bottom:calc(env(safe-area-inset-bottom,0px) + 1.1rem);' +
        'width:44px;height:44px;border-radius:50%;border:1px solid var(--line,rgba(255,255,255,.14));' +
        'background:color-mix(in srgb, var(--card,#151312) 70%, transparent);backdrop-filter:blur(18px);' +
        '-webkit-backdrop-filter:blur(18px);color:var(--gold,#857007);font-size:1.4rem;cursor:pointer;' +
        'box-shadow:0 12px 30px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;}' +
      '#bureauMenu{position:fixed;pointer-events:auto;z-index:3;display:none;flex-direction:column;gap:.15rem;' +
        'padding:.4rem;border-radius:14px;border:1px solid var(--line,rgba(255,255,255,.12));max-height:min(62vh,460px);overflow-y:auto;' +
        'background:color-mix(in srgb, var(--card,#151312) 90%, transparent);backdrop-filter:blur(20px);' +
        '-webkit-backdrop-filter:blur(20px);box-shadow:0 20px 50px rgba(0,0,0,.6);}' +
      '#bureauMenu.open{display:flex;}' +
      '#bureauMenu button{background:none;border:none;text-align:left;color:var(--txt,#F4F1EC);font-family:inherit;' +
        'font-size:.8rem;padding:.5rem .8rem;border-radius:9px;cursor:pointer;white-space:nowrap;}' +
      '#bureauMenu button:hover{background:color-mix(in srgb, var(--gold,#857007) 22%, transparent);}' +
      '#bureauMenu button[disabled]{opacity:.4;cursor:default;}' +
      '.bureauMenu-kop{font-size:.58rem;letter-spacing:.16em;text-transform:uppercase;color:var(--soft,#8A8680);' +
        'padding:.5rem .8rem .2rem;position:sticky;top:-.4rem;background:color-mix(in srgb, var(--card,#151312) 90%, transparent);}';
    document.head.appendChild(st);
  }

  /* Een echte kaart lenen: laat een anker achter op de oorspronkelijke plek en
     verplaats het echte element naar de widget. Zo blijven alle klik-handlers
     en de live updates werken -- de widget is dus echt interactief. */
  function leen(body, s) {
    var bron = document.getElementById(s.bron);
    if (!bron) { body.innerHTML = '<div class="bw-leeg">Even niet beschikbaar.</div>'; return; }
    if (!document.querySelector('.bw-anker[data-voor="' + s.bron + '"]')) {
      var anker = document.createElement('span'); anker.className = 'bw-anker'; anker.hidden = true; anker.dataset.voor = s.bron;
      if (bron.parentNode) bron.parentNode.insertBefore(anker, bron);
    }
    bron.style.display = '';
    body.appendChild(bron);
  }
  function terug(s) {
    var bron = document.getElementById(s.bron); if (!bron) return;
    var anker = document.querySelector('.bw-anker[data-voor="' + s.bron + '"]');
    if (anker && anker.parentNode) { anker.parentNode.insertBefore(bron, anker); anker.parentNode.removeChild(anker); }
  }

  function bouwApp(body, w) {
    body.style.padding = '0';
    var f = document.createElement('iframe');
    f.src = w.app || '/apps/index.html';
    f.setAttribute('title', w.naam || 'RTG-app');
    f.setAttribute('loading', 'lazy');
    f.style.cssText = 'width:100%;height:100%;border:0;background:var(--bg,#0C0C0B);display:block;';
    body.appendChild(f);
  }
  function widgetEl(w) {
    var app = isApp(w), s = app ? null : soort(w.id);
    if (!app && !s) return null;
    var el = document.createElement('section'); el.className = 'bw'; el.dataset.id = w.id;
    var kop = document.createElement('div'); kop.className = 'bw-kop';
    kop.innerHTML = '<span class="bw-grip"><i></i><i></i><i></i></span><span class="bw-naam"></span><button class="bw-x" aria-label="Widget sluiten">&times;</button>';
    kop.querySelector('.bw-naam').textContent = app ? (w.naam || 'App') : s.naam;
    kop.querySelector('.bw-x').addEventListener('click', function () { verwijder(w.id); });
    var body = document.createElement('div'); body.className = 'bw-body';
    var grip = document.createElement('span'); grip.className = 'bw-resize'; grip.setAttribute('aria-hidden', 'true');
    el.appendChild(kop); el.appendChild(body); el.appendChild(grip);
    el.style.left = beginX(w) + 'px'; el.style.top = (w.y == null ? 40 : w.y) + 'px';
    if (w.w) el.style.width = w.w + 'px';
    if (w.h) { el.style.height = w.h + 'px'; el.style.maxHeight = 'none'; }
    if (app) bouwApp(body, w); else leen(body, s);
    sleepbaar(el, kop, w);
    formaatbaar(el, grip, w);
    return el;
  }

  /* Van formaat veranderen: sleep aan de hoek rechtsonder. Breder/smaller
     (kleiner/groter) en langer/korter tegelijk, met nette grenzen. De maat
     wordt onthouden, net als de plek. */
  function formaatbaar(el, grip, w) {
    grip.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation();
      var startX = e.clientX, startY = e.clientY;
      var beginW = el.offsetWidth, beginH = el.offsetHeight;
      el.classList.add('pak'); try { grip.setPointerCapture(e.pointerId); } catch (x) {}
      function beweeg(ev) {
        var nw = Math.max(200, Math.min(560, beginW + (ev.clientX - startX)));
        var nh = Math.max(150, Math.min(Math.round(window.innerHeight * 0.9), beginH + (ev.clientY - startY)));
        el.style.width = nw + 'px'; el.style.height = nh + 'px'; el.style.maxHeight = 'none';
      }
      function los() {
        el.classList.remove('pak');
        document.removeEventListener('pointermove', beweeg);
        document.removeEventListener('pointerup', los);
        w.w = el.offsetWidth; w.h = el.offsetHeight;
        bewaar();
      }
      document.addEventListener('pointermove', beweeg);
      document.addEventListener('pointerup', los);
    });
  }

  /* Magnetisch: als een widget met een rand vlak bij die van een andere komt,
     "klikt" hij er vanzelf tegenaan (randen en boven-/onderkanten lijnen uit).
     Rustig gehouden: alleen binnen een kleine afstand (14px). */
  var KLEEF = 14;
  function magneet(el, x, y) {
    if (!laag) return { x: x, y: y };
    var ew = el.offsetWidth, eh = el.offsetHeight;
    var bx = null, by = null, dx = KLEEF, dy = KLEEF;
    var prob = function (a, kandidaat, isX) {
      var v = Math.abs(a - kandidaat);
      if (isX && v < dx) { dx = v; bx = kandidaat; }
      if (!isX && v < dy) { dy = v; by = kandidaat; }
    };
    laag.querySelectorAll('.bw').forEach(function (o) {
      if (o === el) return;
      var L = o.offsetLeft, T = o.offsetTop, R = L + o.offsetWidth, B = T + o.offsetHeight;
      prob(x, L, true); prob(x, R, true);            // linkerranden gelijk, of tegen de rechterrand
      prob(x + ew, L, true); prob(x + ew, R, true);  // rechterrand tegen links, of rechterranden gelijk
      prob(y, T, false); prob(y, B, false);
      prob(y + eh, T, false); prob(y + eh, B, false);
    });
    if (bx !== null) { if (Math.abs(bx - x) > Math.abs(bx - (x + ew))) x = bx - ew; else x = bx; }
    if (by !== null) { if (Math.abs(by - y) > Math.abs(by - (y + eh))) y = by - eh; else y = by; }
    return { x: x, y: y };
  }

  function sleepbaar(el, kop, w) {
    kop.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.bw-x')) return;
      e.preventDefault();
      var startX = e.clientX, startY = e.clientY;
      var beginL = parseFloat(el.style.left) || 0, beginT = parseFloat(el.style.top) || 0;
      el.classList.add('pak'); try { el.setPointerCapture(e.pointerId); } catch (x) {}
      function beweeg(ev) {
        var nx = Math.max(4, Math.min(window.innerWidth - 60, beginL + (ev.clientX - startX)));
        var ny = Math.max(4, Math.min(window.innerHeight - 44, beginT + (ev.clientY - startY)));
        var m = magneet(el, nx, ny); nx = m.x; ny = m.y;
        el.style.left = nx + 'px'; el.style.top = ny + 'px';
      }
      function los() {
        el.classList.remove('pak');
        document.removeEventListener('pointermove', beweeg);
        document.removeEventListener('pointerup', los);
        w.x = parseFloat(el.style.left); w.y = parseFloat(el.style.top);
        w.kant = w.x < window.innerWidth / 2 ? 'links' : 'rechts';
        bewaar();
      }
      document.addEventListener('pointermove', beweeg);
      document.addEventListener('pointerup', los);
    });
  }

  function teken() {
    if (!laag) return;
    // eerst alle geleende kaarten teruggeven, dan pas de laag legen
    laag.querySelectorAll('.bw').forEach(function (w) { var s = soort(w.dataset.id); if (s) terug(s); });
    laag.innerHTML = '';
    staat.widgets.forEach(function (w) { var el = widgetEl(w); if (el) laag.appendChild(el); });
    vulMenu();
  }

  function verwijder(id) {
    var s = soort(id); if (s) terug(s);
    staat.widgets = staat.widgets.filter(function (w) { return w.id !== id; });
    bewaar(); teken();
  }
  function voegToe(id, app, naam) {
    if (staat.widgets.some(function (w) { return w.id === id; })) return;
    // afwisselend links/rechts, op de kant met de minste widgets
    var links = staat.widgets.filter(function (w) { return w.kant === 'links'; }).length;
    var rechts = staat.widgets.length - links;
    var kant = links <= rechts ? 'links' : 'rechts';
    var wd = { id: id, kant: kant, x: null, y: 40 + Math.floor(staat.widgets.length / 2) * 60 };
    if (id.indexOf('app:') === 0) { wd.app = app; wd.naam = naam; wd.w = 320; wd.h = 440; }
    staat.widgets.push(wd);
    bewaar(); teken();
    if (menu) menu.classList.remove('open');
  }

  function vulMenu() {
    if (!menu) return;
    menu.innerHTML = '';
    SOORTEN.forEach(function (s) {
      var b = document.createElement('button'); b.textContent = s.naam;
      if (staat.widgets.some(function (w) { return w.id === s.id; })) b.disabled = true;
      else b.addEventListener('click', function () { voegToe(s.id); });
      menu.appendChild(b);
    });
    // elke ROS-app als widget
    var kop = document.createElement('div'); kop.className = 'bureauMenu-kop'; kop.textContent = 'Apps';
    menu.appendChild(kop);
    rosApps().forEach(function (a) {
      var id = 'app:' + a.url;
      var b = document.createElement('button'); b.textContent = a.naam;
      if (staat.widgets.some(function (w) { return w.id === id; })) b.disabled = true;
      else b.addEventListener('click', function () { voegToe(id, a.url, a.naam); });
      menu.appendChild(b);
    });
  }

  function plaatsKnop() {
    var r = rechterMarge();
    if (plusKnop) plusKnop.style.left = Math.min(window.innerWidth - 60, r) + 'px';
    if (menu) { menu.style.left = Math.min(window.innerWidth - 180, r) + 'px'; menu.style.bottom = 'calc(env(safe-area-inset-bottom,0px) + 4rem)'; }
  }

  function aan() {
    if (actief) return; actief = true;
    stijl();
    laag = document.createElement('div'); laag.id = 'bureau';
    document.body.insertBefore(laag, document.body.firstChild);
    plusKnop = document.createElement('button'); plusKnop.id = 'bureauPlus'; plusKnop.setAttribute('aria-label', 'Widget toevoegen'); plusKnop.textContent = '+';
    menu = document.createElement('div'); menu.id = 'bureauMenu';
    document.body.appendChild(plusKnop); document.body.appendChild(menu);
    plusKnop.addEventListener('click', function () { menu.classList.toggle('open'); });
    plaatsKnop(); teken();
  }
  function uit() {
    if (!actief) return; actief = false;
    if (laag) { laag.querySelectorAll('.bw').forEach(function (w) { var s = soort(w.dataset.id); if (s) terug(s); }); }
    if (laag && laag.parentNode) laag.parentNode.removeChild(laag);
    if (plusKnop && plusKnop.parentNode) plusKnop.parentNode.removeChild(plusKnop);
    if (menu && menu.parentNode) menu.parentNode.removeChild(menu);
    laag = plusKnop = menu = null;
  }

  function beoordeel() {
    var app = document.getElementById('app');
    var binnen = app && app.classList.contains('active');
    if (binnen && window.innerWidth >= MIN) { aan(); plaatsKnop(); }
    else uit();
  }

  function start() {
    var app = document.getElementById('app');
    if (app) new MutationObserver(beoordeel).observe(app, { attributes: true, attributeFilter: ['class'] });
    var t;
    window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(function () { if (actief) plaatsKnop(); beoordeel(); }, 120); });
    beoordeel();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.RTGBureau = { beoordeel: beoordeel };
})();
