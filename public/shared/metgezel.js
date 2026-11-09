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
  // Een gastprogramma is een zelfstandige leesweergave zonder accountshell.
  if (document.body && document.body.dataset.publicPlatform === 'travel-guest') return;
  if (window.__metgezel) return; window.__metgezel = true;
  /* De metgezel hoort bij de OMGEVING, niet bij een ingebed vlak. Draait deze
     pagina in een frame -- een surface in de RTG-werkruimte, of het comm-venster
     in de personeels-PDA -- dan staat Rahul al in de omgeving eromheen, en zou
     dit script hem een tweede keer neerzetten. Met drie surfaces open stonden er
     drie chatbalken onder elkaar; dat is precies het soort dubbeling waar een
     gedeelde laag juist voor is (LAT.md regel 4). */
  try { if (window.top !== window.self) return; } catch (e) { /* andere herkomst: dan is het zeker een frame */ return; }
  /* Eén begrensde laadweg voor de vier bestaande gedeelde eigenaren. Iedere
     callsite hieronder geeft een letterlijk intern pad; de helper verzint geen
     modules en vormt dus geen tweede register of loaderarchitectuur. */
  function laadScript(path, klaar, uitgesteld) {
    var script = document.createElement('script');
    if (klaar) script.addEventListener('load', klaar, { once: true });
    script.src = path; if (uitgesteld) script.defer = true;
    document.head.appendChild(script);
  }
  /* De wauw-laag (shared/wauw.js) eerst: zachte overgangen, haptiek,
     delen, badge en wake lock. Voor de inlogcheck, zodat ook de poort
     hem heeft; net als handenvrij is het een script erbij in plaats
     van 120+ pagina's aanpassen, en zonder laag verandert er niets. */
  if (!window.RTGWauw) {
    laadScript('/shared/wauw.js', null, true);
  }
  /* DE STROOM (shared/stroom.js): pas geladen als deze laag een live-stroom
     opent, en dat doet hij op bijna geen scherm. Sindsdien staat de sessie
     nooit meer in het adres van zo'n stroom. Een script erbij, net als de
     wauw-laag hierboven, in plaats van bijna driehonderd pagina's aanpassen. */
  function metStroom(doe) {
    if (window.RTGStroom) return doe(window.RTGStroom);
    var s = document.querySelector('script[src="/shared/stroom.js"]');
    var klaar = function () { if (window.RTGStroom) doe(window.RTGStroom); };
    if (s) s.addEventListener('load', klaar, { once: true });
    else laadScript('/shared/stroom.js', klaar, false);
  }
  var memTok = null, supTok = null;
  try { memTok = localStorage.getItem('rtg_member_token'); } catch (e) {}
  try { supTok = localStorage.getItem('rtg_sup_token'); } catch (e) {}
  if (!memTok && !supTok) return;
  if (!window.__rahulTabStandaard) {
    laadScript('/shared/rahul-tab.js?v=command7', null, true);
  }

  /* De muisvrije laag erbij (shared/handenvrij.js): de stuurbalk waar je in typt
     of tegen praat, met navigatie zonder tik. Hij hangt hier omdat de metgezel
     al op elke app-pagina staat en al weet dat er iemand is ingelogd; zo is het
     een script erbij in plaats van 150+ pagina's aanpassen. Lukt het laden niet,
     dan verandert er niets: alle knoppen blijven gewoon staan. */
  (function () {
    if (window.__handenvrij) return;
    laadScript('/shared/handenvrij.js', null, true);
  })();

  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
/* Samen-presentatie komt op iedere host uit de centrale DS-component. */
  var metgezelDs = true;
  document.documentElement.classList.add('ds-samen-host');
/* Bestaande DOM- en sleepbouwstenen; presentatie komt uit het DS. */
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

  /* ---------- Samen: meekijken en samen doen (alleen leden) ---------- */
  if (!memTok) return;
  // Heeft de pagina al haar eigen Samen-knop (bv. de RTF-pagina's met samen.js),
  // dan laten we die met rust en voegen we geen tweede toe. Rahul komt er wel bij.
  if (document.querySelector('script[src="samen.js"], script[src$="/samen.js"]')) return;
  var KAMERKEY = 'rtg_samen_kamer';
  var kamerId = null, deelCode = null;
  try { kamerId = localStorage.getItem(KAMERKEY); } catch (e) {}
  /* id.js staat parserblokkerend voor deze bundel. Toch ook hier fail-closed:
     als het bestand onderweg ontbreekt of door de browser is geweigerd, gaat
     er geen lege idempotentiesleutel naar een muterende Samen-route. */
  var veiligeIdem = function (voor) {
    if (typeof window.RTGIdem !== 'function') {
      throw new Error('Veilige browser-id ontbreekt; de Samen-actie is niet verstuurd.');
    }
    return window.RTGIdem(voor);
  };
  var api = function (p, b) {
    return fetch('/api/samen/' + p, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + memTok }, body: JSON.stringify(b || {}) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Er ging iets mis.'); return d; }); });
  };
  var sKnop = maakEl('<button class="mgz-knop mgz-samen' + (metgezelDs ? ' ds-samen-knop ds-samen-ingang' : '') + '" type="button" aria-label="Samen kijken en doen">Samen</button>');
  var sSheet = maakEl('<section class="mgz-sheet' + (metgezelDs ? ' ds-samen-venster' : '') + '" aria-label="Samen" hidden style="bottom:3.6rem;">' +
    '<div class="mgz-kop' + (metgezelDs ? ' ds-samen-kop' : '') + '"><span>Samen</span><button class="mgz-x' + (metgezelDs ? ' ds-samen-sluit' : '') + '" type="button" aria-label="Sluiten">✕</button></div>' +
    '<div class="mgz-vak "></div></section>');
  // De zwevende Samen-knop is overal weggehaald en verhuisd naar het
  // bedieningspaneel van het leden-OS; daar opent Instellingen hem via
  // window.RTGMetgezel.samen(). We houden alleen het Samen-venster (sSheet) in
  // de DOM; de knop zelf tonen we niet meer.
  document.body.appendChild(sSheet);
  maakSleepbaar(sSheet, 'rtg_samen_sheet_pos', sSheet.querySelector('.mgz-kop'));
  var vak = sSheet.querySelector('.mgz-vak');
  function toonSamen() { sSheet.hidden = false; sKnop.hidden = true; teken(); }
  sKnop.addEventListener('click', toonSamen);
  sSheet.querySelector('.mgz-x').addEventListener('click', function () { sSheet.hidden = true; sKnop.hidden = false; });
  window.RTGMetgezel = window.RTGMetgezel || {}; window.RTGMetgezel.samen = toonSamen;

  function zetKamer(id) {
    kamerId = id;
    try { id ? localStorage.setItem(KAMERKEY, id) : localStorage.removeItem(KAMERKEY); } catch (e) {}
  }
  function meldHier() {
    if (!kamerId) return;
    api('zet', { id: kamerId, pad: location.pathname, titel: document.title }).catch(function (e) {
      if (/bestaat niet|niet \(meer\)/.test(e.message)) zetKamer(null);
    });
  }
  function teken(chatOnder) {
    if (!kamerId) {
      vak.innerHTML = '<div class="mgz-uit' + (metgezelDs ? ' ds-samen-uitleg' : '') + '">Kijk en doe samen: start een sessie en deel de code, of doe mee met de code van een vriend. Wie ergens heen gaat, kan de rest met een tik laten meegaan.</div>' +
        '<button class="mgz-go' + (metgezelDs ? ' ds-samen-doe' : '') + '" data-start data-stand="samen-actief" type="button" style="width:100%;">Start een samen-sessie</button>' +
        '<form class="mgz-rij' + (metgezelDs ? ' ds-samen-rij' : '') + '" data-mee><input placeholder="Code van een vriend" maxlength="48" style="text-transform:uppercase;" aria-label="Samen-code"><button class="mgz-go' + (metgezelDs ? ' ds-samen-doe' : '') + '" type="submit">Doe mee</button></form>';
      vak.querySelector('[data-start]').addEventListener('click', function () {
        api('maak', { idem: veiligeIdem('samen-maak') })
          .then(function (d) { zetKamer(d.kamer.id); deelCode = d.code; meldHier(); teken(); })
          .catch(function (e) { alert(e.message); });
      });
      vak.querySelector('[data-mee]').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var c = ev.target.querySelector('input').value.trim().toUpperCase(); if (!c) return;
        api('mee', { code: c }).then(function (d) {
          zetKamer(d.kamer.id); deelCode = null; teken();
          if (d.kamer.pad && d.kamer.pad !== location.pathname) banner('De kamer is bij ' + (d.kamer.titel || 'een andere pagina'), d.kamer.pad);
        }).catch(function (e) { alert(e.message); });
      });
      return;
    }
    api('staat', { id: kamerId }).then(function (d) {
      var k = d.kamer;
      var toegang = deelCode
        ? 'Deelcode, alleen nu: <span class="mgz-code' + (metgezelDs ? ' ds-samen-code' : '') + '">' + esc(deelCode) + '</span>'
        : 'Samen-kamer actief. De deelcode wordt niet opnieuw getoond.';
      vak.innerHTML = '<div class="mgz-uit' + (metgezelDs ? ' ds-samen-uitleg' : '') + '">' + toegang + '<br>In de kamer: ' + k.leden.map(esc).join(', ') + '</div>' +
        '<div class="mgz-chat' + (metgezelDs ? ' ds-samen-chat' : '') + '" data-chat>' + k.chat.map(function (c) { return '<div><b>' + esc(c.van) + ':</b> ' + esc(c.tekst) + '</div>'; }).join('') + '</div>' +
        '<form class="mgz-rij' + (metgezelDs ? ' ds-samen-rij' : '') + '" data-zeg><input placeholder="Zeg iets tegen de kamer" maxlength="300" aria-label="Chatbericht"><button class="mgz-go' + (metgezelDs ? ' ds-samen-doe' : '') + '" type="submit" data-contextactie>→</button></form>' +
        '<div class="mgz-rij' + (metgezelDs ? ' ds-samen-rij' : '') + '"><button class="mgz-stil' + (metgezelDs ? ' ds-samen-secundair' : '') + '" data-hier type="button" style="flex:1;" data-contextactie>Kom hierheen</button>' +
        (k.benGastheer ? '<button class="mgz-stil' + (metgezelDs ? ' ds-samen-secundair' : '') + '" data-code type="button" data-contextactie>Nieuwe deelcode</button><button class="mgz-stil' + (metgezelDs ? ' ds-samen-secundair' : '') + '" data-sluit type="button" data-contextactie>Sluit</button>' : '') +
        '<button class="mgz-stil' + (metgezelDs ? ' ds-samen-secundair' : '') + '" data-weg type="button" data-contextactie>Verlaat</button></div>';
      var chatEl = vak.querySelector('[data-chat]'); chatEl.scrollTop = chatEl.scrollHeight;
      vak.querySelector('[data-zeg]').addEventListener('submit', function (ev) {
        ev.preventDefault(); var inp2 = ev.target.querySelector('input'); var t = inp2.value.trim(); if (!t) return; inp2.value = '';
        api('chat', { id: kamerId, tekst: t }).then(function () { teken(true); }).catch(function (e) { alert(e.message); });
      });
      vak.querySelector('[data-hier]').addEventListener('click', function () { meldHier(); });
      var vernieuw = vak.querySelector('[data-code]');
      if (vernieuw) vernieuw.addEventListener('click', function () {
        api('code', { id: kamerId, idem: veiligeIdem('samen-code') })
          .then(function (r) { deelCode = r.code; teken(); }).catch(function (e) { alert(e.message); });
      });
      var sluit = vak.querySelector('[data-sluit]');
      if (sluit) sluit.addEventListener('click', function () {
        api('sluit', { id: kamerId }).then(function () {
          deelCode = null; zetKamer(null); teken();
        }).catch(function (e) { alert(e.message); });
      });
      vak.querySelector('[data-weg]').addEventListener('click', function () {
        api('weg', { id: kamerId }).catch(function () {}); deelCode = null; zetKamer(null); teken();
      });
      if (chatOnder) chatEl.scrollTop = chatEl.scrollHeight;
    }).catch(function () { zetKamer(null); teken(); });
  }
/* Live Samen-meldingen en de waarschuwing bij een onbeveiligd app-adres. */
  var bannerEl = null;
  function banner(tekst, pad) {
    if (bannerEl) bannerEl.remove();
    bannerEl = maakEl('<div class="mgz-banner' + (metgezelDs ? ' ds-samen-banner' : '') + '"><span>' + esc(tekst) + '</span>' +
      (pad ? '<button class="mgz-go' + (metgezelDs ? ' ds-samen-doe' : '') + '" type="button">Ga mee →</button>' : '') +
      '<button class="mgz-x' + (metgezelDs ? ' ds-samen-sluit' : '') + '" type="button" aria-label="Sluiten">✕</button></div>');
    document.body.appendChild(bannerEl);
    if (pad) bannerEl.querySelector('.mgz-go').addEventListener('click', function () { location.assign(pad); });
    bannerEl.querySelector('.mgz-x').addEventListener('click', function () { bannerEl.remove(); bannerEl = null; });
    setTimeout(function () { if (bannerEl) { bannerEl.remove(); bannerEl = null; } }, 15000);
  }

  // live meeluisteren: een eigen, zuinige SSE-verbinding alleen voor 'samen'
  if (kamerId && window.EventSource) metStroom(function (S) {
    try {
      var bron = S.open('/api/stream', { token: memTok });
      bron.addEventListener('samen', function (e) {
        var d = {}; try { d = JSON.parse(e.data); } catch (x) {}
        if (d.id !== kamerId) return;
        if (d.kind === 'kijk' && d.pad && d.pad !== location.pathname) banner(esc(d.door) + ' is bij ' + (d.titel || 'een andere pagina'), d.pad);
        else if (d.kind === 'chat') { banner(d.van + ': ' + d.tekst, null); if (!sSheet.hidden) teken(true); }
        else if (d.kind === 'erbij') banner(d.codenaam + ' doet mee', null);
        else if (d.kind === 'weg') banner(d.codenaam + ' is weg', null);
      });
      window.addEventListener('beforeunload', function () { try { bron.close(); } catch (e) {} });
    } catch (e) {}
  });
  // bij het openen van een pagina: laat de kamer weten waar je bent
  if (kamerId) meldHier();

  /* Onbeveiligd adres: een keer per sessie eerlijk zeggen wat er dan NIET
     werkt. Buiten https (of localhost) bestaat mediaDevices niet en blokkeert
     de browser de locatie; zestien apps (camera, clips, bellen, scanner,
     paspoortscan, theater, ...) faalden elk met een eigen, vaak misleidende
     melding ("geef toegang") terwijl er niets toe te staan valt. De oorzaak
     is het adres, dus de melding hangt op de laag die op elke app-pagina
     staat, in plaats van in zestien schermen apart. */
  if (!window.isSecureContext) {
    var alGemeld = false;
    try { alGemeld = sessionStorage.getItem('rtg_http_melding') === '1'; } catch (e) {}
    if (!alGemeld) {
      try { sessionStorage.setItem('rtg_http_melding', '1'); } catch (e) {}
      banner('Dit adres is onbeveiligd (http): camera, microfoon en locatie blijven dan uit. Open de app via het beveiligde (https-)adres.', null);
    }
  }
})();
