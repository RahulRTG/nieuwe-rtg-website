/* De vertaalkast van de browser: vertaalde interface die een NAVIGATIE overleeft.

   WAAROM DIT EEN EIGEN LAAG IS. De automatische vertaallaag hiernaast hield
   zijn vertalingen in een kale Map in zijn eigen scope, en die is bij elke
   paginawissel weg. Elk van de 313 schermen vroeg de server dus opnieuw de hele
   wereld -- ook de balk, het menu en de knoppen die op ieder scherm hetzelfde
   zeggen. Dat is de reden dat een vertaald huis traag aanvoelde: niet het
   vertalen, maar het opnieuw vertalen van wat we al wisten.

   EEN HUIS, EEN KAST. De sleutelweg (RTGi18n.laadWereldDict) bewaarde zijn
   woordenboek in een TWEEDE opslag, per pad en per aantal sleutels. Dezelfde
   knop op twee schermen werd daardoor twee keer vertaald en twee keer bewaard.
   Daarom staat de kast hier los en niet in een van de twee lagen: beide praten
   met dezelfde voorraad.

   BEGRENSD, want localStorage is klein en gedeeld met de rest van de app. Per
   taal een harde regel- en bytegrens; daarboven valt de oudst ingevoegde regel
   eruit (Map bewaart de invoegvolgorde). Loopt de opslag ondanks alles vol, dan
   snoeit de kast een keer en geeft daarna DIE taal op voor de rest van de
   sessie -- het geheugen blijft werken, alleen de volgende pagina begint weer
   koud. Een volle opslag mag nooit een leeg of half scherm opleveren.

   WAT ER NIET IN GAAT. Alleen interface. De aanroepers hier zijn de twee
   UI-lagen; wat een lid TYPT loopt langs /api/vertaal en komt hier nooit langs.
   Dezelfde grens als server/lib/ui-bronnen.js aan de serverkant trekt. */
(function (w) {
  'use strict';
  if (w.RTGVertaalKast) return;

  var SLEUTEL = 'rtg_tr_';
  var MAX_REGELS = 4000, MAX_BYTES = 300000;
  var kast = new Map();                 // taal -> Map(bron -> vertaling)
  var vuil = new Set(), opgegeven = new Set(), timer = null;

  function opslag() {
    try { return w.localStorage; } catch (e) { return null; }  // prive-modus gooit al bij het LEZEN
  }
  function van(taal) {
    var m = kast.get(taal);
    if (m) return m;
    m = new Map();
    kast.set(taal, m);
    var s = opslag();
    if (s && taal && taal !== 'nl') {
      try {
        var rauw = JSON.parse(s.getItem(SLEUTEL + taal) || 'null');
        if (rauw) for (var k in rauw) if (typeof rauw[k] === 'string' && rauw[k]) m.set(k, rauw[k]);
      } catch (e) { /* stukke of afgekapte JSON: een lege kast is geen fout */ }
      while (m.size > MAX_REGELS) m.delete(m.keys().next().value);
    }
    return m;
  }
  function zet(taal, bron, vertaling) {
    /* Een regel die gelijk is aan zijn bron is geen vertaling maar een
       mislukking die zich als antwoord voordoet. Hem bewaren zet een storing
       van vandaag vast als het antwoord van morgen -- dezelfde regel als in
       server/lib/vertaalkast.js, aan de andere kant van dezelfde weg. */
    if (!taal || taal === 'nl' || !bron || !vertaling || vertaling === bron) return false;
    var m = van(taal);
    m.delete(bron); m.set(bron, vertaling);
    while (m.size > MAX_REGELS) m.delete(m.keys().next().value);
    if (opgegeven.has(taal)) return true;
    vuil.add(taal);
    if (!timer) timer = setTimeout(bewaarNu, 400);
    return true;
  }
  /* De kasten van alle ANDERE talen van het toestel halen. Alleen aangeroepen
     wanneer de opslag vol zit; het geheugen blijft ongemoeid, dus de pagina die
     nu open staat verliest niets. */
  function andereTalenWeg(s, houd) {
    try {
      var weg = [];
      for (var i = 0; i < s.length; i++) {
        var k = s.key(i);
        if (k && k.indexOf(SLEUTEL) === 0 && k !== SLEUTEL + houd && k !== SLEUTEL + 'opgeruimd') weg.push(k);
      }
      weg.forEach(function (k) { s.removeItem(k); });
      return weg.length > 0;
    } catch (e) { return false; }
  }

  function bewaarNu() {
    timer = null;
    var s = opslag();
    if (!s) return;
    /* Een KOPIE, want de lus verwijdert eruit. En met Array.from en niet met
       slice.call: een Set heeft geen `length`, dus slice geeft daar een lege
       lijst -- de kast schreef dan nooit iets weg zonder een spoor achter te
       laten. Gevonden door test/i18n-auto.test.js, niet door lezen. */
    Array.from(vuil).forEach(function (taal) {
      vuil.delete(taal);
      if (opgegeven.has(taal)) return;
      var m = kast.get(taal);
      if (!m) return;
      /* Drie pogingen bij een volle opslag, in deze volgorde omdat dat de
         goedkoopste ruimte eerst opgeeft. Een mens leest in EEN taal, dus de
         kasten van talen waar hij doorheen klikte zijn dode ruimte -- die gaan
         voor. Pas daarna snijden we in de taal die hij NU leest. Lukt het dan
         nog niet, dan is de ruimte van iemand anders en niet van ons om op te
         eisen: deze taal wordt opgegeven, het geheugen blijft werken en de
         volgende pagina begint weer koud. */
      for (var poging = 0; poging < 3; poging++) {
        if (poging === 1) andereTalenWeg(s, taal);
        if (poging === 2) {
          var helft = Math.floor(m.size / 2);
          while (m.size > helft && m.size) m.delete(m.keys().next().value);
        }
        var uit = {}, bytes = 0, sleutels = [];
        m.forEach(function (v, k) { sleutels.push(k); });
        // van achteren naar voren, zodat het NIEUWSTE de bytegrens overleeft
        for (var i = sleutels.length - 1; i >= 0; i--) {
          var k = sleutels[i], v = m.get(k);
          bytes += k.length + v.length + 6;
          if (bytes > MAX_BYTES) break;
          uit[k] = v;
        }
        try { s.setItem(SLEUTEL + taal, JSON.stringify(uit)); return; }
        catch (e) { if (poging === 2) opgegeven.add(taal); }
      }
    });
  }

  /* De vorige opzet bewaarde per PAD (`rtg_ui_<taal>_<pad>_<n>`), dus stond
     dezelfde knop tientallen keren in de opslag van het toestel. Die ruimte is
     nu van de kast; hem laten staan zou de quota opeten van precies de laag die
     hem vervangt. Een keer opruimen, stil, en nooit meer. */
  (function () {
    var s = opslag();
    if (!s) return;
    try {
      if (s.getItem('rtg_tr_opgeruimd')) return;
      var oud = [];
      for (var i = 0; i < s.length; i++) {
        var k = s.key(i);
        if (k && k.indexOf('rtg_ui_') === 0) oud.push(k);
      }
      oud.forEach(function (k) { s.removeItem(k); });
      s.setItem('rtg_tr_opgeruimd', '1');
    } catch (e) {}
  })();

  /* Een navigatie mag de laatst binnengekomen vertalingen niet opeten: de
     wachtende schrijfronde gaat er bij het verlaten van de pagina alsnog uit.
     `pagehide` is de enige gebeurtenis die op iOS betrouwbaar valt. */
  try {
    w.addEventListener('pagehide', bewaarNu);
    w.addEventListener('visibilitychange', function () {
      if (w.document && w.document.visibilityState === 'hidden') bewaarNu();
    });
  } catch (e) {}

  w.RTGVertaalKast = {
    van: van, zet: zet, bewaarNu: bewaarNu,
    lees: function (taal, bron) { var v = van(taal).get(bron); return v == null ? null : v; },
    stand: function () {
      var perTaal = {};
      kast.forEach(function (m, taal) { perTaal[taal] = m.size; });
      return { opslag: !!opslag(), perTaal: perTaal, opgegeven: Array.from(opgegeven),
        maxRegels: MAX_REGELS, maxBytes: MAX_BYTES };
    }
  };
})(window);
/* DE MEEGELEVERDE TAALSCHIL -- vertaling zonder netwerk.

   WAT DIT OPLOST. De automatische laag hieronder schraapt tekst van het scherm
   en vraagt hem op bij /api/vertaal/ui. Dat werkt goed zolang er verbinding is;
   wie voor het EERST offline binnenkomt, kreeg Nederlands, ook als hij zijn
   taal allang had gekozen. De kast (i18n-00.js) hielp daar niet: die vult zich
   pas door eerder bezoek. Deze laag levert de tekst van de app-schil mee als
   bestand, gebouwd door scripts/taalschil.js en voorgecachet door sw.js.

   DE VOLGORDE IS KAST, DAN SCHIL, DAN NET, en die is niet willekeurig. De kast
   is VERSER (hij bevat wat deze bezoeker werkelijk zag, inclusief schermen
   buiten de schil) en staat daarom voorop. De schil is BREDER bij een koude
   start. Het net is de laatste, want dat is de enige stap die iets kost.

   WAT DEZE LAAG NIET DOET. Hij keurt niets. De keuring staat in
   server/kern/taalkeuring.js en heeft bij het BOUWEN al beslist wat er in het
   bestand mag; alleen `goed` haalt het. Hier nog eens keuren zou een tweede,
   zwakkere kopie van dat oordeel in de browser zetten -- precies de dubbeling
   waar LAT.md regel 4 tegen is.

   EEN ONTBREKENDE SCHIL IS GEEN STORING. Talen buiten de elf hebben geen
   bestand, en dat hoort: zij werken zoals altijd, via het net. Een mislukte
   ophaalpoging wordt daarom ONTHOUDEN en niet herhaald -- anders doet elke
   DOM-wijziging een nieuw verzoek dat toch niets oplevert. */
(function (w, d) {
  if (w.RTGTaalSchil) return;
  var MAP = '/shared/taalschil';
  var LEEG = new Map();
  var geladen = {};   // taal -> Map met de regels
  var bezig = {};     // taal -> lopende belofte
  var mislukt = {};   // taal -> we hebben het geprobeerd, het kwam er niet

  /* De schil staat op dezelfde plek als de andere gedeelde bestanden. Op de
     publieke verhaalpagina's ligt de webroot een paar mappen hoger; die dragen
     daarvoor `rtg-asset-base`, net als i18n-01.js. */
  function basis() {
    var m = d.querySelector && d.querySelector('meta[name="rtg-asset-base"]');
    return String((m && m.getAttribute('content')) || '').replace(/\/+$/, '');
  }

  /* Een taalcode komt uit een keuzelijst, maar hij komt ook uit localStorage en
     uit een URL. Alles wat geen kale code is, wordt hier een pad -- dus eerst
     de vorm afdwingen en pas dan een adres bouwen. */
  function veilig(taal) {
    return /^[a-z]{2,3}$/.test(String(taal || '')) ? String(taal) : null;
  }

  function alsMap(regels) {
    var m = new Map();
    if (!regels || typeof regels !== 'object') return m;
    /* Via Object.keys en een Map, zodat een sleutel als `__proto__` in het
       bestand nooit iets aan een object kan veranderen. */
    Object.keys(regels).forEach(function (k) {
      var v = regels[k];
      if (typeof v === 'string' && v) m.set(k, v);
    });
    return m;
  }

  function van(taal) {
    taal = veilig(taal);
    return (taal && geladen[taal]) || LEEG;
  }

  function laad(taal) {
    taal = veilig(taal);
    if (!taal) return Promise.resolve(LEEG);
    if (geladen[taal]) return Promise.resolve(geladen[taal]);
    if (mislukt[taal]) return Promise.resolve(LEEG);
    if (bezig[taal]) return bezig[taal];
    if (typeof fetch !== 'function') { mislukt[taal] = true; return Promise.resolve(LEEG); }
    bezig[taal] = fetch(basis() + MAP + '/' + taal + '.json', { credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('schil ' + r.status); return r.json(); })
      .then(function (j) {
        var m = alsMap(j && j.regels);
        geladen[taal] = m;
        delete bezig[taal];
        return m;
      })
      .catch(function () {
        mislukt[taal] = true;
        delete bezig[taal];
        return LEEG;
      });
    return bezig[taal];
  }

  /* Voor de meter en voor een mens die wil weten waar zijn tekst vandaan komt. */
  function stand() {
    var uit = {};
    Object.keys(geladen).forEach(function (t) { uit[t] = geladen[t].size; });
    return { geladen: uit, mislukt: Object.keys(mislukt) };
  }

  w.RTGTaalSchil = { van: van, laad: laad, stand: stand, MAP: MAP };
})(window, document);
/* De LEZER van de automatische UI-vertaling voor de volledige RTG-schermfamilie.
   (Het tonen, opvragen en wisselen staat in i18n-00c.js: een IIFE, twee helften.)

   De expliciete data-i18n-sleutels blijven de voorkeursroute: zij geven de
   redactie volledige controle. Deze laag vangt alles op wat nog geen sleutel
   heeft, inclusief tekst die een app later met JavaScript tekent. Hij bewaart
   altijd de oorspronkelijke DOM-waarde, vertaalt in groepen en zet bij een
   taalwissel zonder herladen de juiste bron opnieuw neer.

   Gebruikersinhoud, formulieren, code en expliciet uitgesloten delen gaan
   nooit naar de UI-vertaalroute. Zet `translate="no"`, `data-i18n-ignore` of
   `data-user-content` op een eigen component om dezelfde grens uit te spreken. */
(function (w) {
  'use strict';
  if (w.RTGAutoVertaling) return;

  var RTL = new Set(['ar', 'dv', 'fa', 'he', 'ps', 'sd', 'ug', 'ur', 'yi']);
  var ATTRS = ['placeholder', 'title', 'aria-label', 'aria-description', 'alt'];
  var NEGEER = 'script,style,noscript,template,code,pre,kbd,samp,svg,canvas,textarea,' +
    '[translate="no"],[data-i18n-ignore],[data-user-content],[contenteditable="true"],' +
    '[data-i18n],[data-i18n-html],.chat-bericht,.message-body,.bericht-tekst,.post-body,.review-text';
  var tekstMap = new WeakMap(), attribMap = new WeakMap();
  var tekstStaten = new Set(), attribStaten = new Set();
  var wortels = new Set();
  var taal = 'nl', beurt = 0, timer = null, waarnemer = null;
  var eersteRonde = true;
  var keten = Promise.resolve();
  /* De voorraad vertalingen staat in i18n-00.js, in dezelfde bundel. Ontbreekt
     hij toch, dan werkt deze laag door zonder voorraad -- traag zoals vroeger,
     maar geen enkel scherm valt om op een ontbrekende kast. */
  var KAST = w.RTGVertaalKast || { van: function () { return new Map(); },
    zet: function () { return false; }, stand: function () { return { opslag: false, perTaal: {} }; } };
  /* De meegeleverde schil (i18n-00a.js): wat er offline al klaarstaat. Zelfde
     terugval als de kast -- ontbreekt hij, dan werkt deze laag door via het net. */
  var SCHIL = w.RTGTaalSchil || { van: function () { return new Map(); },
    laad: function () { return Promise.resolve(new Map()); } };
  var oorspronkelijkeRichting = document.documentElement.getAttribute('dir');
  var apiMeta = document.querySelector && document.querySelector('meta[name="rtg-api-base"]');
  var apiBasis = String(apiMeta && apiMeta.getAttribute('content') || '').replace(/\/+$/, '');
  function apiPad(pad) { return apiBasis + pad; }

  function letters(s) { return /[A-Za-zÀ-ÖØ-öø-ÿ\u0100-\uFFFF]/.test(s); }
  function kandidaat(s) {
    s = String(s == null ? '' : s).trim();
    if (s.length < 2 || s.length > 300 || !letters(s)) return false;
    if (/^(?:https?:|mailto:|tel:|data:|blob:|\/[-\w./]+$)/i.test(s)) return false;
    if (/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(s)) return false;
    return true;
  }

  function uitgesloten(el, attribuut) {
    if (!el || el.nodeType !== 1) return true;
    try { if (el.closest(NEGEER)) return true; } catch (e) { return true; }
    if (attribuut === 'placeholder' && el.hasAttribute('data-i18n-ph')) return true;
    if (attribuut === 'title' && el.hasAttribute('data-i18n-title')) return true;
    if (attribuut === 'aria-label' && el.hasAttribute('data-i18n-aria')) return true;
    return false;
  }

  function delen(waarde) {
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(String(waarde || ''));
    return { voor: m[1], bron: m[2], na: m[3] };
  }
  function vernieuwTekst(st, waarde) {
    var d = delen(waarde);
    st.bronVol = waarde; st.bron = d.bron; st.voor = d.voor; st.na = d.na; st.weergave = null;
  }
  function tekstStaat(node) {
    var st = tekstMap.get(node), nu = node.nodeValue || '';
    if (!st) {
      st = { soort: 'tekst', node: node, bronVol: '', bron: '', voor: '', na: '', weergave: null };
      vernieuwTekst(st, nu); tekstMap.set(node, st); tekstStaten.add(st);
    } else if (nu !== st.bronVol && nu !== st.weergave) vernieuwTekst(st, nu);
    return st;
  }
  function attribStaat(el, naam) {
    var perEl = attribMap.get(el);
    if (!perEl) { perEl = {}; attribMap.set(el, perEl); }
    var nu = el.getAttribute(naam) || '', st = perEl[naam];
    if (!st) {
      st = { soort: 'attribuut', el: el, naam: naam, bron: nu, weergave: null };
      perEl[naam] = st; attribStaten.add(st);
    } else if (nu !== st.bron && nu !== st.weergave) { st.bron = nu; st.weergave = null; }
    return st;
  }

  function voeg(groepen, st) {
    if (!kandidaat(st.bron)) return;
    var uitKast = KAST.van(taal).get(st.bron);
    if (uitKast != null) return toon(st, uitKast);
    /* Kast, dan schil, dan net. De kast is verser (hij kent ook schermen buiten
       de schil), de schil is breder bij een koude start, het net kost geld. */
    var uitSchil = SCHIL.van(taal).get(st.bron);
    if (uitSchil != null) return toon(st, uitSchil);
    if (!groepen.has(st.bron)) groepen.set(st.bron, new Set());
    groepen.get(st.bron).add(st);
  }
  function verzamelTekst(root, groepen) {
    if (!root) return;
    var bekijk = function (node) {
      if (!node || node.nodeType !== 3 || uitgesloten(node.parentElement)) return;
      voeg(groepen, tekstStaat(node));
    };
    if (root.nodeType === 3) bekijk(root);
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) bekijk(node);
  }
  function verzamelAttributen(root, groepen) {
    if (!root || (root.nodeType !== 1 && root.nodeType !== 9)) return;
    var els = [];
    if (root.nodeType === 1) els.push(root);
    try { els = els.concat(Array.from(root.querySelectorAll('[' + ATTRS.join('],[') + ']'))); } catch (e) {}
    els.forEach(function (el) {
      ATTRS.forEach(function (naam) {
        if (el.hasAttribute(naam) && !uitgesloten(el, naam)) voeg(groepen, attribStaat(el, naam));
      });
      var type = String(el.getAttribute('type') || '').toLowerCase();
      if (el.tagName === 'INPUT' && /^(button|submit|reset)$/.test(type) && el.hasAttribute('value') && !uitgesloten(el, 'value'))
        voeg(groepen, attribStaat(el, 'value'));
    });
  }

  /* Hier houdt de LEZER op. Wat hij verzamelde -- welke tekstknopen en welke
     attributen vertaald mogen worden, en met welke oorspronkelijke waarde --
     wordt in i18n-00c.js getoond, hersteld en opgevraagd. Een IIFE, twee
     bestanden: de bundel plakt ze terug aaneen (scripts/bundel.js). */
/* De SCHRIJVER van de automatische vertaallaag: tonen, herstellen, groeperen,
   opvragen en de taalwissel. Dit is de tweede helft van de IIFE die in
   i18n-00b.js opent -- de lezer daar bepaalt WAT vertaald mag worden en waar
   het staat, deze helft doet er iets mee. Ze delen hun toestand, en de bundel
   plakt ze terug aaneen tot een bestand (scripts/bundel.js). */
  function toon(st, vertaling) {
    if (taal === 'nl' || !st || st.bron == null) return;
    vertaling = String(vertaling == null || vertaling === '' ? st.bron : vertaling);
    if (st.soort === 'tekst') {
      if (!st.node.isConnected) return;
      st.weergave = st.voor + vertaling + st.na;
      if (st.node.nodeValue !== st.weergave) st.node.nodeValue = st.weergave;
    } else {
      if (!st.el.isConnected) return;
      st.weergave = vertaling;
      if (st.el.getAttribute(st.naam) !== vertaling) st.el.setAttribute(st.naam, vertaling);
    }
  }

  function herstel() {
    tekstStaten.forEach(function (st) {
      if (!st.node.isConnected) return tekstStaten.delete(st);
      var nu = st.node.nodeValue || '';
      if (st.weergave != null && nu === st.weergave) st.node.nodeValue = st.bronVol;
      else if (nu !== st.bronVol) vernieuwTekst(st, nu);
      st.weergave = null;
    });
    attribStaten.forEach(function (st) {
      if (!st.el.isConnected) return attribStaten.delete(st);
      var nu = st.el.getAttribute(st.naam) || '';
      if (st.weergave != null && nu === st.weergave) st.el.setAttribute(st.naam, st.bron);
      else if (nu !== st.bron) st.bron = nu;
      st.weergave = null;
    });
  }

  function groepenVan(bronnen, groepen) {
    var uit = [], nu = [], tekens = 0;
    bronnen.forEach(function (bron) {
      if (nu.length && (nu.length >= 300 || tekens + bron.length > 18000)) {
        uit.push(nu); nu = []; tekens = 0;
      }
      nu.push(bron); tekens += bron.length;
    });
    if (nu.length) uit.push(nu);
    return uit.map(function (regels) { return { regels: regels, doelen: regels.map(function (r) { return groepen.get(r); }) }; });
  }

  function vraag(groep, gekozenTaal, gekozenBeurt) {
    var koppen = { 'Content-Type': 'application/json' };
    return fetch(apiPad('/api/vertaal/ui'), { method: 'POST', headers: koppen,
      body: JSON.stringify({ naar: gekozenTaal, bron: location.pathname, teksten: groep.regels }) })
      .then(function (r) { if (!r.ok) throw new Error('ui-vertaling ' + r.status); return r.json(); })
      .then(function (d) {
        if (!d || d.naar !== gekozenTaal || !Array.isArray(d.teksten)) return;
        groep.regels.forEach(function (bron, i) {
          var vertaling = d.teksten[i] || bron;
          if (vertaling !== bron) KAST.zet(gekozenTaal, bron, vertaling);
          if (taal === gekozenTaal && beurt === gekozenBeurt)
            groep.doelen[i].forEach(function (st) { if (st.bron === bron) toon(st, vertaling); });
        });
      });
  }

  function voerUit() {
    timer = null;
    eersteRonde = false;
    if (taal === 'nl') return;
    var groepen = new Map(), lijst = Array.from(wortels); wortels.clear();
    if (!lijst.length) lijst = [document.documentElement];
    lijst.forEach(function (root) { verzamelTekst(root, groepen); verzamelAttributen(root, groepen); });
    if (!groepen.size) return;
    var gekozenTaal = taal, gekozenBeurt = beurt;
    groepenVan(Array.from(groepen.keys()), groepen).forEach(function (groep) {
      keten = keten.then(function () { return vraag(groep, gekozenTaal, gekozenBeurt); })
        .catch(function () { /* de brontekst blijft heel; een volgende DOM-wijziging probeert opnieuw */ });
    });
  }
  /* De 80 ms bundelt een uitbarsting van DOM-wijzigingen tot EEN aanvraag. Bij
     een warme kast is er geen aanvraag, en is die wachttijd alleen nog zichtbaar
     Nederlands op een scherm dat we al kunnen vertalen: de EERSTE ronde loopt
     daarom kort zodra de kast van deze taal gevuld is. */
  function plan(root) {
    if (root) wortels.add(root.nodeType === 3 ? root.parentElement : root);
    if (timer || taal === 'nl') return;
    var warm = eersteRonde && KAST.van(taal).size > 0;
    timer = setTimeout(voerUit, warm ? 0 : 80);
  }

  function observeer() {
    if (waarnemer || !document.documentElement) return;
    try {
      waarnemer = new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          if (m.type === 'characterData') plan(m.target);
          else if (m.type === 'attributes') plan(m.target);
          else Array.from(m.addedNodes || []).forEach(plan);
        });
      });
      waarnemer.observe(document.documentElement, { childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ATTRS.concat(['value']) });
    } catch (e) {}
  }

  function pasToe(nieuweTaal) {
    taal = /^[a-z]{2}$/.test(String(nieuweTaal || '')) ? nieuweTaal : 'nl';
    beurt++;
    if (RTL.has(taal)) document.documentElement.setAttribute('dir', 'rtl');
    else if (taal === 'nl' && oorspronkelijkeRichting == null) document.documentElement.removeAttribute('dir');
    else document.documentElement.setAttribute('dir', oorspronkelijkeRichting || 'ltr');
    document.documentElement.setAttribute('data-rtg-taal', taal);
    if (taal !== 'nl') {
      KAST.van(taal);   // de kast van deze taal alvast van het toestel halen
      /* En de meegeleverde schil erbij. Die komt van schijf of uit de
         service-worker-cache, dus ook zonder verbinding. Hij landt ASYNCHROON,
         dus na aankomst nog een ronde: anders staat de eerste render er nog in
         het Nederlands terwijl de vertaling al binnen is. `beurt` bewaakt dat
         een late schil van een vorige taal niets meer aanraakt. */
      (function (gekozenTaal, gekozenBeurt) {
        SCHIL.laad(gekozenTaal).then(function (m) {
          if (m && m.size && taal === gekozenTaal && beurt === gekozenBeurt) plan(document.documentElement);
        });
      })(taal, beurt);
    }
    eersteRonde = true;
    observeer();
    if (taal === 'nl') { if (timer) { clearTimeout(timer); timer = null; } wortels.clear(); herstel(); }
    else plan(document.documentElement);
  }

  /* De kast staat er ook naar buiten toe bij, want de sleutelweg in i18n-03.js
     praat met dezelfde voorraad. Twee lagen die hetzelfde woord twee keer laten
     vertalen was precies de dubbeling die deze ronde wegneemt. */
  w.RTGAutoVertaling = {
    apply: pasToe, scan: plan, kandidaat: kandidaat, rtl: RTL, kast: KAST,
    stand: function () { var s = KAST.stand(); s.taal = taal; return s; }
  };
})(window);
/* ============================================================================
   RTG i18n, taalkeuze + automatische detectie voor de website en alle apps.

   Werking:
   - Nederlands is de basistaal: de tekst staat gewoon in de HTML.
   - Andere talen komen uit een woordenboek dat elke pagina zelf meegeeft via
     window.I18N = { en: { 'sleutel': 'vertaling', ... }, ... }.
   - Elementen krijgen data-i18n="sleutel" (tekst), data-i18n-html="sleutel"
     (met opmaak) of data-i18n-ph="sleutel" (placeholder).
   - Bij het eerste bezoek verschijnt een taalkeuze; de taal van het toestel
     (navigator.language) staat voorgeselecteerd. De keuze wordt onthouden.
   - JS-gerenderde schermen kunnen luisteren naar het 'rtglang'-event en
     RTGi18n.t('sleutel', 'standaard') gebruiken.
   ========================================================================== */
(function () {
  if (window.__rtgI18nActief) return;
  window.__rtgI18nActief = true;
  const STORE = 'rtg_lang';
  const apiMeta = document.querySelector('meta[name="rtg-api-base"]');
  const assetMeta = document.querySelector('meta[name="rtg-asset-base"]');
  /* Waar de API woont. Normaal op dezelfde oorsprong -- dat klopt op de
     RTG-server, op localhost en bij een eigen installatie. Maar de publieke
     verhaalpagina's (public/site/) worden OOK van een statische voordeur
     geserveerd, en daar ligt geen API: dan wijzen we naar de app. Een vaste
     meta in die pagina's kan niet, want dan zou een eigen installatie zijn
     vertalingen bij ons ophalen. De lijst staat in server/lib/voordeuren.js;
     test/i18n-auto.test.js zakt zodra deze twee uit elkaar lopen. */
  const STATISCHE_VOORDEUREN = ['https://rahulrtg.github.io', 'https://rahultravelgroup.com', 'https://www.rahultravelgroup.com'];
  const APP_OORSPRONG = 'https://app.rahultravelgroup.com';
  const API_BASIS = String(
    (apiMeta && apiMeta.getAttribute('content')) ||
    (STATISCHE_VOORDEUREN.indexOf(location.origin) >= 0 ? APP_OORSPRONG : '') || ''
  ).replace(/\/+$/, '');
  const ASSET_BASIS = String(assetMeta && assetMeta.getAttribute('content') || '').replace(/\/+$/, '');
  const apiPad = pad => API_BASIS + pad;
  const assetPad = pad => ASSET_BASIS + pad;
  const LANGS = {
    nl: { label: 'Nederlands', native: 'Nederlands' },
    en: { label: 'Engels', native: 'English' }
  };
  /* Wereldtalen: de Boardroom bepaalt welke talen aanstaan; de kiezer toont ze
     allemaal. UI-teksten vallen voor andere talen terug op Engels; chats en
     berichten worden door de server echt per taal vertaald. */
  let WERELD = null; // [{code, naam, en}] uit /api/talen
  function supported() { return WERELD ? WERELD.map(t => t.code) : Object.keys(LANGS); }
  const orig = new WeakMap(); // element -> { text, html, ph }

  /* ---------- vlaggen: elke taal krijgt een representatief land ----------
     De 114 talen tonen we als landvlaggen. Een taal is geen land, dus we kiezen
     per taal het land waar hij het meest thuis is; puur als beeld, geen politiek
     statement. Uit de ISO-landcode bouwen we het vlag-emoji (regionale-indicator
     -tekens), dus we bewaren nergens plaatjes. */
  const LAND = {
    nl: 'NL', en: 'GB', de: 'DE', fr: 'FR', es: 'ES', pt: 'PT', it: 'IT', ca: 'ES', gl: 'ES', eu: 'ES',
    ro: 'RO', el: 'GR', tr: 'TR', ru: 'RU', uk: 'UA', be: 'BY', pl: 'PL', cs: 'CZ', sk: 'SK', hu: 'HU',
    bg: 'BG', sr: 'RS', hr: 'HR', bs: 'BA', sl: 'SI', mk: 'MK', sq: 'AL', lt: 'LT', lv: 'LV', et: 'EE',
    fi: 'FI', sv: 'SE', no: 'NO', da: 'DK', is: 'IS', ga: 'IE', cy: 'GB', mt: 'MT', lb: 'LU', fy: 'NL',
    yi: 'IL', ar: 'SA', he: 'IL', fa: 'IR', ku: 'IQ', az: 'AZ', hy: 'AM', ka: 'GE', kk: 'KZ', uz: 'UZ',
    ky: 'KG', tg: 'TJ', tk: 'TM', mn: 'MN', tt: 'RU', hi: 'IN', ur: 'PK', bn: 'BD', pa: 'IN', gu: 'IN',
    mr: 'IN', ta: 'IN', te: 'IN', kn: 'IN', ml: 'IN', si: 'LK', ne: 'NP', ps: 'AF', sd: 'PK', or: 'IN',
    as: 'IN', dv: 'MV', bo: 'CN', zh: 'CN', ja: 'JP', ko: 'KR', th: 'TH', vi: 'VN', id: 'ID', jv: 'ID',
    su: 'ID', ms: 'MY', tl: 'PH', km: 'KH', lo: 'LA', my: 'MM', ug: 'CN', sw: 'KE', am: 'ET', ti: 'ER',
    om: 'ET', so: 'SO', ha: 'NG', yo: 'NG', ig: 'NG', zu: 'ZA', xh: 'ZA', af: 'ZA', st: 'ZA', sn: 'ZW',
    rw: 'RW', mg: 'MG', wo: 'SN', ln: 'CD', ny: 'MW', lg: 'UG', ht: 'HT', qu: 'PE', gn: 'PY', ay: 'BO',
    mi: 'NZ', sm: 'WS', to: 'TO', fj: 'FJ'
  };
  // Geen vlag-emoji's: elke taal draagt haar eigen ISO-code in een ingetogen,
  // goud-omlijnd plaatje - rustiger en volwassener dan een rij vlaggetjes.
  function vlag(code) {
    return '<span class="rtg-lang-code">' + String(code || '').toUpperCase() + '</span>';
  }
  // kleine, in huisstijl getekende tekens (geen emoji), currentColor volgend
  const ICOON = {
    mic: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0"/><path d="M12 17v3.5"/></svg>',
    spark: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M12 2c.5 4.6 2.4 6.5 7 7-4.6.5-6.5 2.4-7 7-.5-4.6-2.4-6.5-7-7 4.6-.5 6.5-2.4 7-7z"/></svg>',
    globe: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/></svg>'
  };
  // veelgebruikte land-/taalnamen die Rahul moet herkennen (genormaliseerd:
  // kleine letters, accenten eraf). De rest matcht op de eigen naam + Engelse naam.
  const ALIAS = {
    nederland: 'nl', holland: 'nl', netherlands: 'nl', vlaanderen: 'nl', belgie: 'nl', belgium: 'nl', suriname: 'nl',
    engeland: 'en', england: 'en', britain: 'en', uk: 'en', amerika: 'en', america: 'en', usa: 'en', australie: 'en', australia: 'en', canada: 'en', ierland: 'en', ireland: 'en',
    duitsland: 'de', germany: 'de', deutschland: 'de', oostenrijk: 'de', austria: 'de', zwitserland: 'de', switzerland: 'de',
    frankrijk: 'fr', france: 'fr',
    spanje: 'es', spain: 'es', espana: 'es', mexico: 'es', argentinie: 'es', argentina: 'es', colombia: 'es', chili: 'es', peru: 'es',
    portugal: 'pt', brazilie: 'pt', brazil: 'pt', brasil: 'pt',
    italie: 'it', italy: 'it', italia: 'it',
    griekenland: 'el', greece: 'el',
    turkije: 'tr', turkey: 'tr', turkiye: 'tr',
    rusland: 'ru', russia: 'ru', oekraine: 'uk', ukraine: 'uk', polen: 'pl', poland: 'pl',
    japan: 'ja', nippon: 'ja', china: 'zh', chinees: 'zh', chinese: 'zh', mandarijn: 'zh', mandarin: 'zh', taiwan: 'zh',
    korea: 'ko', india: 'hi', bharat: 'hi', pakistan: 'ur',
    marokko: 'ar', morocco: 'ar', egypte: 'ar', egypt: 'ar', dubai: 'ar', arabisch: 'ar', arabic: 'ar', saoedi: 'ar',
    iran: 'fa', perzie: 'fa', persia: 'fa', israel: 'he', hebreeuws: 'he', hebrew: 'he',
    indonesie: 'id', indonesia: 'id', bali: 'id', thailand: 'th', vietnam: 'vi', filipijnen: 'tl', philippines: 'tl', maleisie: 'ms', malaysia: 'ms',
    zweden: 'sv', sweden: 'sv', noorwegen: 'no', norway: 'no', denemarken: 'da', denmark: 'da', finland: 'fi', ijsland: 'is', iceland: 'is',
    zuidafrika: 'af', kenia: 'sw', kenya: 'sw', tanzania: 'sw', ethiopie: 'am', ethiopia: 'am', nigeria: 'yo'
  };

  function detectDevice() {
    const list = (navigator.languages && navigator.languages.length)
      ? navigator.languages : [navigator.language || 'nl'];
    for (const raw of list) {
      const code = String(raw || '').toLowerCase().slice(0, 2);
      if (supported().includes(code)) return code;
    }
    return 'en'; // geen match: standaard Engels
  }

  const RTGi18n = {
    lang: 'nl',
    chosen: false,
    // UI-woordenboek: eigen taal als die er is, anders Engels (internationale
    // terugval); Nederlands staat gewoon in de HTML zelf.
    dict(lang) {
      const all = window.I18N || {};
      return all[lang] || (lang !== 'nl' ? all.en : null) || {};
    },
    t(key, fallback) {
      if (this.lang === 'nl') return fallback != null ? fallback : key;
      const v = this.dict(this.lang)[key];
      return v != null ? v : (fallback != null ? fallback : key);
    },

    apply(lang) {
      lang = /^[a-z]{2}$/.test(String(lang || '')) ? lang : 'nl';
      this.lang = lang;
      document.documentElement.setAttribute('lang', lang);
      if (lang !== 'nl' && lang !== 'en') this.laadWereldDict(lang);
      const d = this.dict(lang);

      document.querySelectorAll('[data-i18n]').forEach(el => {
        if (!orig.has(el)) orig.set(el, {});
        const o = orig.get(el);
        if (o.text == null) o.text = el.textContent;
        const val = d[el.getAttribute('data-i18n')];
        el.textContent = (val != null && lang !== 'nl') ? val : o.text;
      });

      document.querySelectorAll('[data-i18n-html]').forEach(el => {
        if (!orig.has(el)) orig.set(el, {});
        const o = orig.get(el);
        if (o.html == null) o.html = el.innerHTML;
        const val = d[el.getAttribute('data-i18n-html')];
        el.innerHTML = (val != null && lang !== 'nl') ? val : o.html;
      });

      document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        if (!orig.has(el)) orig.set(el, {});
        const o = orig.get(el);
        if (o.ph == null) o.ph = el.getAttribute('placeholder') || '';
        const val = d[el.getAttribute('data-i18n-ph')];
        el.setAttribute('placeholder', (val != null && lang !== 'nl') ? val : o.ph);
      });

      // Ook tekst zonder handmatig woordenboeksleuteltje en later door JS
      // getekende interface gaat via de centrale, gebatchte vangnetlaag.
      // Activeer dat vangnet pas na een opgeslagen of expliciete taalkeuze:
      // de voorgeselecteerde toestel-taal mag een Nederlandstalig scherm niet
      // al op de achtergrond half vertalen voordat de bezoeker kiest.
      if (window.RTGAutoVertaling) window.RTGAutoVertaling.apply(this.chosen ? lang : 'nl');

      this.updateSwitch();
      window.dispatchEvent(new CustomEvent('rtglang', { detail: { lang } }));
    },

    set(lang, remember) {
      if (remember !== false) { try { localStorage.setItem(STORE, lang); } catch (e) {} this.chosen = true; }
      this.apply(lang);
    },

    /* Wereldtaal-woordenboeken: voor elke taal buiten nl/en halen we het
       UI-woordenboek van DEZE pagina live vertaald op (/api/vertaal/ui). Zo
       draait elke pagina volledig in elke actieve wereldtaal; zonder AI-sleutel
       valt de server terug op het woordenboek en blijft de Engelse tekst staan
       waar hij het niet weet (nooit een kapot scherm).

       DIT WAS EEN TWEEDE OPSLAG, EN DAT KOSTTE TWEE KEER. De cachesleutel
       droeg het PAD van de pagina, dus "Opslaan" op scherm A en "Opslaan" op
       scherm B waren twee vertalingen: twee keer een modelaanroep, twee keer
       bewaard, en op de tweede pagina toch weer wachten. Het gaat nu langs
       dezelfde kast als de automatische laag (i18n-00.js), en die kent geen
       paden -- alleen taal en bron. Wat er al ligt kost daarmee GEEN aanvraag,
       ook niet de eerste keer dat dit scherm wordt geopend.

       EN HIJ VRAAGT ALLEEN WAT HIJ MIST. Van vierhonderd sleutels zijn er op de
       tweede pagina meestal een handvol nieuw; de rest komt uit de kast. */
    _wereldDict: {},
    laadWereldDict(lang) {
      if (lang === 'nl' || lang === 'en' || this._wereldDict[lang]) return;
      const all = window.I18N || {};
      if (all[lang]) return; // de pagina bracht dit woordenboek zelf mee
      const en = all.en || {};
      const keys = Object.keys(en).slice(0, 400);
      if (!keys.length) return;
      this._wereldDict[lang] = true;
      const kast = window.RTGVertaalKast;
      const zet = (d) => {
        window.I18N = window.I18N || {};
        window.I18N[lang] = d;
        if (this.lang === lang) this.apply(lang); // opnieuw toepassen zodra hij er is
      };
      const uit = {};
      const missend = [];
      keys.forEach(k => {
        const bron = en[k];
        const bekend = kast ? kast.lees(lang, bron) : null;
        if (bekend != null) uit[k] = bekend; else missend.push(k);
      });
      if (!missend.length) return zet(uit);          // volledig uit het toestel: geen netwerk
      if (Object.keys(uit).length) zet(uit);          // toon vast wat we al weten
      fetch(apiPad('/api/vertaal/ui'), { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ naar: lang, teksten: missend.map(k => en[k]) }) })
        .then(r => r.json())
        .then(d => {
          if (!d || d.naar !== lang || !Array.isArray(d.teksten)) return;
          missend.forEach((k, i) => {
            const v = d.teksten[i] || en[k];
            uit[k] = v;
            if (kast) kast.zet(lang, en[k], v);       // de kast weigert v === bron zelf
          });
          zet(uit);
        })
        .catch(() => { this._wereldDict[lang] = false; });
    },

    /* ---------- taalkeuze: de wereld in RTG-stijl ----------
       Rahuls signatuurlippen in het midden, alle landvlaggen eromheen, en een
       AI-zoekje: zeg waar je vandaan komt of welke taal je spreekt, en Rahul
       kiest mee. Dezelfde donkere, ingetogen huisstijl als de app-poort. */
    zoekTaal(q) {
      const lijst = this._lijst || [];
      const n = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      const qq = n(q);
      if (!qq) return { code: null, set: new Set(lijst.map(t => t.code)) };
      const set = new Set(); let best = null, bestScore = 0;
      const weeg = (code, sc) => { set.add(code); if (sc > bestScore) { bestScore = sc; best = code; } };
      for (const t of lijst) {
        const naam = n(t.naam), en = n(t.en || ''), code = t.code, iso = (LAND[code] || '').toLowerCase();
        let sc = 0;
        if (code === qq) sc = 100;
        else if (naam === qq || en === qq) sc = 92;
        else if (naam.startsWith(qq)) sc = 82;
        else if (en.startsWith(qq)) sc = 74;
        else if (naam.includes(qq)) sc = 60;
        else if (en.includes(qq)) sc = 52;
        else if (iso === qq) sc = 40;
        if (sc > 0) weeg(code, sc);
      }
      // land-/bijnamen: "holland", "japan", "brazilie" -> de juiste taal
      for (const k in ALIAS) {
        if (k === qq || k.includes(qq) || qq.includes(k)) {
          const c = ALIAS[k];
          if (lijst.some(t => t.code === c)) weeg(c, k === qq ? 96 : 66);
        }
      }
      return { code: best, set };
    },
    buildModal(recommended) {
      const oud = document.getElementById('rtg-lang-modal');
      const stondOpen = oud && oud.classList.contains('open');
      if (oud) oud.remove(); // opnieuw opbouwen zodra de wereldtalen binnen zijn
      this._mond = null; // het oude canvas is weg
      const scrim = document.createElement('div');
      scrim.id = 'rtg-lang-modal';
      scrim.className = 'rtg-lang-scrim';
      scrim.setAttribute('data-i18n-ignore', '');
      // de matcher kent de HELE wereld (alle 114) als die binnen is; anders de
      // actieve set. Er staan geen vlagknoppen meer: je kiest door te typen of
      // te spreken, Rahul herkent je land of taal en stelt hem voor.
      this._lijst = this._alleTalen || WERELD || Object.keys(LANGS).map(c => ({ code: c, naam: LANGS[c].native, en: LANGS[c].label }));
      this._aanbevolen = recommended || 'en';
      const kanSpreken = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
      scrim.innerHTML =
        '<div class="rtg-lang-card" role="dialog" aria-modal="true" aria-label="Choose your language / Kies je taal">' +
          '<canvas class="rtg-lang-mond" id="rtg-lang-mond" width="440" height="200" aria-hidden="true"></canvas>' +
          '<h2>Where in the world are you?</h2>' +
          '<p>Type or say your language &middot; Rahul switches for you</p>' +
          '<div class="rtg-lang-ai">' +
            (kanSpreken ? '<button type="button" id="rtg-lang-mic" aria-label="Speak your language / Spreek je taal">' + ICOON.mic + '</button>' : '') +
            '<input id="rtg-lang-zoek" autocomplete="off" enterkeyhint="go" ' +
              'aria-label="Type your country or language / Typ je land of taal" ' +
              'placeholder="Say or type where you&rsquo;re from&hellip;">' +
            '<button type="button" id="rtg-lang-rahul" aria-label="Let Rahul choose / Laat Rahul kiezen">' + ICOON.spark + '</button>' +
          '</div>' +
          '<button type="button" class="rtg-lang-hint" id="rtg-lang-hint" hidden></button>' +
        '</div>';
      document.body.appendChild(scrim);

      const zoek = scrim.querySelector('#rtg-lang-zoek');
      const hint = scrim.querySelector('#rtg-lang-hint');
      const self = this;
      // toon Rahuls voorstel (geen knoppenlijst): een vlag + de naam, aantikbaar
      const stelVoor = () => {
        const res = self.zoekTaal(zoek.value.trim());
        if (!zoek.value.trim() || !res.code) {
          hint.hidden = true; hint.removeAttribute('data-lang');
          if (zoek.value.trim()) { hint.hidden = false; hint.removeAttribute('data-lang'); hint.innerHTML = '<span class="rtg-lang-mis">Hmm, not sure yet &mdash; try a country or language.</span>'; }
          return;
        }
        const t = self._lijst.find(x => x.code === res.code) || {};
        hint.hidden = false;
        hint.setAttribute('data-lang', res.code);
        hint.innerHTML = vlag(res.code) +
          '<span class="rtg-lang-sug"><b>' + String(t.naam || res.code).replace(/[<>]/g, '') + '</b>' +
          '<span class="rtg-lang-go">tap to continue &middot; tik om verder te gaan</span></span>';
      };
      const kies = (code) => {
        code = code || self.zoekTaal(zoek.value.trim()).code || self._aanbevolen;
        if (code) { self.set(code); self.closeModal(); }
      };
      zoek.addEventListener('input', stelVoor);
      zoek.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); kies(); } });
      scrim.querySelector('#rtg-lang-rahul').addEventListener('click', () => kies());
      hint.addEventListener('click', () => kies(hint.getAttribute('data-lang')));
      // spreken: de eigen stem invullen en meteen laten herkennen
      const mic = scrim.querySelector('#rtg-lang-mic');
      if (mic) mic.addEventListener('click', () => self._luister(zoek, stelVoor, kies, mic));

      // De keuze mag nooit de pagina gijzelen: klik ernaast = huidige taal houden.
      scrim.addEventListener('click', e => { if (e.target === scrim) { self.set(self.lang); self.closeModal(); } });
      if (!this._escBound) { // een keer, niet per herbouw
        this._escBound = true;
        document.addEventListener('keydown', e => {
          const m = document.getElementById('rtg-lang-modal');
          if (e.key === 'Escape' && m && m.classList.contains('open')) { this.set(this.lang); this.closeModal(); }
        });
      }
      if (stondOpen) { scrim.classList.add('open'); this._startMond(); }
    },
    // spreken -> tekst (Web Speech API, geen afhankelijkheden). Lukt het niet,
    // dan gebeurt er gewoon niets bijzonders; typen blijft altijd werken.
    _luister(zoek, stelVoor, kies, mic) {
      const R = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!R) return;
      try {
        const rec = new R();
        rec.lang = (navigator.language || 'en'); rec.interimResults = false; rec.maxAlternatives = 1;
        mic.classList.add('luistert');
        rec.onresult = (ev) => {
          const tekst = (ev.results && ev.results[0] && ev.results[0][0] && ev.results[0][0].transcript) || '';
          if (tekst) { zoek.value = tekst; stelVoor(); const code = this.zoekTaal(tekst).code; if (code) kies(code); }
        };
        rec.onend = () => mic.classList.remove('luistert');
        rec.onerror = () => mic.classList.remove('luistert');
        rec.start();
      } catch (e) { mic.classList.remove('luistert'); }
    },
    // de signatuurlippen: pas laden/tekenen zodra de kiezer echt getoond wordt
    _startMond() {
      const c = document.getElementById('rtg-lang-mond');
      if (!c || this._mond) return;
      const go = () => { if (window.RTGMond && !this._mond) this._mond = window.RTGMond.maak(c); };
      if (window.RTGMond) go();
      else if (!this._mondLaadt) {
        this._mondLaadt = true;
        const s = document.createElement('script'); s.src = assetPad('/shared/mond.js'); s.async = true;
        s.onload = go; document.head.appendChild(s);
      }
      this._startSterren();
    },
    // een heel subtiele 3D-sterrenhemel achter de kaart, in RTG-stijl
    _startSterren() {
      const scrim = document.getElementById('rtg-lang-modal');
      if (!scrim || this._sterren) return;
      const go = () => { if (window.RTGSterren && !this._sterren) this._sterren = window.RTGSterren.hang(scrim, { helderheid: 0.85 }); };
      if (window.RTGSterren) return go();
      if (this._sterLaadt) return;
      this._sterLaadt = true;
      const s = document.createElement('script'); s.src = assetPad('/shared/sterren.js'); s.async = true;
      s.onload = go; document.head.appendChild(s);
    },
    openModal() {
      if (!document.getElementById('rtg-lang-modal')) this.buildModal(this.chosen ? this.lang : (this._aanbevolen || detectDevice()));
      const m = document.getElementById('rtg-lang-modal'); if (m) m.classList.add('open');
      this._startMond();
      const z = document.getElementById('rtg-lang-zoek');
      if (z) setTimeout(() => { try { z.focus(); } catch (e) {} }, 80);
    },
    closeModal() { const m = document.getElementById('rtg-lang-modal'); if (m) m.classList.remove('open'); },

    /* ---------- de taalkeuze heropenen ----------
       De taalknop zweefde linksonder op elk scherm, boven op de themakiezer en
       het vraagteken. Taal is een instelling, dus hij staat nu waar de andere
       instellingen staan: in het bedieningspaneel (shared/bediening.js), dat
       openModal() aanroept. Het leden-OS deed dit al met de tegel "Taal". */
    buildSwitch() { /* geen zwevende knop meer; zie het bedieningspaneel */ },
    /* updateSwitch bijgewerkt de knop die er niet meer is. Hij zocht nog naar
       #rtg-lang-switch, en dat element staat sinds de verhuizing naar het
       bedieningspaneel op geen enkele pagina meer -- de blindevlek-toets ving
       het. Het paneel leest de taal vers uit bij elke opening (vulTaal in
       shared/bediening.js), dus er valt hier niets bij te werken. De methode
       blijft bestaan omdat applyTranslations() hem aanroept en losse pagina's
       hem kunnen overschrijven; hij doet alleen niets meer. */
    updateSwitch() { /* geen zwevende knop meer; het paneel leest zelf uit */ },

    injectStyles() {
      if (document.getElementById('rtg-i18n-styles')) return;
      const s = document.createElement('style');
      s.id = 'rtg-i18n-styles';
      s.textContent = `
      .rtg-lang-scrim{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;
        background:radial-gradient(120% 90% at 50% 0%,rgba(62,20,32,0.6),rgba(12,12,11,0.92) 60%);
        backdrop-filter:blur(10px);padding:1.1rem;-webkit-font-smoothing:antialiased;}
      .rtg-lang-scrim.open{display:flex;}
      .rtg-lang-card{width:100%;max-width:720px;max-height:92vh;display:flex;flex-direction:column;
        background:linear-gradient(180deg,#141110,#0C0C0B);color:#F5F3EF;border:1px solid rgba(201,162,75,0.22);
        border-radius:0;padding:1.2rem 1.3rem 1rem;text-align:center;box-shadow:0 40px 120px rgba(0,0,0,0.6);
        font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        animation:rtgLangIn .4s cubic-bezier(.2,.8,.2,1);}
      @keyframes rtgLangIn{from{opacity:0;transform:translateY(16px) scale(.98);}to{opacity:1;transform:none;}}
      .rtg-lang-mond{display:block;width:200px;height:90px;margin:0.1rem auto -0.15rem;}
      .rtg-lang-card h2{font-family:'Bodoni Moda',Georgia,serif;font-weight:500;font-size:1.55rem;margin:0.1rem 0 0.1rem;letter-spacing:-0.01em;color:#F7F3EC;}
      .rtg-lang-card p{color:#B8B2A8;font-size:0.8rem;margin:0 0 0.85rem;}
      .rtg-lang-ai{display:flex;align-items:center;gap:0.45rem;background:rgba(255,255,255,0.05);
        border:1px solid rgba(222,219,213,0.16);border-radius:0;padding:0.1rem 0.1rem 0.1rem 0.9rem;
        margin:0 auto 0.5rem;max-width:520px;width:100%;transition:border-color .18s;}
      .rtg-lang-ai:focus-within{border-color:#C9A24B;}
      .rtg-lang-ai input{flex:1;min-width:0;background:none;border:none;outline:none;color:#F5F3EF;
        font-family:inherit;font-size:0.92rem;padding:0.7rem 0;}
      .rtg-lang-ai input::placeholder{color:#8A8680;}
      .rtg-lang-ai button{flex:none;background:linear-gradient(180deg,#9E1C40,#7F1634);color:#fff;border:none;cursor:pointer;
        border-radius:0;padding:0.55rem 0.72rem;font-size:1rem;line-height:1;transition:filter .18s,transform .12s;}
      .rtg-lang-ai button:hover{filter:brightness(1.14);}
      .rtg-lang-ai button:active{transform:scale(0.95);}
      #rtg-lang-mic{background:rgba(255,255,255,0.08);}
      #rtg-lang-mic.luistert{background:linear-gradient(180deg,#C23A5E,#9E1C40);animation:rtgMic 1.1s ease-in-out infinite;}
      @keyframes rtgMic{0%,100%{box-shadow:0 0 0 0 rgba(194,58,94,0.5);}50%{box-shadow:0 0 0 6px rgba(194,58,94,0);}}
      /* Rahuls voorstel: geen knoppenlijst, maar een enkele aantikbare regel */
      .rtg-lang-hint{display:flex;align-items:center;gap:0.7rem;width:100%;max-width:520px;margin:0.1rem auto 0.2rem;
        background:rgba(201,162,75,0.08);border:1px solid rgba(201,162,75,0.3);border-radius:0;
        padding:0.55rem 0.9rem;cursor:pointer;text-align:left;font-family:inherit;color:#EDE9E2;
        transition:border-color .16s,background .16s,transform .12s;}
      .rtg-lang-hint:hover{border-color:#F5E6B8;background:rgba(201,162,75,0.14);}
      .rtg-lang-hint:active{transform:scale(0.99);}
      .rtg-lang-hint[hidden]{display:none;}
      .rtg-lang-flag{font-size:1.7rem;line-height:1;}
      .rtg-lang-sug{display:flex;flex-direction:column;line-height:1.2;}
      .rtg-lang-sug b{color:#F7F3EC;font-weight:600;font-size:0.98rem;}
      .rtg-lang-go{font-size:0.66rem;letter-spacing:0.04em;color:#C9A24B;}
      .rtg-lang-mis{color:#8A8680;font-size:0.82rem;}
      .rtg-lang-code{display:inline-block;min-width:1.7rem;font-size:0.6rem;font-weight:700;letter-spacing:0.05em;
        color:#C9A24B;border:1px solid rgba(201,162,75,0.4);border-radius:0;padding:0.3rem 0.2rem;text-align:center;}
      .rtg-lang-switch{position:fixed;left:14px;bottom:14px;z-index:9990;display:inline-flex;align-items:center;gap:0.35rem;
        background:rgba(12,12,11,0.82);color:#fff;border:1px solid rgba(255,255,255,0.16);border-radius:0;
        padding:0.42rem 0.8rem;font-family:'Inter',-apple-system,sans-serif;font-size:0.72rem;font-weight:600;
        letter-spacing:0.04em;cursor:pointer;backdrop-filter:blur(8px);box-shadow:0 6px 20px rgba(0,0,0,0.25);
        transition:background .18s;padding-bottom:calc(0.42rem + env(safe-area-inset-bottom,0));}
      .rtg-lang-switch:hover{background:#7F1634;border-color:#7F1634;}
      .rtg-sw-globe{font-size:0.9rem;}
      @media print{.rtg-lang-switch{display:none;}}
      /* Toegankelijkheid: wie in het systeem "beperk beweging" aan heeft, krijgt
         geen animaties of lange overgangen. 0.01ms i.p.v. 0 zodat code die op
         transitionend/animationend wacht gewoon blijft doorlopen. */
      @media (prefers-reduced-motion: reduce){
        *,*::before,*::after{
          animation-duration:.01ms!important;animation-iteration-count:1!important;
          transition-duration:.01ms!important;scroll-behavior:auto!important;
        }
      }
      `;
      document.head.appendChild(s);
    },

    /* De actieve wereldtalen ophalen (Boardroom-schakelaars). Faalt dit (bijv.
       op de noodserver), dan blijven Nederlands en Engels gewoon werken. */
    laadTalen() {
      return fetch(apiPad('/api/talen'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(r => r.json())
        .then(d => {
          if (Array.isArray(d.talen) && d.talen.length >= 2) {
            WERELD = d.talen; // de actieve set (voor de vertaling)
            // de matcher kent meteen de HELE wereld (alle 114) voor typen/spreken
            this._alleTalen = (Array.isArray(d.alle) && d.alle.length) ? d.alle : d.talen;
            this._lijst = this._alleTalen;
            // De site volgt de telefooninstelling: nu de hele wereld bekend is,
            // kiezen we alsnog de toesteltaal (bijv. Duits of Japans), tenzij het
            // lid zelf al een taal heeft gekozen. Engels blijft de terugval.
            if (!this.chosen) {
              const codes = this._alleTalen.map(t => t.code);
              const dev = detectDevice(codes);
              if (dev && dev !== this.lang) this.apply(dev);
              this._aanbevolen = dev;
            }
            const m = document.getElementById('rtg-lang-modal');
            if (!m || !m.classList.contains('open')) this.buildModal(this._aanbevolen || this.lang);
          }
        })
        .catch(() => {});
    },

    init() {
      this.injectStyles();
      let saved = null;
      try { saved = localStorage.getItem(STORE); } catch (e) {}
      // De site volgt standaard de TELEFOON-/toestelinstelling (navigator.language);
      // kan hij die taal (nog) niet, dan Engels als terugval. Er is geen gedwongen
      // taalkeuze: wie wil wisselen opent de kiezer (de wereldbol linksonder) en
      // typt of spreekt zijn taal. Een eerder gemaakte keuze blijft bewaard.
      if (saved && /^[a-z]{2}$/.test(saved)) {
        this.chosen = true;
        this.apply(saved);
      } else {
        this.apply(detectDevice()); // toesteltaal onder nl/en; laadTalen verruimt straks naar alle 114
      }
      this.buildSwitch();
      this.laadTalen();
    }
  };

  window.RTGi18n = RTGi18n;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RTGi18n.init());
  } else {
    RTGi18n.init();
  }
})();
