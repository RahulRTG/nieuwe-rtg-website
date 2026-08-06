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
  /* De wauw-laag (shared/wauw.js) eerst: zachte overgangen, haptiek,
     delen, badge en wake lock. Voor de inlogcheck, zodat ook de poort
     hem heeft; net als handenvrij is het een script erbij in plaats
     van 120+ pagina's aanpassen, en zonder laag verandert er niets. */
  if (!window.RTGWauw) {
    var wauwS = document.createElement('script');
    wauwS.src = '/shared/wauw.js'; wauwS.defer = true;
    document.head.appendChild(wauwS);
  }
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

  /* DE BALK VAN RAHUL: een vorm, op elk scherm.

     Hiervoor waren er drie manieren om bij Rahul te komen en geen daarvan
     stond er gewoon: een zwevende pil die overal was weggehaald ("te druk in
     beeld"), een veeg vanaf de onderrand die je moest kennen, en op het
     beginscherm een chatbalk die alleen daar stond. Nu is er een balk, overal
     dezelfde, met de lippen als gezicht -- de vorm van het beginscherm, want
     die was de goede.

     Klein of groot bepaal je zelf: ingeklapt is hij alleen de lippen, en een
     tik maakt hem weer een balk. Die keuze blijft bewaard (localStorage), want
     hij hoort bij hoe JIJ werkt en niet bij de pagina waar je toevallig bent.
     Zo is Rahul overal, zonder in de weg te staan. */
  /* GEINTEGREERD, NIET ZWEVEND. Rahul stond hier als een venster over de
     pagina heen: je las iets, hij ging er half overheen, en je moest hem eerst
     wegklikken. Dat is precies wat het beginscherm en de inlogpoort NIET doen
     -- daar hoort hij bij het scherm.

     Daarom staat het blok onderaan vast, maar reserveert de pagina er ruimte
     voor: de hoogte van het blok gaat als --rtg-rahul-h naar de body, en die
     krijgt evenveel padding onderaan. Groeit het blok (er komt een antwoord),
     dan schuift de inhoud mee omhoog in plaats van eronder te verdwijnen. Zo
     staat hij nergens overheen, ook niet onderaan een lange pagina.

     Klap je hem klein, dan krimpt de gereserveerde ruimte mee: de lippen
     alleen kosten bijna niets. */
  var css = '.mgz-blok{position:fixed;left:50%;transform:translateX(-50%);z-index:9980;' +
      'bottom:calc(env(safe-area-inset-bottom,0px) + .9rem);width:min(30rem,calc(100vw - 1.6rem));' +
      'display:flex;flex-direction:column;align-items:center;gap:.5rem;pointer-events:none;}' +
    '.mgz-blok > *{pointer-events:auto;}' +
    /* het tussenstuk dat de pagina onderaan ruimte geeft; zie meetRuimte() */
    '.mgz-ruimte{width:100%;flex-shrink:0;pointer-events:none;}' +
    '.mgz-blok.mgz-klein-blok{width:auto;}' +
    '.mgz-balk{width:100%;' +
      'display:flex;align-items:center;gap:.55rem;padding:.4rem .45rem .4rem .55rem;border-radius:999px;' +
      'background:color-mix(in srgb, var(--card,#151312) 62%, transparent);' +
      'backdrop-filter:blur(26px) saturate(1.5);-webkit-backdrop-filter:blur(26px) saturate(1.5);' +
      'border:1px solid var(--line,#2A2724);box-shadow:0 12px 34px rgba(0,0,0,.42);' +
      'transition:width .22s cubic-bezier(.22,.61,.21,1),padding .22s cubic-bezier(.22,.61,.21,1);}' +
    '.mgz-balk:focus-within{border-color:color-mix(in srgb, var(--gold,#857007) 62%, var(--line,#2A2724));}' +
    /* ingeklapt: alleen de lippen, en de balk krimpt eromheen */
    '.mgz-balk.mgz-klein{width:auto;padding:.3rem;gap:0;}' +
    '.mgz-balk.mgz-klein input,.mgz-balk.mgz-klein .mgz-balkgo{display:none;}' +
    '.mgz-orb{width:2.4rem;height:2.4rem;flex-shrink:0;border-radius:50%;overflow:hidden;border:none;padding:0;' +
      'display:flex;align-items:center;justify-content:center;cursor:pointer;' +
      'background:radial-gradient(80% 80% at 50% 30%, #2A241A, #14110D);' +
      'box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--gold,#857007) 45%, transparent);}' +
    '.mgz-orb canvas{width:170%;height:auto;display:block;pointer-events:none;filter:brightness(1.3) saturate(1.08);}' +
    '.mgz-balk input{flex:1;min-width:0;background:none;border:none;outline:none;color:var(--txt,#F7F5F1);' +
      "font-family:Inter,system-ui,sans-serif;font-size:.86rem;padding:.4rem 0;}" +
    '.mgz-balk input::placeholder{color:var(--soft,#8A8680);}' +
    '.mgz-balkgo{flex-shrink:0;width:2.2rem;height:2.2rem;border-radius:50%;border:none;cursor:pointer;' +
      'background:var(--gold,#857007);color:#1C1608;display:flex;align-items:center;justify-content:center;font-weight:700;}' +
    '.mgz-balkgo:active{opacity:.85;}' +
    '@media print{.mgz-balk{display:none;}}' +
    '@media (prefers-reduced-motion: reduce){.mgz-balk{transition:none;}}' +
    '.mgz-knop{position:fixed;right:1rem;z-index:9980;border:none;border-radius:999px;padding:.65rem 1rem;font-family:Inter,system-ui,sans-serif;font-weight:600;font-size:.83rem;cursor:grab;touch-action:none;box-shadow:0 6px 20px rgba(0,0,0,.4);}' +
    '.mgz-knop.mgz-sleept{cursor:grabbing;opacity:.9;box-shadow:0 12px 34px rgba(0,0,0,.55);}' +
    '.mgz-rahul{bottom:1rem;background:var(--gold,#857007);color:#000;}' +
    '.mgz-samen{bottom:3.6rem;background:#151312;color:#eee;border:1px solid var(--gold,#857007);}' +
    /* het antwoord hoort bij de balk, niet ergens in de hoek: zelfde breedte,
       eronder vastgeplakt, en het scrollt intern als Rahul veel zegt */
    '.mgz-sheet{position:static;width:100%;max-height:min(42vh,22rem);overflow:auto;background:#151312;border:1px solid var(--gold,#857007);border-radius:16px;padding:.9rem;display:flex;flex-direction:column;gap:.6rem;box-shadow:0 10px 30px rgba(0,0,0,.5);color:#eee;font-family:Inter,system-ui,sans-serif;}' +
    '.mgz-sheet[hidden]{display:none;}.mgz-kop{display:flex;align-items:center;justify-content:space-between;font-weight:600;cursor:move;touch-action:none;user-select:none;-webkit-user-select:none;}' +
    '.mgz-sheet.mgz-sleept{opacity:.96;box-shadow:0 16px 44px rgba(0,0,0,.6);}' +
    '.mgz-x{background:transparent;border:1px solid #333;border-radius:8px;color:#eee;padding:.15rem .5rem;cursor:pointer;}' +
    '.mgz-uit{font-size:.84rem;color:#bbb;line-height:1.55;max-height:40vh;overflow-y:auto;white-space:pre-wrap;}' +
    '.mgz-rij{display:flex;gap:.4rem;}.mgz-rij input{flex:1;background:#0C0C0B;border:1px solid #333;border-radius:10px;color:#eee;font:inherit;font-size:.85rem;padding:.5rem .7rem;}' +
    '.mgz-go{background:var(--gold,#857007);color:#000;border:none;border-radius:10px;padding:.5rem .9rem;font-weight:700;cursor:pointer;}' +
    '.mgz-stil{background:transparent;color:#eee;border:1px solid #444;border-radius:10px;padding:.5rem .8rem;font:inherit;font-size:.83rem;cursor:pointer;}' +
    '.mgz-banner{position:fixed;left:50%;transform:translateX(-50%);bottom:6.4rem;z-index:9982;background:#0C0C0B;border:1px solid var(--gold,#857007);border-radius:12px;padding:.6rem .9rem;font-family:Inter,system-ui,sans-serif;font-size:.84rem;color:#eee;display:flex;gap:.6rem;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,.5);max-width:92vw;}' +
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

  var eigenRahul = /\/apps\/app\.html$/.test(location.pathname);
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

    /* HET BLOK VAN RAHUL: het antwoord boven, de balk eronder, en de ruimte
       die de pagina ervoor vrijhoudt. Apart deel omdat metgezel-01b.js anders
       over de 10 KB-lat komt (scripts/check.js regel 13) en omdat dit een eigen
       onderwerp is: waar Rahul STAAT, los van wat hij doet. */
    /* Een blok: het antwoord boven, de balk eronder. Ze horen bij elkaar en
       staan dus ook bij elkaar, op dezelfde breedte. */
    var blok = document.createElement('div');
    blok.className = 'mgz-blok';
    blok.appendChild(sheet);
    blok.appendChild(balk);
    document.body.appendChild(blok);

    /* De pagina reserveert de hoogte van het blok, zodat Rahul nergens overheen
       staat -- ook niet onderaan een lange lijst. Dat doen we met een leeg
       tussenstuk onderaan de body en NIET door body.paddingBottom te zetten:
       veel pagina's hebben daar hun eigen marge staan (de wallet 57,6 px) en
       die zouden we dan overschrijven. Een tussenstuk telt op bij wat er al
       is in plaats van het te vervangen.
       We meten het blok in plaats van een vaste hoogte te kiezen: hij groeit
       met een antwoord mee en krimpt als je hem klein klapt. */
    var ruimte = document.createElement('div');
    ruimte.className = 'mgz-ruimte';
    ruimte.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ruimte);
    function meetRuimte() {
      var h = blok.hidden ? 0 : blok.getBoundingClientRect().height;
      var px = h ? Math.round(h + 18) : 0;   // 18px lucht tussen inhoud en blok
      document.documentElement.style.setProperty('--rtg-rahul-h', px + 'px');
      ruimte.style.height = 'calc(' + px + 'px + env(safe-area-inset-bottom, 0px))';
    }
    // de bewaarde stand pas zetten nu het blok bestaat: zetMaat() raakt hem aan
    zetMaat(klein, false);
    if (window.ResizeObserver) { try { new ResizeObserver(meetRuimte).observe(blok); } catch (e) {} }
    window.addEventListener('resize', meetRuimte);
    meetRuimte();
    // de waarnemer meldt de allereerste opmaak niet altijd; daarom nog twee keer
    setTimeout(meetRuimte, 200); setTimeout(meetRuimte, 900);
    /* ---------- Rahul heeft een melding: de lippen verkleuren en bewegen ----------
       We halen zuinig de eigen seintjes op (kern/fluister). Zijn er nieuwe
       (t.o.v. wat de gebruiker al zag), dan gloeit de knop, komt er een teken
       met het aantal en bewegen de lippen af en toe. Tikt de gebruiker, dan
       ziet ze de melding boven de vraagbalk en kan ze meteen reageren. */
    var stip = null, laatsteSeintjes = [], meldTimer = null;
    var ZIEN = 'rtg_rahul_gezien';
    function gezienIds() { try { return JSON.parse(localStorage.getItem(ZIEN) || '[]'); } catch (e) { return []; } }
    function bewaarGezien(ids) { try { localStorage.setItem(ZIEN, JSON.stringify(ids.slice(0, 60))); } catch (e) {} }
    function idVan(s) { return (s && (s.id || s.tekst || (s.titel || '') + (s.bron || ''))) || ''; }
    function nieuweSeintjes() { var g = gezienIds(); return laatsteSeintjes.filter(function (s) { return g.indexOf(idVan(s)) === -1; }); }
    function toonMelding() {
      var nieuw = nieuweSeintjes();
      if (!nieuw.length) { doofMelding(); return; }
      fab.classList.add('mgz-meld');
      if (!stip) { stip = maakEl('<span class="mgz-stip"></span>'); fab.appendChild(stip); }
      stip.textContent = nieuw.length > 9 ? '9+' : String(nieuw.length);
      if (window.RTGWauw) RTGWauw.badge(nieuw.length); // ook op het app-icoon
      if (!meldTimer) meldTimer = setInterval(function () { if (!document.hidden && fab.classList.contains('mgz-meld')) mond.praat(700); }, 4200);
    }
    function doofMelding() {
      fab.classList.remove('mgz-meld');
      if (window.RTGWauw) RTGWauw.badge(0);
      if (stip) { stip.remove(); stip = null; }
      if (meldTimer) { clearInterval(meldTimer); meldTimer = null; }
      if (laatsteSeintjes.length) bewaarGezien(laatsteSeintjes.map(idVan));
      tekenSeintjes();
    }
    function tekenSeintjes() {
      if (!seintjesVak) return;
      if (!laatsteSeintjes.length) { seintjesVak.innerHTML = ''; return; }
      seintjesVak.innerHTML = laatsteSeintjes.slice(0, 5).map(function (s) {
        var t = typeof s === 'string' ? s : (s.tekst || s.titel || '');
        var kop = (s && s.titel && s.tekst) ? '<b>' + esc(s.titel) + '</b>' : '';
        return '<button class="mgz-seintje" type="button" data-vraag="' + esc(s && s.actie ? s.actie : t) + '">' + kop + esc(t) + '</button>';
      }).join('');
      [].forEach.call(seintjesVak.querySelectorAll('.mgz-seintje'), function (b) {
        b.addEventListener('click', function () { inp.value = b.getAttribute('data-vraag') || ''; inp.focus(); });
      });
    }
    function haalSeintjes() {
      if (!memTok || document.hidden) return;
      fetch('/api/fluister/profiel', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + memTok }, body: '{}' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (!d) return; laatsteSeintjes = (d.seintjes || []).filter(Boolean); tekenSeintjes(); if (sheet.hidden) toonMelding(); })
        .catch(function () {});
    }
    if (memTok) {
      haalSeintjes();
      setInterval(haalSeintjes, 60000);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) haalSeintjes(); });
    }
    form.addEventListener('submit', function (ev) {
      ev.preventDefault(); var q = inp.value.trim(); if (!q) return; inp.value = '';
      uit.textContent = 'Rahul denkt na...';
      /* Voor een zware taak stroomt de server live de voortgang ("Stap 4/24:
         taxi zoeken...") over de eigen SSE-verbinding. We openen die alleen
         zolang de vraag loopt en sluiten hem als het antwoord er is. */
      var vBron = null;
      if (memTok && window.EventSource) {
        try {
          vBron = new EventSource('/api/stream?token=' + encodeURIComponent(memTok));
          vBron.addEventListener('rahul-voortgang', function (e) {
            var v = {}; try { v = JSON.parse(e.data); } catch (x) {}
            if (v.klaar) return;
            if (v.totaal) { uit.textContent = 'Stap ' + v.stap + '/' + v.totaal + (v.bericht ? ': ' + v.bericht : '') + '...'; mond.praat(600); }
          });
        } catch (e) {}
      }
      var sluitBron = function () { if (vBron) { try { vBron.close(); } catch (e) {} vBron = null; } };
      fetch(pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ q: q }) })
        .then(function (r) { return r.json(); })
        .then(function (d) { sluitBron(); uit.textContent = (d && (d.antwoord || d.reply || d.error)) || 'Ik kwam er niet uit.'; mond.praat(1400); })
        .catch(function () { sluitBron(); uit.textContent = 'Even geen verbinding; probeer het zo weer.'; });
    });

    /* Lege-toestand-nudge: elke plek met data-rahul-leeg="opdracht" opent Rahul
       met die opdracht al ingevuld. Geen auto-verstuur -- de gebruiker leest mee
       en stuurt zelf, zodat de rust en de geld-drempel bij de gebruiker blijven.
       Via event-delegatie, dus het werkt ook op later bijgeladen schermen. */
    window.RTGRahul = window.RTGRahul || {};
    // het antwoordvenster openen; beide wegen lopen via dezelfde functie, zodat
    // de balk en het venster nooit tegelijk in beeld staan
    window.RTGRahul.open = function () { opengaan(null); };
    window.RTGRahul.vraag = function (tekst) { opengaan(tekst || ''); };
    if (!window.__rahulLeegBound) {
      window.__rahulLeegBound = true;
      document.addEventListener('click', function (ev) {
        var el = ev.target && ev.target.closest ? ev.target.closest('[data-rahul-leeg]') : null;
        if (!el || !window.RTGRahul || !window.RTGRahul.vraag) return;
        ev.preventDefault(); window.RTGRahul.vraag(el.getAttribute('data-rahul-leeg'));
      });
    }
  }

  /* ---------- Samen: meekijken en samen doen (alleen leden) ---------- */
  if (!memTok) return;
  // Heeft de pagina al haar eigen Samen-knop (bv. de RTF-pagina's met samen.js),
  // dan laten we die met rust en voegen we geen tweede toe. Rahul komt er wel bij.
  if (document.querySelector('script[src="samen.js"], script[src$="/samen.js"]')) return;
  var CODEKEY = 'rtg_samen_code';
  var kamerCode = null; try { kamerCode = localStorage.getItem(CODEKEY); } catch (e) {}
  var api = function (p, b) {
    return fetch('/api/samen/' + p, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + memTok }, body: JSON.stringify(b || {}) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Er ging iets mis.'); return d; }); });
  };
  var sKnop = maakEl('<button class="mgz-knop mgz-samen" type="button" aria-label="Samen kijken en doen">Samen</button>');
  var sSheet = maakEl('<section class="mgz-sheet" aria-label="Samen" hidden style="bottom:3.6rem;">' +
    '<div class="mgz-kop"><span>Samen</span><button class="mgz-x" type="button" aria-label="Sluiten">✕</button></div>' +
    '<div class="mgz-vak"></div></section>');
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

  function zetKamer(code) { kamerCode = code; try { code ? localStorage.setItem(CODEKEY, code) : localStorage.removeItem(CODEKEY); } catch (e) {} }
  function meldHier() {
    if (!kamerCode) return;
    api('zet', { code: kamerCode, pad: location.pathname + location.search, titel: document.title }).catch(function (e) {
      if (/bestaat niet|niet \(meer\)/.test(e.message)) zetKamer(null);
    });
  }
  function teken(chatOnder) {
    if (!kamerCode) {
      vak.innerHTML = '<div class="mgz-uit">Kijk en doe samen: start een sessie en deel de code, of doe mee met de code van een vriend. Wie ergens heen gaat, kan de rest met een tik laten meegaan.</div>' +
        '<button class="mgz-go" data-start type="button" style="width:100%;">Start een samen-sessie</button>' +
        '<form class="mgz-rij" data-mee><input placeholder="Code van een vriend" maxlength="8" style="text-transform:uppercase;" aria-label="Samen-code"><button class="mgz-go" type="submit">Doe mee</button></form>';
      vak.querySelector('[data-start]').addEventListener('click', function () {
        api('maak').then(function (d) { zetKamer(d.kamer.code); meldHier(); teken(); }).catch(function (e) { alert(e.message); });
      });
      vak.querySelector('[data-mee]').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var c = ev.target.querySelector('input').value.trim().toUpperCase(); if (!c) return;
        api('mee', { code: c }).then(function (d) {
          zetKamer(d.kamer.code); teken();
          if (d.kamer.pad && d.kamer.pad !== location.pathname + location.search) banner('De kamer is bij ' + (d.kamer.titel || 'een andere pagina'), d.kamer.pad);
        }).catch(function (e) { alert(e.message); });
      });
      return;
    }
    api('staat', { code: kamerCode }).then(function (d) {
      var k = d.kamer;
      vak.innerHTML = '<div class="mgz-uit">Samen-code: <span class="mgz-code">' + esc(k.code) + '</span><br>In de kamer: ' + k.leden.map(esc).join(', ') + '</div>' +
        '<div class="mgz-chat" data-chat>' + k.chat.map(function (c) { return '<div><b>' + esc(c.van) + ':</b> ' + esc(c.tekst) + '</div>'; }).join('') + '</div>' +
        '<form class="mgz-rij" data-zeg><input placeholder="Zeg iets tegen de kamer" maxlength="300" aria-label="Chatbericht"><button class="mgz-go" type="submit">→</button></form>' +
        '<div class="mgz-rij"><button class="mgz-stil" data-hier type="button" style="flex:1;">Kom hierheen</button><button class="mgz-stil" data-weg type="button">Verlaat</button></div>';
      var chatEl = vak.querySelector('[data-chat]'); chatEl.scrollTop = chatEl.scrollHeight;
      vak.querySelector('[data-zeg]').addEventListener('submit', function (ev) {
        ev.preventDefault(); var inp2 = ev.target.querySelector('input'); var t = inp2.value.trim(); if (!t) return; inp2.value = '';
        api('chat', { code: kamerCode, tekst: t }).then(function () { teken(true); }).catch(function (e) { alert(e.message); });
      });
      vak.querySelector('[data-hier]').addEventListener('click', function () { meldHier(); });
      vak.querySelector('[data-weg]').addEventListener('click', function () {
        api('weg', { code: kamerCode }).catch(function () {}); zetKamer(null); teken();
      });
      if (chatOnder) chatEl.scrollTop = chatEl.scrollHeight;
    }).catch(function () { zetKamer(null); teken(); });
  }

  var bannerEl = null;
  function banner(tekst, pad) {
    if (bannerEl) bannerEl.remove();
    bannerEl = maakEl('<div class="mgz-banner"><span>' + esc(tekst) + '</span>' +
      (pad ? '<button class="mgz-go" type="button">Ga mee →</button>' : '') +
      '<button class="mgz-x" type="button" aria-label="Sluiten">✕</button></div>');
    document.body.appendChild(bannerEl);
    if (pad) bannerEl.querySelector('.mgz-go').addEventListener('click', function () { location.href = pad; });
    bannerEl.querySelector('.mgz-x').addEventListener('click', function () { bannerEl.remove(); bannerEl = null; });
    setTimeout(function () { if (bannerEl) { bannerEl.remove(); bannerEl = null; } }, 15000);
  }

  // live meeluisteren: een eigen, zuinige SSE-verbinding alleen voor 'samen'
  if (kamerCode && window.EventSource) {
    try {
      var bron = new EventSource('/api/stream?token=' + encodeURIComponent(memTok));
      bron.addEventListener('samen', function (e) {
        var d = {}; try { d = JSON.parse(e.data); } catch (x) {}
        if (d.code !== kamerCode) return;
        if (d.kind === 'kijk' && d.pad && d.pad !== location.pathname + location.search) banner(esc(d.door) + ' is bij ' + (d.titel || 'een andere pagina'), d.pad);
        else if (d.kind === 'chat') { banner(d.van + ': ' + d.tekst, null); if (!sSheet.hidden) teken(true); }
        else if (d.kind === 'erbij') banner(d.codenaam + ' doet mee', null);
        else if (d.kind === 'weg') banner(d.codenaam + ' is weg', null);
      });
      window.addEventListener('beforeunload', function () { try { bron.close(); } catch (e) {} });
    } catch (e) {}
  }
  // bij het openen van een pagina: laat de kamer weten waar je bent
  if (kamerCode) meldHier();

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
