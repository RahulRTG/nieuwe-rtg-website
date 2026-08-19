/* THE COMMAND CANVAS -- de opbouw van elk RTG-scherm, in code.

   shared/canvas.css draagt de VORM van de vier lagen; dit blad zet ze neer, uit
   de gegevens die een wereld levert. Zie CANVAS.md voor het waarom. De volgorde
   is niet onderhandelbaar: eerst de stand, dan de rust, dan hooguit drie
   kaarten, en pas daarna de functies.

   WAAROM DIT EEN GEDEELD BESTAND IS EN GEEN VOORBEELD OM OVER TE TIKKEN. De
   twee regels die de wauw dragen verwateren allebei zodra er acht kopieen van
   bestaan: 'nooit meer dan drie kaarten' en 'de stand liegt nooit'. Een kopie
   is niet fout op de dag dat hij gemaakt wordt -- hij is fout op de dag dat er
   een vierde kaart bij komt en geen toets dat ziet. Hier kan dat niet: een
   vierde kaart GOOIT, luid en met naam.

   DIT BLAD TEKENT; canvas-taal.js FORMULEERT (RTGCanvas.zin, .groet). Twee
   soorten werk: het tekenen is voor alle acht werelden identiek, het
   formuleren verschilt per taal en per pas. Wie de stand tekent, laadt allebei.

   TWEE DINGEN DIE DIT BLAD MET OPZET NIET DOET. Zelf gegevens ophalen: wat de
   stand is weet de wereld (kern/wereldkern.js, standVan), dit tekent hem alleen
   -- anders staat de regel wanneer iets 'Operationeel' heet op acht plekken.
   En knoppen neerzetten: een samenhanglaag toont en wijst. */
(function (w, d) {
  'use strict';
  if (w.RTGCanvas) return;

  var T = function (k, nl) { return (w.RTGi18n && w.RTGi18n.t) ? w.RTGi18n.t(k, nl) : nl; };

  /* De vier niveaus van de wereldkern, vertaald naar wat het OOG ervan ziet:
     het signaal van de Signal Rail en het teken ernaast. Kleur is de derde laag
     en nooit de enige (ONTWERP.md par. 5), dus elk niveau draagt een teken.
     'onbekend' krijgt met opzet GEEN signaal: de rail valt dan terug op zijn
     stille grijs, en dat is wat 'ik weet het niet' hoort te zijn -- geen groen,
     en ook geen alarm. */
  var TEKENS = {
    verstoord: { sig: 'incident', teken: '!' },
    aandacht:  { sig: 'aandacht', teken: '!' },
    gezond:    { sig: 'gezond', teken: '✓' },
    onbekend:  { sig: '', teken: '?' }
  };

  function leeg(el) { while (el && el.firstChild) el.removeChild(el.firstChild); return el; }
  function maak(tag, klasse, tekst) {
    var e = d.createElement(tag);
    if (klasse) e.className = klasse;
    if (tekst != null) e.textContent = String(tekst);
    return e;
  }
  // een doel mag een element of een kiezer zijn; een kiezer die niets vindt is
  // geen stille no-op maar een fout, want dan tekent het scherm in het niets
  function doelVan(doel, wie) {
    var el = typeof doel === 'string' ? d.querySelector(doel) : doel;
    if (!el) throw new Error('RTGCanvas.' + wie + ': geen doel gevonden (' + doel + ')');
    return el;
  }

  /* ---------- laag 0: de stand ----------
     Een woord dat een mens begrijpt, en de cijfers die het dragen.

     DE STAND LIEGT NOOIT, en de client is de helft van die belofte. Komt er
     geen stand binnen -- niet ingelogd, netwerk stuk, route weg -- dan staat
     hier 'Onbekend' en niet het woord van de vorige keer. Dat laatste is de
     gevaarlijkste vorm: een scherm dat 'Operationeel' laat staan terwijl het
     al tien minuten niets meer ophaalt. */
  function stand(doel, o) {
    o = o || {};
    var s = o.stand && typeof o.stand === 'object' ? o.stand : null;
    var niveau = s && TEKENS[s.niveau] ? s.niveau : 'onbekend';
    var t = TEKENS[niveau];
    var el = leeg(doelVan(doel, 'stand'));

    el.className = 'cv-stand rtg-rail';
    if (t.sig) el.setAttribute('data-sig', t.sig); else el.removeAttribute('data-sig');
    el.setAttribute('data-niveau', niveau);

    if (o.app) el.appendChild(maak('div', 'cv-app', o.app));
    /* Het woord komt van de wereld, MAAR alleen als het niveau er een is dat
       hier bestaat. Een wereld die een vijfde niveau verzint, krijgt niet stil
       zijn eigen mooie woord op het scherm: dan weet dit blad niet wat het
       toont, en dat heet Onbekend. */
    var eigen = niveau !== 'onbekend' && s && s.woord;
    var woord = maak('p', 'cv-woord', eigen || T('canvas.onbekend', 'Onbekend'));
    woord.appendChild(maak('span', 'cv-teken', t.teken));
    el.appendChild(woord);

    /* De cijfers komen van de wereld en worden hier niet uitgerekend: [[5,
       'taken'], [2, 'wachten']]. Een cijfer dat het scherm zelf optelt is een
       tweede telling naast die van de server, en die twee lopen uiteen.

       EN ZONDER METING GEEN CIJFERS. Kwam er geen stand binnen, dan is nul geen
       telling maar een aanname: drie nullen die eruitzien als gemeten feiten.
       Dezelfde leugen als een groen woord, alleen kleiner gedrukt -- en hij
       stond er echt, zichtbaar op een uitgelogd scherm. */
    var cij = s ? (o.cijfers || []).filter(function (c) { return c && c.length; }) : [];
    if (cij.length) {
      var rij = maak('div', 'cv-cijfers');
      cij.forEach(function (c) {
        var sp = maak('span');
        sp.appendChild(maak('b', null, c[0]));
        sp.appendChild(d.createTextNode(' ' + c[1]));
        rij.appendChild(sp);
      });
      el.appendChild(rij);
    }
    return el;
  }

  /* ---------- laag 1: de rust ----------
     Negentig procent lucht, en hooguit twee regels tekst. Wie hier iets bij wil
     zetten, haalt eerst iets weg (CANVAS.md). */
  function rust(doel, o) {
    o = o || {};
    var el = leeg(doelVan(doel, 'rust'));
    el.className = 'cv-rust';
    if (o.kop) el.appendChild(maak('h2', null, o.kop));
    if (o.zin) el.appendChild(maak('p', null, o.zin));
    return el;
  }

  /* ---------- laag 2: drie kaarten. Altijd drie, nooit zes ----------
     "Is er een vierde die er echt toe doet, dan valt er een af -- dat is de
     hele oefening" (CANVAS.md). Daarom gooit dit en kapt het niet af: stil de
     vierde weglaten zou de oefening juist overslaan, en dan staat er iets dat
     de bouwer belangrijk vond en niemand ooit ziet (LAT.md regel 5). */
  var MAX = 3;
  function kaarten(doel, lijst) {
    var l = (lijst || []).filter(Boolean);
    if (l.length > MAX) {
      throw new Error('RTGCanvas.kaarten: ' + l.length + ' kaarten, en er passen er ' + MAX +
        '. Haal er een weg -- dat is de oefening, niet de opmaak. Gekregen: ' +
        l.map(function (k) { return k.kop || '?'; }).join(', '));
    }
    var el = leeg(doelVan(doel, 'kaarten'));
    el.className = 'cv-kaarten';
    l.forEach(function (k) {
      var kaart = maak(k.href ? 'a' : 'div', 'cv-kaart');
      if (k.href) kaart.setAttribute('href', k.href);
      if (k.sig) kaart.setAttribute('data-sig', k.sig);
      kaart.appendChild(maak('span', 'cv-kop', k.kop || ''));
      var r = maak('span', 'cv-regel');
      // een kaart draagt een getal en een zin; het getal is tabulair en dus
      // een eigen element, want cijfers die verspringen lezen als ruis
      if (k.getal != null) { r.appendChild(maak('b', null, k.getal)); r.appendChild(d.createTextNode(' ')); }
      r.appendChild(d.createTextNode(k.regel || ''));
      kaart.appendChild(r);
      el.appendChild(kaart);
    });
    return el;
  }

  /* ---------- laag 3: de Command Timeline ----------
     Geen lijst maar een lijn: het uur draagt hem, de gebeurtenis hangt eraan.
     Een punt zonder uur krijgt een streep en geen verzonnen tijd.

     Een punt met een `href` wordt een LINK, en dat is geen opsmuk: een tijdlijn
     waar je niet op kunt tikken is een plaatje van uw dag. De weg loopt naar de
     app die het echte werk doet, precies zoals elke regel op een samenhanglaag
     (PLATFORM.md). Zonder href blijft het een span -- een punt dat nergens heen
     gaat, hoort er ook niet klikbaar uit te zien. */
  function lijn(doel, punten) {
    var el = leeg(doelVan(doel, 'lijn'));
    el.className = 'cv-lijn';
    (punten || []).filter(Boolean).forEach(function (p) {
      var stip = maak('div', 'cv-stip');
      stip.appendChild(maak('span', 'cv-uur', p.uur || '-'));
      var wat = maak(p.href ? 'a' : 'span', 'cv-wat');
      if (p.href) wat.setAttribute('href', p.href);
      if (p.sig) wat.setAttribute('data-sig', p.sig);
      wat.appendChild(maak('span', 'cv-titel', p.titel || ''));
      if (p.toe) wat.appendChild(maak('span', 'cv-toe', p.toe));
      stip.appendChild(wat);
      el.appendChild(stip);
    });
    gebaren(el);
    return el;
  }

  /* Elke tijdlijnregel draagt zijn acties (shared/gebaar.js). Ze hangen aan de
     LINK en niet aan de hele stip: dan schuift de tekst weg en blijft de lijn
     met zijn stip staan -- de gebeurtenis beweegt, de tijd niet. Gedelegeerd,
     want deze lijn wordt opnieuw getekend zodra er iets binnenkomt. */
  function gebaren(el) {
    if (el.dataset.gbAan) return;
    if (!w.RTGGebaar) {
      d.addEventListener('rtg-gebaar', function () { gebaren(el); }, { once: true });
      return;
    }
    el.dataset.gbAan = '1';
    var K = w.RTGGebaar.klaar;
    w.RTGGebaar.lijst(el, '.cv-wat[href]', function (rij) {
      var pak = function (k) { var x = rij.querySelector(k); return x ? x.textContent.trim() : ''; };
      var titel = pak('.cv-titel'), toe = pak('.cv-toe');
      var stip = rij.closest('.cv-stip');
      var uur = stip ? (stip.querySelector('.cv-uur') || {}).textContent : '';
      var href = rij.getAttribute('href');
      return {
        titel: titel,
        rechts: [K.openen(href), K.delen({ titel: titel, url: href })],
        links: [K.overnemen([String(uur || '').trim(), titel, toe].filter(Boolean).join(' \u00b7 '))]
      };
    });
  }

  /* ---------- Focus Mode ----------
     De rest verdwijnt niet maar VERVAAGT: verdwijnen maakt onrustig (waar is
     het heen?), vervagen geeft rust. Wat vervaagt bepaalt het scherm met
     .cv-vervaagt; dit zet alleen de schakelaar om, op EEN plek. */
  function focus(aan) {
    d.body.classList.toggle('cv-focus', aan !== false);
    return d.body.classList.contains('cv-focus');
  }

  w.RTGCanvas = {
    MAX_KAARTEN: MAX,
    stand: stand, rust: rust, kaarten: kaarten, lijn: lijn, focus: focus
  };
})(window, document);
