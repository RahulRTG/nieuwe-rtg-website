/* Het gegevensgesprek in de app: de client-kant van de gegevenspoort.

   De server houdt een handeling met een DERDE PARTIJ tegen met 428 en zegt erbij
   wat er mist (server/kern/gegevenspoort.js). Zonder deze module blijft het
   daarbij: het lid krijgt een melding "dat vraag ik even" en er wordt vervolgens
   niets gevraagd -- een foutmelding die liegt is erger dan een die dat niet doet.

   Hier gebeurt wat er beloofd is. Rahul stelt de vraag, een per keer, met de
   knop "waarom?" ernaast omdat je op een vraag naar je telefoonnummer een
   eerlijk antwoord hoort te krijgen. Als het rond is, gaat de oorspronkelijke
   handeling gewoon door -- het lid hoeft niet opnieuw te zoeken wat het aan het
   doen was. En stoppen kan altijd; dan gaat die ene handeling niet door en
   verder niets.

   De module weet niets van tokens. De pagina geeft haar eigen `call(pad, body)`
   mee, dus dit werkt zowel in de leden-app (API.call) als op de losse pagina's
   met hun eigen fetch-helper.

   DE ADRESSTAP MAG KORTER, MAAR NOOIT STILLER. Postcode plus huisnummer levert
   een VOORSTEL (shared/adresvoorstel.js, waar het waarom staat): eerst in beeld
   met een ja en een nee, en pas op het ja gaat er iets naar de server. Al het
   andere gaat ongewijzigd door, en die stap kan twee beurten kosten.

   HIJ HEET RTGGegevensPoort EN NIET RTGPoort. Die naam was al bezet door
   shared/rahulpoort.js -- de INLOGpoort, met een heel andere vorm
   (.gesprek() in plaats van .vang()). Twee sessies kwamen los van elkaar op
   dezelfde naam, en op een pagina waar de ander laadde zag de haak in
   appshell.js een object dat leek te kloppen en riep er een functie op die er
   niet was. Geen foutmelding in beeld: de aanroep sneuvelde in een async
   afhandeling en de inlogpoort ging simpelweg nooit open. Vandaar een naam die
   zegt om welke poort het gaat. */
(function (w) {
  'use strict';
  if (w.RTGGegevensPoort) return;

  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };

  var CSS =
    '.rp-waas{position:fixed;inset:0;z-index:70;background:rgba(6,6,6,.72);backdrop-filter:blur(4px);' +
    'display:flex;align-items:center;justify-content:center;padding:1.2rem;}' +
    '.rp-waas[hidden]{display:none;}' +
    '.rp-kaart{width:min(30rem,100%);background:#151312;border:1px solid rgba(255,255,255,.12);' +
    'border-radius:0;padding:1.4rem;font-family:Inter,system-ui,sans-serif;color:#F4F1EC;' +
    'box-shadow:0 24px 60px rgba(0,0,0,.6);}' +
    '.rp-kaart h2{font-family:"Bodoni Moda",Georgia,serif;font-weight:600;font-size:1.3rem;margin:0 0 .8rem;}' +
    '.rp-vraag{font-size:.95rem;line-height:1.55;margin:0 0 1rem;}' +
    '.rp-kaart input{width:100%;background:#0C0C0B;border:1px solid rgba(255,255,255,.18);border-radius:0;' +
    'color:#F4F1EC;font:inherit;font-size:.95rem;padding:.7rem .8rem;}' +
    '.rp-kaart input:focus{outline:none;border-color:var(--burgundy-on-dark,#C23A5E);}' +
    '.rp-rij{display:flex;gap:.6rem;margin-top:1rem;}' +
    '.rp-rij button{border:none;cursor:pointer;font:inherit;font-weight:600;font-size:.9rem;border-radius:0;padding:.7rem 1rem;}' +
    '.rp-door{flex:1;background:var(--burgundy,#7F1634);color:#fff;}' +
    '.rp-door:hover{background:var(--burgundy-bright,#9E1C40);}' +
    '.rp-door:disabled{background:#2a2724;color:#6b6862;cursor:not-allowed;}' +
    '.rp-stop{background:transparent;color:#CFC9BE;border:1px solid rgba(255,255,255,.2) !important;}' +
    '.rp-waarom{background:none;border:none;color:var(--burgundy-on-dark,#C23A5E);font:inherit;font-size:.82rem;' +
    'cursor:pointer;padding:0;margin-top:.7rem;text-decoration:underline;}' +
    '.rp-uitleg{font-size:.84rem;line-height:1.5;color:var(--rtg-leeszacht,#A79F92);margin:.7rem 0 0;}' +
    '@media print{.rp-waas{display:none;}}';

  var waas = null, kaart = null, huidig = null;

  function bouw() {
    var s = document.createElement('style'); s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
    waas = document.createElement('div'); waas.className = 'rp-waas'; waas.hidden = true;
    kaart = document.createElement('div'); kaart.className = 'rp-kaart';
    kaart.setAttribute('role', 'dialog'); kaart.setAttribute('aria-modal', 'true');
    kaart.setAttribute('aria-label', 'Rahul vraagt iets');
    waas.appendChild(kaart);
    // buiten de kaart klikken of Escape = stoppen; nooit een gesprek waar je niet uit komt
    waas.addEventListener('click', function (e) { if (e.target === waas) klaar(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !waas.hidden) klaar(false); });
    document.body.appendChild(waas);
  }

  function toon(tekst, veld, uitleg) {
    var invoer = veld && veld !== 'identiteit';
    // het veld blijft bij de vraag: stuur() moet de adresstap herkennen
    if (huidig) { huidig.vraag = tekst; huidig.veld = veld || null; }
    kaart.innerHTML =
      '<h2>Nog een ding</h2>' +
      '<p class="rp-vraag">' + esc(tekst) + '</p>' +
      (invoer ? '<input type="text" class="rp-in" autocomplete="' + (veld === 'telefoon' ? 'tel' : 'street-address') +
        '" inputmode="' + (veld === 'telefoon' ? 'tel' : 'text') + '"' +
        (veld === 'adres' ? ' placeholder="Postcode en huisnummer mag ook"' : '') + '>' : '') +
      (uitleg ? '<p class="rp-uitleg">' + esc(uitleg) + '</p>' :
        (invoer ? '<button type="button" class="rp-waarom">Waarom vraag je dit?</button>' : '')) +
      '<div class="rp-rij">' +
      (invoer ? '<button type="button" class="rp-door">Doorgaan</button>' : '') +
      '<button type="button" class="rp-stop">' + (invoer ? 'Laat maar' : 'Sluiten') + '</button>' +
      '</div>';
    var in1 = kaart.querySelector('.rp-in');
    if (in1) {
      in1.focus();
      in1.addEventListener('keydown', function (e) { if (e.key === 'Enter') stuur(in1.value); });
    }
    var d = kaart.querySelector('.rp-door'); if (d) d.addEventListener('click', function () { stuur(in1 ? in1.value : ''); });
    var wa = kaart.querySelector('.rp-waarom'); if (wa) wa.addEventListener('click', function () { stuur('waarom?', true); });
    kaart.querySelector('.rp-stop').addEventListener('click', function () { klaar(false); });
  }

  // Een getypt antwoord. Bij de adresstap kan er een opzoeking tussen; de VORM
  // van het antwoord bepaalt dat, en niets anders.
  function stuur(tekst, isWaarom) {
    if (!huidig || !String(tekst || '').trim()) return;
    if (!isWaarom && huidig.veld === 'adres' && w.RTGAdresvoorstel) {
      var gel = w.RTGAdresvoorstel.lees(tekst);
      if (gel) return opzoeken(gel);
    }
    verzend(tekst, isWaarom);
  }

  // Lukt het opzoeken niet, dan blijft dezelfde vraag staan met de zin van de
  // server eronder, en is er niets bewaard.
  function opzoeken(gel) {
    var vraag = huidig.vraag;
    var knop = kaart.querySelector('.rp-door'); if (knop) knop.disabled = true;
    w.RTGAdresvoorstel.zoek(huidig.call, gel).then(function (r) {
      if (!huidig) return;
      if (!r.voorstel) return toon(vraag, 'adres', r.tekst);
      bevestig(r.voorstel, vraag);
    });
  }

  /* Op ja gaat PRECIES deze zin naar de server: in de kluis komt letterlijk wat
     er in beeld stond. Op nee gaat er niets heen en staat de vraag er weer. */
  /* De bevestigkaart zelf staat in shared/adresvoorstel.js: dat is de module
     over het adresvoorstel, en dit bestand ging met die kaart erbij over de
     10 KB-lat -- het teken dat er een tweede onderwerp in zat. */
  function bevestig(zin, vraag) {
    RTGAdresvoorstel.kaart(kaart, esc, zin,
      function () { verzend(zin); },
      function () { toon(vraag, 'adres', ''); });
  }

  function verzend(tekst, isWaarom) {
    if (!huidig) return;
    var knop = kaart.querySelector('.rp-door'); if (knop) knop.disabled = true;
    var vraag = huidig.vraag;
    huidig.call('/api/gegevens/zeg', { id: huidig.id, tekst: String(tekst) }).then(function (d) {
      if (!huidig) return;
      if (d.klaar) return klaar(true);
      if (d.gestopt) return toon(d.tekst, null, '');
      /* Op "waarom?" komt het eerlijke antwoord terug bij DEZELFDE vraag. Die
         vraag laten we dus staan en het antwoord komt eronder -- anders zou het
         antwoord de vraag verdringen en weet niemand meer wat er gevraagd werd. */
      if (isWaarom) return toon(vraag, d.veld, d.tekst);
      toon(d.tekst, d.veld, '');
    }).catch(function (e) { toon(e && e.message ? e.message : 'Dat lukte even niet.', null, ''); });
  }

  function klaar(gelukt) {
    if (!huidig) return;
    var f = huidig.af; huidig = null;
    if (waas) waas.hidden = true;
    f(!!gelukt);
  }

  /* Het gesprek voeren. `d` is het 428-antwoord (met soort en ontbreekt), `call`
     is de api-functie van de pagina. Belooft true als alles er nu is. */
  function los(d, call) {
    if (!waas) bouw();
    return new Promise(function (af) {
      huidig = { call: call, af: af, id: null };
      waas.hidden = false;
      toon('Momentje...', null, '');
      call('/api/gegevens/start', { soort: d && d.soort }).then(function (s) {
        if (!huidig) return;
        if (s.klaar) return klaar(true);
        huidig.id = s.id;
        toon(s.tekst, s.veld, '');
      }).catch(function (e) { toon(e && e.message ? e.message : 'Dat lukte even niet.', null, ''); });
    });
  }

  /* Wat een api-helper hiermee doet: geef het antwoord en de status mee, plus
     een manier om het opnieuw te proberen. Is dit geen poort-antwoord, dan komt
     er null terug en gaat de helper zijn eigen gang. */
  function vang(d, status, opnieuw, call) {
    if (status !== 428 || !d || !d.ontbreekt || !d.ontbreekt.length) return null;
    return los(d, call).then(function (ok) {
      if (!ok) throw new Error(d.error || 'Dan gaat het niet door.');
      return opnieuw();
    });
  }

  w.RTGGegevensPoort = { los: los, vang: vang };
})(window);
