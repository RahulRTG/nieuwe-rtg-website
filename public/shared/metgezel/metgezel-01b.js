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
  // Het leden-OS heeft Rahul als eigen app in het dock; daar zou een tweede
  // chatbalk een kopie zijn. Op de werk-apps (leverancier, PDA, backoffice)
  // zit Rahul wel ingebouwd, maar alleen per kamer of per kaart -- daar is een
  // chatbalk die je overal vandaan kunt oproepen (van de onderrand,
  // shared/randen.js) juist een toevoeging, geen dubbeling.
  var eigenRahul = /\/apps\/app\.html$/.test(location.pathname);
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

