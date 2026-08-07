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
  /* Negen pagina's hebben een eigen zwevende Rahul-knop in hun HTML staan
     (button#rahulFab.rahulfab, met een eigen venster ernaast). Die werd
     onderdrukt door shared/randen.js, maar dat deed hij als onderdeel van het
     onderrand-gebaar -- en dat gebaar is weg. De onderdrukking hoort toch al
     hier: dit is de laag die Rahul levert, dus dit is de laag die weet dat een
     tweede knop een dubbeling is. Met !important, want het eigen script van
     die pagina's zet hem anders terug. */
  (function () {
    if (!document.querySelector('button#rahulFab.rahulfab')) return;
    if (document.getElementById('mgzFabWeg')) return;
    var st = document.createElement('style'); st.id = 'mgzFabWeg';
    st.textContent = 'button#rahulFab.rahulfab{display:none !important;}';
    (document.head || document.documentElement).appendChild(st);
  })();

  /* HEEFT DIT SCHERM ZIJN EIGEN RAHUL AL? Dan geen tweede balk.

     Dit stond als `/\/apps\/app\.html$/.test(location.pathname)`, en dat was
     precies één regel te letterlijk. Het leden-OS wordt namelijk niet alleen
     op /apps/app.html geserveerd: server/middleware/voordeur.js stuurt /,
     /apps/, /apps/index.html en /apps/bureau.html naar hetzelfde bestand,
     zonder omleiding. De browser ziet dan pad "/" -- de toets faalt, deze laag
     denkt dat ze op een gewone app-pagina staat, en zet zijn balk ONDER de
     chatbalk die het beginscherm zelf al heeft. Twee balken, twee invoervelden
     voor hetzelfde gesprek, precies onder elkaar. En op de meest bezochte
     ingang van allemaal, want dat is de kale domeinnaam.

     Een pad is dus niet waar je het aan afmeet: het scherm zegt zelf wel wat
     het is. <body data-ios-home> is het beginscherm en #osAiBalk IS die eigen
     chatbalk. Het pad blijft er als derde vangnet bij staan voor het geval een
     scherm ooit zonder allebei die kenmerken opent. */
  var eigenRahul = !!(document.getElementById('osAiBalk') ||
    (document.body && document.body.hasAttribute('data-ios-home')) ||
    /\/apps\/(app|bureau|index)\.html$|^\/(apps\/)?$/.test(location.pathname));
  if (!eigenRahul) {
    var pad = memTok ? '/api/fluister' : '/api/supplier/ai';
    var tok = memTok || supTok;
    /* De balk in plaats van de oude pil. De lippen zijn de knop: een tik klapt
       hem klein of groot. Typen en versturen kan alleen als hij groot is, dus
       een ingeklapte balk kan nooit per ongeluk iets versturen. */
    var balk = maakEl('<form class="mgz-balk" autocomplete="off">' +
      '<button class="mgz-orb" type="button" aria-label="Rahul groter of kleiner"></button>' +
      '<input aria-label="Vraag Rahul" placeholder="Vraag Rahul..." maxlength="300">' +
      '<button class="mgz-balkgo" type="submit" aria-label="Stuur naar Rahul">&#8594;</button></form>');
    var orb = balk.querySelector('.mgz-orb');
    var balkIn = balk.querySelector('input');
    /* De signatuurmond als HET gezicht van Rahul: dezelfde lippen als op het
       beginscherm. De mond-tekenlaag (shared/mond.js) laden we er zelf bij;
       lukt dat niet, dan blijft de knop gewoon een ronde knop. */
    var mond = { praat: function () {} };
    (function () {
      var zet = function () { if (window.RTGMond) mond = RTGMond.fab(orb, 1.1); };
      if (window.RTGMond) return zet();
      var s = document.createElement('script'); s.src = '/shared/mond.js'; s.onload = zet; document.head.appendChild(s);
    })();
    // klein of groot: de keuze van de gebruiker, en die blijft bewaard
    var KLEIN = 'rtg_rahulbalk_klein';
    var klein = false;
    try { klein = localStorage.getItem(KLEIN) === '1'; } catch (e) {}
    function zetMaat(k, focus) {
      klein = !!k;
      balk.classList.toggle('mgz-klein', klein);
      blok.classList.toggle('mgz-klein-blok', klein && sheet.hidden);
      orb.setAttribute('aria-expanded', klein ? 'false' : 'true');
      try { localStorage.setItem(KLEIN, klein ? '1' : '0'); } catch (e) {}
      if (!klein && focus) balkIn.focus();
    }
    orb.addEventListener('click', function () { zetMaat(!klein, true); });
    var fab = orb;   // de melding-stip hangt aan de lippen
    var sheet = maakEl('<section class="mgz-sheet" aria-label="Vraag Rahul" hidden>' +
      '<div class="mgz-kop"><span>Rahul</span><button class="mgz-x" type="button" aria-label="Antwoord sluiten">&#10005;</button></div>' +
      '<div class="mgz-seintjes" data-seintjes></div>' +
      '<div class="mgz-uit" aria-live="polite"></div>' +
      '<form class="mgz-rij" hidden><input maxlength="300" autocomplete="off" aria-label="Vraag of opdracht aan Rahul"><button class="mgz-go" type="submit">&#8594;</button></form></section>');
    /* De balk komt WEL in beeld, anders dan de pil die hier stond. Die was
       overal verborgen omdat hij te druk was, en daarmee was Rahul alleen nog
       te vinden via een veeg die je moest kennen. Een balk die je zelf klein
       maakt lost allebei op: hij is er altijd, en hij is zo groot als jij
       wilt. */
    /* Hier stond maakSleepbaar(): het venster was te verslepen omdat het over
       de pagina heen lag en dus in de weg kon zitten. Nu het onderdeel van het
       blok is, staat het waar het hoort en valt er niets te verslepen. */
    var uit = sheet.querySelector('.mgz-uit'), form = sheet.querySelector('form'), inp = form.querySelector('input');
    var seintjesVak = sheet.querySelector('[data-seintjes]');
    /* Balk en venster wisselen elkaar af: staat het antwoordvenster open, dan
       hoeft de balk er niet ook nog te zijn (twee invoervelden voor hetzelfde
       gesprek is precies de dubbeling die we net hebben opgeruimd). De lippen
       zelf blijven de knop van de balk; het venster heeft zijn eigen kruisje. */
    function opengaan(tekst) {
      sheet.hidden = false; doofMelding();
      if (tekst != null) { inp.value = String(tekst).slice(0, 300); }
      inp.focus();
      try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (e) {}
      if (!uit.textContent) uit.textContent = memTok ? 'Zeg wat je wilt. Ik zoek, reserveer, boek en bestel, alles met jouw eigen inlog.' : 'Vraag me alles over je zaak: cijfers, rooster, voorraad, en ik voer uit waar dat kan.';
    }
    balk.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var vraag = (balkIn.value || '').trim();
      if (!vraag) { zetMaat(false, true); return; }   // leeg versturen opent alleen
      balkIn.value = '';
      opengaan(vraag);
      // door de bestaande weg sturen, zodat antwoord en seintjes gelijk blijven
      if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true }));
    });
    sheet.querySelector('.mgz-x').addEventListener('click', function () {
      // alleen het antwoord gaat weg; de balk blijft staan waar hij stond
      sheet.hidden = true;
      blok.classList.toggle('mgz-klein-blok', klein);
      meetRuimte();
    });

