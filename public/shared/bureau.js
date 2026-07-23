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
  var MIN = 1360;
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

  var laag = null, plusKnop = null, menu = null, actief = false;
  var staat = laadStaat();

  function laadStaat() {
    try { var s = JSON.parse(localStorage.getItem(SLEUTEL)); if (s && s.widgets) return s; } catch (e) {}
    // standaard: Chat links, De Salon rechts -- beide marges gevuld
    return { widgets: [{ id: 'chat', kant: 'links', x: null, y: 40 }, { id: 'salon', kant: 'rechts', x: null, y: 40 }] };
  }
  function bewaar() { try { localStorage.setItem(SLEUTEL, JSON.stringify(staat)); } catch (e) {} }

  function rechterMarge() { return Math.round((window.innerWidth + 820) / 2 + 26); }
  function linkerMarge() { return Math.max(16, Math.round((window.innerWidth - 820) / 2 - BREED - 26)); }
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
      '.bw-body > .card,.bw-body > .os-social{margin:0!important;background:none!important;border:none!important;box-shadow:none!important;padding:0!important;}' +
      '.bw-leeg{color:var(--soft,#8A8680);font-size:.8rem;}' +
      '#bureauPlus{position:fixed;pointer-events:auto;z-index:2;bottom:calc(env(safe-area-inset-bottom,0px) + 1.1rem);' +
        'width:44px;height:44px;border-radius:50%;border:1px solid var(--line,rgba(255,255,255,.14));' +
        'background:color-mix(in srgb, var(--card,#151312) 70%, transparent);backdrop-filter:blur(18px);' +
        '-webkit-backdrop-filter:blur(18px);color:var(--gold,#857007);font-size:1.4rem;cursor:pointer;' +
        'box-shadow:0 12px 30px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;}' +
      '#bureauMenu{position:fixed;pointer-events:auto;z-index:3;display:none;flex-direction:column;gap:.15rem;' +
        'padding:.4rem;border-radius:14px;border:1px solid var(--line,rgba(255,255,255,.12));' +
        'background:color-mix(in srgb, var(--card,#151312) 90%, transparent);backdrop-filter:blur(20px);' +
        '-webkit-backdrop-filter:blur(20px);box-shadow:0 20px 50px rgba(0,0,0,.6);}' +
      '#bureauMenu.open{display:flex;}' +
      '#bureauMenu button{background:none;border:none;text-align:left;color:var(--txt,#F4F1EC);font-family:inherit;' +
        'font-size:.8rem;padding:.5rem .8rem;border-radius:9px;cursor:pointer;white-space:nowrap;}' +
      '#bureauMenu button:hover{background:color-mix(in srgb, var(--gold,#857007) 22%, transparent);}' +
      '#bureauMenu button[disabled]{opacity:.4;cursor:default;}';
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

  function widgetEl(w) {
    var s = soort(w.id); if (!s) return null;
    var el = document.createElement('section'); el.className = 'bw'; el.dataset.id = w.id;
    var kop = document.createElement('div'); kop.className = 'bw-kop';
    kop.innerHTML = '<span class="bw-grip"><i></i><i></i><i></i></span><span class="bw-naam"></span><button class="bw-x" aria-label="Terug naar het beginscherm">&times;</button>';
    kop.querySelector('.bw-naam').textContent = s.naam;
    kop.querySelector('.bw-x').addEventListener('click', function () { verwijder(w.id); });
    var body = document.createElement('div'); body.className = 'bw-body';
    el.appendChild(kop); el.appendChild(body);
    el.style.left = beginX(w) + 'px'; el.style.top = (w.y == null ? 40 : w.y) + 'px';
    leen(body, s);
    sleepbaar(el, kop, w);
    return el;
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
  function voegToe(id) {
    if (staat.widgets.some(function (w) { return w.id === id; })) return;
    // afwisselend links/rechts, op de kant met de minste widgets
    var links = staat.widgets.filter(function (w) { return w.kant === 'links'; }).length;
    var rechts = staat.widgets.length - links;
    var kant = links <= rechts ? 'links' : 'rechts';
    staat.widgets.push({ id: id, kant: kant, x: null, y: 40 + Math.floor(staat.widgets.length / 2) * 60 });
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
