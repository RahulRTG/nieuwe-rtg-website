/* RTG Flagship: op een ruim scherm staat een kantoorpagina als een rustig,
   gecentreerd iPad-kader in het midden -- het "middelste scherm". Dat middelste
   scherm is de vaste ankerplek: je kunt het breder/smaller maken, maar niet
   wegklikken. Eromheen zet je widgets die je vrij verplaatst, van formaat
   verandert en desgewenst wegklikt. Sleep een widget met een rand vlak langs
   een andere widget of langs het middelste scherm, dan klikt hij er vanzelf
   tegenaan (magnetisch). Rustig gehouden, niet wild. Plek en maat worden
   onthouden. Op een smal scherm blijft de pagina gewoon zoals hij is.

   Aanzetten: geef <body> het attribuut data-flagship. */
(function (w, d) {
  'use strict';
  if (w.RTGFlagship) return;
  var MIN = 1180, KLEEF = 14;
  function wereld() { return d.body.getAttribute('data-oswereld') || 'kantoor'; }
  function fkey() { return 'rtg_flagship_' + wereld(); }
  function wkey() { return 'rtg_flagwidgets_' + wereld(); }

  function breed() { try { var v = +localStorage.getItem(fkey()); if (v >= 680 && v <= 1400) return v; } catch (e) {} return 940; }
  function zetBreed(v) { v = Math.max(680, Math.min(1400, Math.round(v))); try { localStorage.setItem(fkey(), v); } catch (e) {} d.documentElement.style.setProperty('--flag-breed', v + 'px'); }

  /* ---- de widgets ---- */
  var SOORTEN = {
    klok: { naam: 'Klok', bouw: bouwKlok, w: 210, h: 150 },
    notitie: { naam: 'Notitie', bouw: bouwNotitie, w: 240, h: 190 },
    rahul: { naam: 'Rahul', bouw: bouwRahul, w: 210, h: 120 }
  };
  function laadW() {
    try { var s = JSON.parse(localStorage.getItem(wkey())); if (s && s.length) return s; } catch (e) {}
    return [{ id: 'klok', x: 24, y: 120, w: 210, h: 150 }, { id: 'notitie', x: 24, y: 300, w: 240, h: 190 }];
  }
  function bewaarW() { try { localStorage.setItem(wkey(), JSON.stringify(widgets)); } catch (e) {} }
  var widgets = [];

  function bouwKlok(body) {
    var t = d.createElement('div'); t.style.cssText = 'font-family:"Bodoni Moda",serif;font-size:2rem;line-height:1.1;color:var(--txt,#F4F1EC);';
    var dt = d.createElement('div'); dt.style.cssText = 'font-size:.72rem;color:var(--soft,#8A8680);margin-top:.2rem;letter-spacing:.06em;';
    body.appendChild(t); body.appendChild(dt);
    function tik() {
      if (!body.isConnected) return;
      var n = new Date();
      t.textContent = ('' + n.getHours()).padStart(2, '0') + ':' + ('' + n.getMinutes()).padStart(2, '0');
      dt.textContent = n.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    tik(); var iv = setInterval(function () { if (!body.isConnected) { clearInterval(iv); return; } tik(); }, 1000);
  }
  function bouwNotitie(body) {
    var ta = d.createElement('textarea');
    ta.placeholder = 'Notitie...'; ta.style.cssText = 'width:100%;height:100%;resize:none;border:0;background:none;color:var(--txt,#F4F1EC);font-family:Inter,system-ui,sans-serif;font-size:.82rem;line-height:1.5;outline:none;';
    var sl = 'rtg_flagnotitie_' + wereld();
    try { ta.value = localStorage.getItem(sl) || ''; } catch (e) {}
    ta.addEventListener('input', function () { try { localStorage.setItem(sl, ta.value); } catch (e) {} });
    body.style.padding = '0'; body.appendChild(ta);
  }
  function bouwRahul(body) {
    var b = d.createElement('button');
    b.textContent = 'Vraag Rahul'; b.type = 'button';
    b.style.cssText = 'width:100%;padding:.7rem;border-radius:12px;border:1px solid var(--line,rgba(255,255,255,.14));background:var(--card2,#1B1817);color:var(--txt,#F4F1EC);font-family:Inter,system-ui,sans-serif;font-weight:600;font-size:.82rem;cursor:pointer;';
    b.addEventListener('click', function () {
      var m = d.querySelector('.metgezel-knop, [data-rahul], #rahulKnop, .rtg-metgezel');
      if (m) m.click();
    });
    body.appendChild(b);
  }

  function stijl() {
    if (d.getElementById('flagCss')) return;
    var st = d.createElement('style'); st.id = 'flagCss';
    st.textContent =
      ':root{--flag-breed:940px;}' +
      '@media (min-width:' + MIN + 'px){' +
      'body[data-flagship] main#hoofd{max-width:var(--flag-breed);margin:1.6rem auto 3.4rem;' +
        'border:1px solid var(--line,rgba(255,255,255,.1));border-radius:24px;' +
        'background:color-mix(in srgb, var(--card,#151312) 55%, transparent);' +
        'box-shadow:0 34px 90px -55px rgba(0,0,0,.6);position:relative;transition:max-width .12s ease;}' +
      'body[data-flagship] main#hoofd > .wrap{max-width:100%;}' +
      'body[data-flagship] #flagGreep{position:absolute;top:50%;right:-8px;transform:translateY(-50%);' +
        'width:16px;height:70px;border-radius:999px;cursor:ew-resize;z-index:6;touch-action:none;' +
        'background:color-mix(in srgb, var(--card,#151312) 80%, transparent);border:1px solid var(--line,rgba(255,255,255,.16));' +
        'display:flex;align-items:center;justify-content:center;}' +
      'body[data-flagship] #flagGreep::after{content:"";width:3px;height:32px;border-radius:2px;background:var(--soft,#8A8680);}' +
      'body[data-flagship] #flagGreep:hover::after{background:var(--gold,#A98F1C);}' +
      '#flagWidgets{position:fixed;inset:0;z-index:2;pointer-events:none;}' +
      '.fw{position:fixed;pointer-events:auto;background:color-mix(in srgb, var(--card,#151312) 82%, transparent);' +
        'border:1px solid var(--line,rgba(255,255,255,.1));border-radius:16px;overflow:hidden;display:flex;flex-direction:column;' +
        'box-shadow:0 20px 50px -30px rgba(0,0,0,.6);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);}' +
      '.fw.pak{box-shadow:0 30px 70px -30px rgba(0,0,0,.75);}' +
      '.fw-kop{display:flex;align-items:center;gap:.4rem;padding:.4rem .55rem;cursor:grab;flex:0 0 auto;' +
        'border-bottom:1px solid var(--line,rgba(255,255,255,.08));user-select:none;}' +
      '.fw.pak .fw-kop{cursor:grabbing;}' +
      '.fw-naam{flex:1;font-size:.64rem;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:var(--soft,#8A8680);}' +
      '.fw-x{background:none;border:none;color:var(--soft,#8A8680);cursor:pointer;font-size:1rem;line-height:1;padding:0 .2rem;}' +
      '.fw-x:hover{color:var(--txt,#F4F1EC);}' +
      '.fw-body{flex:1 1 auto;padding:.7rem .8rem;overflow:auto;min-height:0;}' +
      '.fw-grip{position:absolute;right:0;bottom:0;width:18px;height:18px;cursor:nwse-resize;touch-action:none;}' +
      '.fw-grip::after{content:"";position:absolute;right:4px;bottom:4px;width:7px;height:7px;border-right:2px solid var(--soft,#8A8680);border-bottom:2px solid var(--soft,#8A8680);opacity:.6;}' +
      '#flagPlus{position:fixed;pointer-events:auto;z-index:3;left:18px;bottom:calc(18px + env(safe-area-inset-bottom,0px));' +
        'width:42px;height:42px;border-radius:50%;border:1px solid var(--line,rgba(255,255,255,.14));cursor:pointer;' +
        'background:color-mix(in srgb, var(--card,#151312) 78%, transparent);color:var(--gold,#A98F1C);font-size:1.35rem;' +
        'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 12px 30px -12px rgba(0,0,0,.5);}' +
      '#flagMenu{position:fixed;pointer-events:auto;z-index:4;left:18px;bottom:70px;display:none;flex-direction:column;gap:.1rem;' +
        'padding:.35rem;border-radius:12px;border:1px solid var(--line,rgba(255,255,255,.12));' +
        'background:color-mix(in srgb, var(--card,#151312) 92%, transparent);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);}' +
      '#flagMenu.open{display:flex;}' +
      '#flagMenu button{background:none;border:none;text-align:left;color:var(--txt,#F4F1EC);font-family:inherit;font-size:.8rem;padding:.45rem .8rem;border-radius:8px;cursor:pointer;white-space:nowrap;}' +
      '#flagMenu button:hover{background:color-mix(in srgb, var(--gold,#A98F1C) 22%, transparent);}' +
      '}';
    d.head.appendChild(st);
  }

  var laag = null;
  function rechten(excl) {
    // snap-doelen: de randen van het middelste scherm + van alle andere widgets
    var r = [], main = d.getElementById('hoofd');
    if (main) r.push(main.getBoundingClientRect());
    laag.querySelectorAll('.fw').forEach(function (o) { if (o !== excl) r.push(o.getBoundingClientRect()); });
    return r;
  }
  function magneet(el, x, y) {
    var ew = el.offsetWidth, eh = el.offsetHeight, doelen = rechten(el);
    var bx = null, by = null, dx = KLEEF, dy = KLEEF;
    doelen.forEach(function (o) {
      [o.left, o.right].forEach(function (kx) {
        if (Math.abs(x - kx) < dx) { dx = Math.abs(x - kx); bx = { v: kx, r: false }; }
        if (Math.abs((x + ew) - kx) < dx) { dx = Math.abs((x + ew) - kx); bx = { v: kx, r: true }; }
      });
      [o.top, o.bottom].forEach(function (ky) {
        if (Math.abs(y - ky) < dy) { dy = Math.abs(y - ky); by = { v: ky, r: false }; }
        if (Math.abs((y + eh) - ky) < dy) { dy = Math.abs((y + eh) - ky); by = { v: ky, r: true }; }
      });
    });
    if (bx) x = bx.r ? bx.v - ew : bx.v;
    if (by) y = by.r ? by.v - eh : by.v;
    return { x: x, y: y };
  }

  function widgetEl(wd) {
    var S = SOORTEN[wd.id]; if (!S) return null;
    var el = d.createElement('section'); el.className = 'fw';
    el.style.left = (wd.x || 24) + 'px'; el.style.top = (wd.y || 120) + 'px';
    el.style.width = (wd.w || S.w) + 'px'; el.style.height = (wd.h || S.h) + 'px';
    var kop = d.createElement('div'); kop.className = 'fw-kop';
    kop.innerHTML = '<span class="fw-naam"></span><button class="fw-x" type="button" aria-label="Widget sluiten">&times;</button>';
    kop.querySelector('.fw-naam').textContent = S.naam;
    var body = d.createElement('div'); body.className = 'fw-body';
    var grip = d.createElement('span'); grip.className = 'fw-grip';
    el.appendChild(kop); el.appendChild(body); el.appendChild(grip);
    S.bouw(body);
    kop.querySelector('.fw-x').addEventListener('click', function () { verwijder(wd); });
    sleep(el, kop, wd); formaat(el, grip, wd);
    return el;
  }

  function sleep(el, kop, wd) {
    kop.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.fw-x')) return;
      e.preventDefault();
      var sx = e.clientX, sy = e.clientY, bl = parseFloat(el.style.left) || 0, bt = parseFloat(el.style.top) || 0;
      el.classList.add('pak'); try { el.setPointerCapture(e.pointerId); } catch (x) {}
      function bw(ev) {
        var nx = Math.max(4, Math.min(w.innerWidth - 60, bl + (ev.clientX - sx)));
        var ny = Math.max(4, Math.min(w.innerHeight - 44, bt + (ev.clientY - sy)));
        var m = magneet(el, nx, ny); el.style.left = m.x + 'px'; el.style.top = m.y + 'px';
      }
      function los() { el.classList.remove('pak'); d.removeEventListener('pointermove', bw); d.removeEventListener('pointerup', los);
        wd.x = parseFloat(el.style.left); wd.y = parseFloat(el.style.top); bewaarW(); }
      d.addEventListener('pointermove', bw); d.addEventListener('pointerup', los);
    });
  }
  function formaat(el, grip, wd) {
    grip.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation();
      var sx = e.clientX, sy = e.clientY, bw2 = el.offsetWidth, bh = el.offsetHeight;
      try { grip.setPointerCapture(e.pointerId); } catch (x) {}
      function bw(ev) {
        el.style.width = Math.max(150, Math.min(520, bw2 + (ev.clientX - sx))) + 'px';
        el.style.height = Math.max(110, Math.min(Math.round(w.innerHeight * 0.85), bh + (ev.clientY - sy))) + 'px';
      }
      function los() { d.removeEventListener('pointermove', bw); d.removeEventListener('pointerup', los);
        wd.w = el.offsetWidth; wd.h = el.offsetHeight; bewaarW(); }
      d.addEventListener('pointermove', bw); d.addEventListener('pointerup', los);
    });
  }

  function teken() {
    if (!laag) return;
    laag.innerHTML = '';
    widgets.forEach(function (wd) { var el = widgetEl(wd); if (el) laag.appendChild(el); });
  }
  function verwijder(wd) { widgets = widgets.filter(function (x) { return x !== wd; }); bewaarW(); teken(); }
  function voegToe(id) {
    var S = SOORTEN[id]; if (!S) return;
    widgets.push({ id: id, x: 24, y: 120 + widgets.length * 30, w: S.w, h: S.h });
    bewaarW(); teken();
    var mn = d.getElementById('flagMenu'); if (mn) mn.classList.remove('open');
  }

  function start() {
    if (!d.body || !d.body.hasAttribute('data-flagship')) return;
    stijl(); zetBreed(breed());
    if (w.innerWidth < MIN) return;
    var main = d.getElementById('hoofd'); if (!main) return;
    // de resize-greep van het middelste scherm (het middelste scherm zelf blijft
    // altijd staan -- geen kruisje, niet weg te klikken)
    if (!d.getElementById('flagGreep')) {
      var g = d.createElement('div'); g.id = 'flagGreep'; g.setAttribute('role', 'separator');
      g.setAttribute('aria-label', 'Versleep om het middelste scherm breder of smaller te maken');
      main.appendChild(g);
      g.addEventListener('pointerdown', function (e) {
        e.preventDefault(); try { g.setPointerCapture(e.pointerId); } catch (x) {}
        var sx = e.clientX, bw2 = main.offsetWidth;
        function bw(ev) { zetBreed(bw2 + (ev.clientX - sx) * 2); }
        function los() { d.removeEventListener('pointermove', bw); d.removeEventListener('pointerup', los); }
        d.addEventListener('pointermove', bw); d.addEventListener('pointerup', los);
      });
    }
    // de widgetlaag + de plus-knop
    if (!d.getElementById('flagWidgets')) {
      laag = d.createElement('div'); laag.id = 'flagWidgets'; d.body.appendChild(laag);
      var plus = d.createElement('button'); plus.id = 'flagPlus'; plus.type = 'button'; plus.textContent = '+';
      plus.setAttribute('aria-label', 'Widget toevoegen');
      var menu = d.createElement('div'); menu.id = 'flagMenu';
      Object.keys(SOORTEN).forEach(function (id) {
        var b = d.createElement('button'); b.type = 'button'; b.textContent = SOORTEN[id].naam;
        b.addEventListener('click', function () { voegToe(id); }); menu.appendChild(b);
      });
      d.body.appendChild(plus); d.body.appendChild(menu);
      plus.addEventListener('click', function () { menu.classList.toggle('open'); });
      widgets = laadW(); teken();
    }
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();
  w.RTGFlagship = { breed: breed, zet: zetBreed };
})(window, document);
