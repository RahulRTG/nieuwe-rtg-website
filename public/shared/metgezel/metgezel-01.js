/* De metgezel: Rahul + Samen, op elke app-pagina. Een klein script dat
   zichzelf inricht naar wie er is ingelogd:
   - een RTG-lid krijgt de Rahul-knop (vraagt en doet, via /api/fluister) en
     de Samen-knop: een sessie starten of meedoen met een code, samen door
     het OS lopen ("ga mee"-seintjes via SSE) en een kamer-chat
   - een zaak (leverancier-token) krijgt de Rahul-knop via de zaak-AI
   - is er al een eigen Rahul-knop op de pagina (#rahulFab), dan laten we
     die met rust en voegen we alleen Samen toe
   - zonder inlog doet het script niets (geen knoppen, geen verkeer) */
(function () {
  if (window.__metgezel) return; window.__metgezel = true;
  var memTok = null, supTok = null;
  try { memTok = localStorage.getItem('rtg_member_token'); } catch (e) {}
  try { supTok = localStorage.getItem('rtg_sup_token'); } catch (e) {}
  if (!memTok && !supTok) return;

  /* De muisvrije laag erbij (shared/handenvrij.js): de stuurbalk waar je in typt
     of tegen praat, met navigatie zonder tik. Hij hangt hier omdat de metgezel
     al op elke app-pagina staat en al weet dat er iemand is ingelogd; zo is het
     een script erbij in plaats van 150+ pagina's aanpassen. Lukt het laden niet,
     dan verandert er niets: alle knoppen blijven gewoon staan. */
  (function () {
    if (window.__handenvrij) return;
    var s = document.createElement('script');
    s.src = '/shared/handenvrij.js'; s.defer = true;
    document.head.appendChild(s);
  })();

  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };

  var css = '.mgz-knop{position:fixed;right:1rem;z-index:35;border:none;border-radius:999px;padding:.65rem 1rem;font-family:Inter,system-ui,sans-serif;font-weight:600;font-size:.83rem;cursor:grab;touch-action:none;box-shadow:0 6px 20px rgba(0,0,0,.4);}' +
    '.mgz-knop.mgz-sleept{cursor:grabbing;opacity:.9;box-shadow:0 12px 34px rgba(0,0,0,.55);}' +
    '.mgz-rahul{bottom:1rem;background:var(--gold,#857007);color:#000;}' +
    '.mgz-samen{bottom:3.6rem;background:#151312;color:#eee;border:1px solid var(--gold,#857007);}' +
    '.mgz-sheet{position:fixed;right:1rem;bottom:1rem;z-index:36;width:min(360px,92vw);background:#151312;border:1px solid var(--gold,#857007);border-radius:16px;padding:.9rem;display:flex;flex-direction:column;gap:.6rem;box-shadow:0 10px 30px rgba(0,0,0,.5);color:#eee;font-family:Inter,system-ui,sans-serif;}' +
    '.mgz-sheet[hidden]{display:none;}.mgz-kop{display:flex;align-items:center;justify-content:space-between;font-weight:600;cursor:move;touch-action:none;user-select:none;-webkit-user-select:none;}' +
    '.mgz-sheet.mgz-sleept{opacity:.96;box-shadow:0 16px 44px rgba(0,0,0,.6);}' +
    '.mgz-x{background:transparent;border:1px solid #333;border-radius:8px;color:#eee;padding:.15rem .5rem;cursor:pointer;}' +
    '.mgz-uit{font-size:.84rem;color:#bbb;line-height:1.55;max-height:40vh;overflow-y:auto;white-space:pre-wrap;}' +
    '.mgz-rij{display:flex;gap:.4rem;}.mgz-rij input{flex:1;background:#0C0C0B;border:1px solid #333;border-radius:10px;color:#eee;font:inherit;font-size:.85rem;padding:.5rem .7rem;}' +
    '.mgz-go{background:var(--gold,#857007);color:#000;border:none;border-radius:10px;padding:.5rem .9rem;font-weight:700;cursor:pointer;}' +
    '.mgz-stil{background:transparent;color:#eee;border:1px solid #444;border-radius:10px;padding:.5rem .8rem;font:inherit;font-size:.83rem;cursor:pointer;}' +
    '.mgz-banner{position:fixed;left:50%;transform:translateX(-50%);bottom:6.4rem;z-index:37;background:#0C0C0B;border:1px solid var(--gold,#857007);border-radius:12px;padding:.6rem .9rem;font-family:Inter,system-ui,sans-serif;font-size:.84rem;color:#eee;display:flex;gap:.6rem;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,.5);max-width:92vw;}' +
    '.mgz-code{font-family:ui-monospace,monospace;letter-spacing:.2em;color:var(--gold,#857007);font-weight:700;}' +
    '.mgz-chat{font-size:.82rem;color:#bbb;max-height:26vh;overflow-y:auto;line-height:1.5;}' +
    /* de melding-staat: de lippen verkleuren (gouden gloed die ademt) en er
       komt een klein bordeaux teken met het aantal; tikken opent de melding */
    '.mgz-rahul.mgz-meld{background:#0C0C0B;border:1px solid var(--gold,#857007);animation:mgzPuls 1.8s ease-in-out infinite;}' +
    '@keyframes mgzPuls{0%,100%{box-shadow:0 6px 20px rgba(0,0,0,.4),0 0 0 0 rgba(158,28,64,.55);}50%{box-shadow:0 6px 20px rgba(0,0,0,.4),0 0 14px 5px rgba(158,28,64,.55);}}' +
    '@media (prefers-reduced-motion: reduce){.mgz-rahul.mgz-meld{animation:none;box-shadow:0 6px 20px rgba(0,0,0,.4),0 0 12px 4px rgba(158,28,64,.5);}}' +
    '.mgz-stip{position:absolute;top:-4px;right:-4px;min-width:1.05rem;height:1.05rem;padding:0 .25rem;border-radius:999px;background:#9E1C40;color:#fff;font-size:.66rem;font-weight:700;line-height:1.05rem;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.5);}' +
    '.mgz-seintjes{display:flex;flex-direction:column;gap:.4rem;}' +
    '.mgz-seintje{background:#0C0C0B;border:1px solid var(--gold,#857007);border-radius:12px;padding:.5rem .7rem;font-size:.82rem;color:#eee;line-height:1.45;cursor:pointer;text-align:left;width:100%;}' +
    '.mgz-seintje:hover{border-color:#C23A5E;}.mgz-seintje b{color:var(--gold,#857007);display:block;font-size:.72rem;letter-spacing:.04em;text-transform:uppercase;margin-bottom:.15rem;}' +
    /* de lege-toestand-knop: overal waar nog niets staat, kan Rahul het regelen */
    '.rahul-leeg-knop{display:inline-flex;align-items:center;gap:.4rem;background:transparent;border:1px solid var(--gold,#857007);color:var(--gold,#857007);border-radius:999px;padding:.5rem .9rem;font-family:Inter,system-ui,sans-serif;font-size:.83rem;font-weight:600;cursor:pointer;}' +
    '.rahul-leeg-knop:hover{background:var(--gold,#857007);color:#0C0C0B;}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var maakEl = function (html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstChild; };

  /* Alles wat uitspringt is te verslepen: geef het element (el) een greep
     (greep, bv. de kopbalk; standaard het element zelf). Sleep de greep en het
     hele blok verhuist mee; de plek onthouden we per toestel (localStorage).
     Knoppen en velden binnen de greep blijven gewoon werken (die starten geen
     sleep). Een korte tik telt niet als sleep -- pas voorbij een kleine drempel
     beweegt het. */
  function maakSleepbaar(el, sleutel, greep) {
    greep = greep || el;
    var neer = null, sleept = false;
    function klem(x, y) {
      var b = el.getBoundingClientRect();
      var mx = window.innerWidth - b.width - 6, my = window.innerHeight - b.height - 6;
      return { x: Math.max(6, Math.min(x, mx)), y: Math.max(6, Math.min(y, my)) };
    }
    function zet(x, y) {
      var p = klem(x, y);
      el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
      el.style.right = 'auto'; el.style.bottom = 'auto';
    }
    try { var s = JSON.parse(localStorage.getItem(sleutel) || 'null'); if (s) requestAnimationFrame(function () { zet(s.x, s.y); }); } catch (e) {}
    greep.addEventListener('pointerdown', function (e) {
      // knoppen, links en invoervelden in de greep gewoon laten werken
      if (e.target.closest && e.target.closest('button, a, input, textarea, select')) return;
      var r = el.getBoundingClientRect();
      neer = { x: e.clientX, y: e.clientY, bx: r.left, by: r.top }; sleept = false;
      try { greep.setPointerCapture(e.pointerId); } catch (er) {}
    });
    greep.addEventListener('pointermove', function (e) {
      if (!neer) return;
      var dx = e.clientX - neer.x, dy = e.clientY - neer.y;
      if (!sleept && Math.abs(dx) + Math.abs(dy) > 6) { sleept = true; el.classList.add('mgz-sleept'); }
      if (sleept) { zet(neer.bx + dx, neer.by + dy); e.preventDefault(); }
    });
    greep.addEventListener('pointerup', function () {
      if (neer && sleept) {
        var r = el.getBoundingClientRect();
        try { localStorage.setItem(sleutel, JSON.stringify({ x: r.left, y: r.top })); } catch (er) {}
      }
      neer = null; sleept = false; el.classList.remove('mgz-sleept');
    });
    // bij het verkleinen van het scherm: alleen bijsturen als het blok al een
    // eigen (versleepte) plek heeft, anders blijft de nette CSS-hoek staan
    window.addEventListener('resize', function () { if (el.style.left) { var r = el.getBoundingClientRect(); zet(r.left, r.top); } });
  }

  /* ---------- Rahul: vraagt en doet, met de inlog die er is ---------- */
  // de grote apps (leden-OS, leverancier, PDA, backoffice) hebben Rahul al
  // diep ingebouwd; daar voegen we alleen Samen toe, geen tweede knop
  var eigenRahul = /\/apps\/(app|leverancier|personeel|backoffice)\.html$/.test(location.pathname);
  if (!eigenRahul && !document.getElementById('rahulFab')) {
    var pad = memTok ? '/api/fluister' : '/api/supplier/ai';
    var tok = memTok || supTok;
    var fab = maakEl('<button class="mgz-knop mgz-rahul" type="button" aria-label="Vraag Rahul">Rahul</button>');
    /* De signatuurmond als HET gezicht van Rahul: dezelfde lippen als op de
       voorpagina, klein op de knop, altijd in de buurt. De mond-tekenlaag
       (shared/mond.js) laden we er zelf bij; lukt dat niet, dan blijft de
       tekstknop gewoon staan. */
    var mond = { praat: function () {} };
    (function () {
      var zet = function () { if (window.RTGMond) { fab.style.padding = '.3rem .55rem'; fab.style.background = '#0C0C0B'; fab.style.border = '1px solid var(--gold,#857007)'; mond = RTGMond.fab(fab); } };
      if (window.RTGMond) return zet();
      var s = document.createElement('script'); s.src = '/shared/mond.js'; s.onload = zet; document.head.appendChild(s);
    })();
    fab.style.position = 'fixed'; // zodat de melding-stip erop past
    var sheet = maakEl('<section class="mgz-sheet" aria-label="Vraag Rahul" hidden>' +
      '<div class="mgz-kop"><span>Vraag het Rahul</span><button class="mgz-x" type="button" aria-label="Sluiten">✕</button></div>' +
      '<div class="mgz-seintjes" data-seintjes></div>' +
      '<div class="mgz-uit" aria-live="polite"></div>' +
      '<form class="mgz-rij"><input placeholder="bv. boek een taxi naar huis" maxlength="300" autocomplete="off" aria-label="Vraag of opdracht aan Rahul"><button class="mgz-go" type="submit" aria-label="Versturen">→</button></form></section>');
    // De zwevende Rahul-knop rechtsonder is overal weggehaald: te druk in beeld.
    // Rahul blijft bereikbaar -- in het leden-OS via het dock en de zoekbalk, en
    // op elke pagina via de lege-toestand-nudges (window.RTGRahul.vraag). We
    // houden het vraagvenster (sheet) in de DOM, alleen de knop tonen we niet.
    document.body.appendChild(sheet);
    // het vraagvenster is te verslepen aan zijn kopbalk; de plek blijft bewaard
    maakSleepbaar(sheet, 'rtg_rahul_sheet_pos', sheet.querySelector('.mgz-kop'));
    var uit = sheet.querySelector('.mgz-uit'), form = sheet.querySelector('form'), inp = form.querySelector('input');
    var seintjesVak = sheet.querySelector('[data-seintjes]');
    fab.addEventListener('click', function () { sheet.hidden = false; fab.hidden = true; inp.focus(); doofMelding();
      if (!uit.textContent) uit.textContent = memTok ? 'Zeg wat je wilt. Ik zoek, reserveer, boek en bestel, alles met jouw eigen inlog.' : 'Vraag me alles over je zaak: cijfers, rooster, voorraad, en ik voer uit waar dat kan.'; });
    sheet.querySelector('.mgz-x').addEventListener('click', function () { sheet.hidden = true; fab.hidden = false; });

