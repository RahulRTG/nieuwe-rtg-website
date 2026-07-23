/* RTG Bureau: op een ruim scherm staat het leden-OS als een gecentreerd
   tablet-venster; de lege ruimte rechts vult zich met widgets die je zelf
   neerzet. Elke widget spiegelt een kaart uit de app (De Salon, Chat, Reis,
   Betalen) en ververst mee; je sleept ze waarheen je wilt en hun plek wordt
   onthouden. Met de plus-knop haal je er widgets bij of terug.

   Alleen op brede schermen (naast het 820px-venster is genoeg plek) en pas
   nadat je binnen bent (de app is actief). Zuiver presentatie: de widgets
   lezen de al-getekende kaarten, er gaat geen extra verkeer naar de server. */
(function () {
  if (window.RTGBureau) return;
  var MIN = 1360;                 // vanaf hier is er rechts genoeg ruimte
  var BREED = 300;
  var SLEUTEL = 'rtg_bureau_v1';
  var RUSTIG = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // de beschikbare widgets: naam + de bronkaart die ze spiegelen
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
    // standaard: Salon en Chat, netjes onder elkaar in de rechtermarge
    return { widgets: [{ id: 'salon', x: null, y: 40 }, { id: 'chat', x: null, y: 430 }] };
  }
  function bewaar() { try { localStorage.setItem(SLEUTEL, JSON.stringify(staat)); } catch (e) {} }

  function rechterMarge() { return Math.round((window.innerWidth + 820) / 2 + 26); }

  function stijl() {
    if (document.getElementById('bureauCss')) return;
    var st = document.createElement('style'); st.id = 'bureauCss';
    st.textContent =
      '#bureau{position:fixed;inset:0;z-index:1;pointer-events:none;}' +
      '.bw{position:absolute;width:' + BREED + 'px;max-height:46vh;pointer-events:auto;' +
        'background:color-mix(in srgb, var(--card,#151312) 78%, transparent);' +
        'backdrop-filter:blur(22px) saturate(1.3);-webkit-backdrop-filter:blur(22px) saturate(1.3);' +
        'border:1px solid var(--line,rgba(255,255,255,.1));border-radius:18px;overflow:hidden;' +
        'box-shadow:0 24px 60px rgba(0,0,0,.55);display:flex;flex-direction:column;' +
        (RUSTIG ? '' : 'transition:box-shadow .16s ease,transform .16s ease;') + '}' +
      '.bw.pak{box-shadow:0 34px 80px rgba(0,0,0,.7);' + (RUSTIG ? '' : 'transform:scale(1.012);') + 'cursor:grabbing;}' +
      '.bw-kop{display:flex;align-items:center;gap:.5rem;padding:.6rem .8rem;cursor:grab;' +
        'border-bottom:1px solid var(--line,rgba(255,255,255,.08));user-select:none;}' +
      '.bw-grip{display:flex;gap:2px;}.bw-grip i{width:3px;height:3px;border-radius:50%;background:var(--soft,#8A8680);display:block;}' +
      '.bw-naam{flex:1;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:var(--txt,#F4F1EC);}' +
      '.bw-x{background:none;border:none;color:var(--soft,#8A8680);cursor:pointer;font-size:1rem;line-height:1;padding:.1rem .2rem;}' +
      '.bw-x:hover{color:var(--txt,#F4F1EC);}' +
      '.bw-body{padding:.7rem .85rem 1rem;overflow-y:auto;font-size:.82rem;color:var(--muted,#B7B2A8);}' +
      '.bw-body .label{font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold,#857007);font-weight:700;margin-bottom:.3rem;}' +
      '.bw-body .big{font-family:"Bodoni Moda",serif;font-size:1.05rem;color:var(--txt,#F4F1EC);}' +
      '.bw-leeg{color:var(--soft,#8A8680);font-size:.78rem;}' +
      '#bureauPlus{position:fixed;pointer-events:auto;z-index:2;bottom:calc(env(safe-area-inset-bottom,0px) + 1.1rem);' +
        'width:44px;height:44px;border-radius:50%;border:1px solid var(--line,rgba(255,255,255,.14));' +
        'background:color-mix(in srgb, var(--card,#151312) 70%, transparent);backdrop-filter:blur(18px);' +
        '-webkit-backdrop-filter:blur(18px);color:var(--gold,#857007);font-size:1.4rem;cursor:pointer;' +
        'box-shadow:0 12px 30px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;}' +
      '#bureauMenu{position:fixed;pointer-events:auto;z-index:3;display:none;flex-direction:column;gap:.15rem;' +
        'padding:.4rem;border-radius:14px;border:1px solid var(--line,rgba(255,255,255,.12));' +
        'background:color-mix(in srgb, var(--card,#151312) 88%, transparent);backdrop-filter:blur(20px);' +
        '-webkit-backdrop-filter:blur(20px);box-shadow:0 20px 50px rgba(0,0,0,.6);}' +
      '#bureauMenu.open{display:flex;}' +
      '#bureauMenu button{background:none;border:none;text-align:left;color:var(--txt,#F4F1EC);font-family:inherit;' +
        'font-size:.8rem;padding:.5rem .8rem;border-radius:9px;cursor:pointer;white-space:nowrap;}' +
      '#bureauMenu button:hover{background:color-mix(in srgb, var(--gold,#857007) 22%, transparent);}' +
      '#bureauMenu button[disabled]{opacity:.4;cursor:default;}';
    document.head.appendChild(st);
  }

  function widgetEl(w) {
    var s = soort(w.id); if (!s) return null;
    var el = document.createElement('section'); el.className = 'bw'; el.dataset.id = w.id;
    el.innerHTML =
      '<div class="bw-kop"><span class="bw-grip"><i></i><i></i><i></i></span>' +
      '<span class="bw-naam"></span><button class="bw-x" aria-label="Sluiten">&times;</button></div>' +
      '<div class="bw-body"><div class="bw-leeg">…</div></div>';
    el.querySelector('.bw-naam').textContent = s.naam;
    var x = (w.x == null ? rechterMarge() : w.x);
    var y = (w.y == null ? 40 : w.y);
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.querySelector('.bw-x').addEventListener('click', function () { verwijder(w.id); });
    sleepbaar(el, w);
    return el;
  }

  function sleepbaar(el, w) {
    var kop = el.querySelector('.bw-kop');
    kop.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.bw-x')) return;
      e.preventDefault();
      var startX = e.clientX, startY = e.clientY;
      var beginL = parseFloat(el.style.left) || 0, beginT = parseFloat(el.style.top) || 0;
      el.classList.add('pak'); el.setPointerCapture && el.setPointerCapture(e.pointerId);
      function beweeg(ev) {
        var nx = Math.max(4, Math.min(window.innerWidth - 60, beginL + (ev.clientX - startX)));
        var ny = Math.max(4, Math.min(window.innerHeight - 40, beginT + (ev.clientY - startY)));
        el.style.left = nx + 'px'; el.style.top = ny + 'px';
      }
      function los() {
        el.classList.remove('pak');
        document.removeEventListener('pointermove', beweeg);
        document.removeEventListener('pointerup', los);
        w.x = parseFloat(el.style.left); w.y = parseFloat(el.style.top); bewaar();
      }
      document.addEventListener('pointermove', beweeg);
      document.addEventListener('pointerup', los);
    });
  }

  function teken() {
    if (!laag) return;
    laag.innerHTML = '';
    staat.widgets.forEach(function (w) { var el = widgetEl(w); if (el) laag.appendChild(el); });
    sync();
    vulMenu();
  }

  // de widget-lichamen spiegelen de al-getekende kaarten uit de app
  function sync() {
    if (!laag) return;
    var kaarten = laag.querySelectorAll('.bw');
    for (var i = 0; i < kaarten.length; i++) {
      var el = kaarten[i], s = soort(el.dataset.id); if (!s) continue;
      var bron = document.getElementById(s.bron);
      var body = el.querySelector('.bw-body');
      if (bron && bron.innerHTML.trim() && bron.style.display !== 'none') {
        if (body.dataset.hash !== String(bron.innerHTML.length) + bron.innerHTML.slice(0, 24)) {
          body.innerHTML = bron.innerHTML;
          body.dataset.hash = String(bron.innerHTML.length) + bron.innerHTML.slice(0, 24);
        }
      } else if (!body.querySelector('.bw-leeg')) {
        body.innerHTML = '<div class="bw-leeg">Niets om te tonen.</div>';
      }
    }
  }

  function verwijder(id) {
    staat.widgets = staat.widgets.filter(function (w) { return w.id !== id; });
    bewaar(); teken();
  }
  function voegToe(id) {
    if (staat.widgets.some(function (w) { return w.id === id; })) return;
    staat.widgets.push({ id: id, x: rechterMarge(), y: 40 + staat.widgets.length * 40 });
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
    // meelezen met de app: elke seconde de kaarten spiegelen (zuinig, alleen zichtbaar)
    setInterval(function () { if (actief && !document.hidden) sync(); }, 1100);
  }
  function uit() {
    if (!actief) return; actief = false;
    if (laag && laag.parentNode) laag.parentNode.removeChild(laag);
    if (plusKnop && plusKnop.parentNode) plusKnop.parentNode.removeChild(plusKnop);
    if (menu && menu.parentNode) menu.parentNode.removeChild(menu);
    laag = plusKnop = menu = null;
  }

  function beoordeel() {
    var app = document.getElementById('app');
    var binnen = app && app.classList.contains('active');
    var ruim = window.innerWidth >= MIN;
    if (binnen && ruim) { aan(); plaatsKnop(); }
    else uit();
  }

  function start() {
    var app = document.getElementById('app');
    if (app) {
      // reageer zodra de app actief wordt (na de inlog) of weer verdwijnt
      new MutationObserver(beoordeel).observe(app, { attributes: true, attributeFilter: ['class'] });
    }
    window.addEventListener('resize', function () { if (actief) plaatsKnop(); beoordeel(); });
    beoordeel();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.RTGBureau = { sync: sync, beoordeel: beoordeel };
})();
