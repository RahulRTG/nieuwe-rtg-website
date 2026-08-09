/* RTG Command, deel 1: de schil.

   ÉÉN APP, TIEN WERKPLEKKEN, ÉÉN OBJECTMODEL. Dit deel doet de inlog (via het
   gedeelde kantoorgesprek, niet een eigen codeveld), de rail, het schakelen
   tussen werkplekken en de gedeelde hulpjes die de andere delen gebruiken.

   DE WERKPLEKKEN ZIJN GEEN APPS. Ze delen dezelfde staat, dezelfde zoekbalk en
   hetzelfde journaal; wat je in de ene doet, zie je in de andere terug zonder
   te herladen. Dat is het verschil tussen één app en tien schermen achter één
   menu -- en het is precies waarom de puls na elke ingreep opnieuw wordt
   opgehaald in plaats van dat elk scherm zijn eigen kopie bijhoudt. */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  };
  var TOKEN = null;
  try { TOKEN = localStorage.getItem('rtg_office_token'); } catch (e) {}

  function meld(t) {
    var m = $('#melding'); m.textContent = t; m.style.opacity = '1';
    clearTimeout(m._t); m._t = setTimeout(function () { m.style.opacity = '0'; }, 3200);
  }

  /* Eén api-functie voor de hele app. Een 401 is geen fout maar een
     toestand: de sessie is weg, dus terug naar het gesprek. */
  function api(pad, body) {
    return fetch('/api/command/' + pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 401) { TOKEN = null; inlog(); var e0 = new Error('sessie'); e0.stil = true; throw e0; }
        if (!r.ok) { var e = new Error(d.error || 'Er ging iets mis.'); e.status = r.status; e.data = d; throw e; }
        return d;
      });
    });
  }

  /* De gedeelde staat. Eén object, want tien werkplekken die elk hun eigen
     kopie van de puls bijhouden, lopen binnen een dag uiteen. */
  var S = { puls: null, start: null, werkplek: 'puls', zoekterm: '', zoek: null, object: null, plan: null };

  var NIVEAUNAAM = { auto: 'autonoom', assist: 'assisted', hand: 'handmatig' };
  function niveau(n) {
    return '<span class="cniveau ' + esc(n) + '">' + esc(NIVEAUNAAM[n] || n) + '</span>';
  }
  var MND = ['', 'jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  function tijd(s) {
    if (!s) return '';
    var d = new Date(s);
    if (isNaN(d)) return String(s).slice(0, 16);
    return d.getDate() + ' ' + MND[d.getMonth() + 1] + ' ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function getal(n) { return (n == null ? '-' : String(n)); }
  function euro(centen) { return '€ ' + (Number(centen || 0) / 100).toLocaleString('nl-NL'); }

  /* De werkplekken. De volgorde is de volgorde van een werkdag: eerst zien wat
     er is, dan zoeken, dan vragen, dan afhandelen, dan herstellen, en pas
     daarna besturen. De laatste twee (werk, journaal) zijn de spiegels. */
  var WERKPLEKKEN = [
    { id: 'puls', naam: 'Command Center', sec: 'Zien', teller: function (s) { return s.puls ? s.puls.domeinen.filter(function (d) { return d.stand !== 'in orde' && d.stand !== 'leeg'; }).length : 0; } },
    { id: 'zoek', naam: 'Zoek alles', sec: 'Zien' },
    { id: 'operator', naam: 'Operator', sec: 'Doen' },
    { id: 'zaken', naam: 'Uitzonderingen', sec: 'Doen', teller: function (s) { return s.puls ? s.puls.zaken.open : 0; } },
    { id: 'herstel', naam: 'Herstel', sec: 'Doen', teller: function (s) { return s.puls ? s.puls.herstel.kandidaten : 0; } },
    { id: 'beleid', naam: 'Beleid', sec: 'Besturen', teller: function (s) { return s.puls ? s.puls.beleid.voorstellenOpen : 0; } },
    { id: 'simulatie', naam: 'Simulatie', sec: 'Besturen' },
    { id: 'toezicht', naam: 'Toezicht', sec: 'Besturen', teller: function (s) { return s.puls ? s.puls.agents.gestopt : 0; } },
    { id: 'werk', naam: 'Werkbesparing', sec: 'Spiegel' },
    { id: 'journaal', naam: 'Journaal', sec: 'Spiegel' },
    { id: 'werkplek', naam: 'De werkplek', sec: 'Spiegel' }
  ];

  var TEKENAARS = {};   // de delen hierna hangen hun tekenfunctie hier op

  function railTeken() {
    var uit = '', sec = '';
    for (var i = 0; i < WERKPLEKKEN.length; i++) {
      var w = WERKPLEKKEN[i];
      if (w.sec !== sec) { sec = w.sec; uit += '<div class="csec">' + esc(sec) + '</div>'; }
      var t = w.teller ? w.teller(S) : 0;
      uit += '<button data-w="' + esc(w.id) + '"' + (S.werkplek === w.id ? ' aria-current="page"' : '') + '>' +
        esc(w.naam) + (t ? '<span class="tel' + (w.id === 'puls' || w.id === 'zaken' ? ' op' : '') + '">' + t + '</span>' : '') +
        '</button>';
    }
    $('#rail').innerHTML = uit;
    $('#rail').querySelectorAll('[data-w]').forEach(function (b) {
      b.onclick = function () { ga(b.dataset.w); };
    });
  }

  function standTeken() {
    var el = $('#stand');
    if (!S.puls) { el.className = 'stand'; el.innerHTML = '<i></i><span>laden…</span>'; return; }
    var k = S.puls.stand === 'storing' ? 'storing' : S.puls.stand === 'let op' ? 'let' : S.puls.stand === 'leeg' ? 'leeg' : '';
    el.className = 'stand ' + k;
    el.innerHTML = '<i></i><span>' + esc(S.puls.stand) + ' · ' + S.puls.zaken.open + ' open</span>';
  }

  function ga(id) {
    S.werkplek = id;
    try { history.replaceState(null, '', '#' + id); } catch (e) {}
    railTeken();
    teken();
  }

  function teken() {
    var f = TEKENAARS[S.werkplek];
    if (!f) { $('#main').innerHTML = '<div class="leeg">Die werkplek bestaat niet.</div>'; return; }
    try { f($('#main')); }
    catch (e) { $('#main').innerHTML = '<div class="leeg">Deze werkplek kon niet worden getekend: ' + esc(e.message) + '</div>'; }
  }

  /* Na elke ingreep: de puls opnieuw, want een teller in de rail die niet
     meebeweegt met wat je net deed, is een teller die je niet gelooft. */
  function ververs() {
    return api('start').then(function (d) {
      S.start = d; S.puls = d.puls;
      standTeken(); railTeken();
      return d;
    });
  }

  function inlog() {
    $('#rail').innerHTML = '';
    $('#main').innerHTML = '<div id="lGesprek"></div>';
    window.RTGKantoorGesprek.toon($('#lGesprek'), function (token) {
      TOKEN = token;
      try { localStorage.setItem('rtg_office_token', TOKEN); } catch (e) {}
      begin();
    });
  }

  function begin() {
    var hash = (location.hash || '').replace('#', '');
    if (hash && WERKPLEKKEN.some(function (w) { return w.id === hash; })) S.werkplek = hash;
    ververs().then(function () { railTeken(); teken(); }).catch(function (e) {
      if (e && e.stil) return;
      $('#main').innerHTML = '<div class="leeg">Command kon niet laden: ' + esc(e.message) + '</div>';
    });
  }

  /* De zoekbalk staat in de kop en werkt vanuit elke werkplek: typen en enter
     brengt je naar de zoekwerkplek. Dat is de belofte "één zoekbalk voor
     letterlijk alles" -- hij hoort dus niet in één scherm te wonen. */
  $('#q').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    S.zoekterm = $('#q').value;
    if (S.werkplek !== 'zoek') ga('zoek'); else teken();
  });

  window.RTGCommand = { $: $, esc: esc, api: api, meld: meld, S: S, ga: ga, teken: teken,
    ververs: ververs, niveau: niveau, tijd: tijd, getal: getal, euro: euro,
    TEKENAARS: TEKENAARS, WERKPLEKKEN: WERKPLEKKEN, railTeken: railTeken };

  window.addEventListener('DOMContentLoaded', function () {
    if (TOKEN) begin(); else inlog();
  });
})();
/* RTG Command, deel 2: het Command Center en de werkplek.

   HET COMMAND CENTER toont per domein de gerekende stand met de redenen
   eronder. Er is bewust geen knop om een domein op groen te zetten: een
   stoplicht dat je kunt overrulen, staat op den duur altijd groen.

   DE WERKPLEK is de andere helft van "één app": naast besturen moet een
   kantoor ook gewoon kunnen wérken -- schrijven, rekenen, mailen, plannen,
   vergaderen. Die apps bestaan al in dit platform; ze worden hier niet
   nagebouwd maar vanuit dezelfde schil geopend, met de uitleg erbij waarvoor
   je ze pakt. Een tweede tekstverwerker bouwen zou precies de fout zijn die
   deze hele operatie moest oplossen. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, S = C.S;

  var KLEUR = { 'in orde': 'groen', 'let op': 'gold', 'storing': 'acc', 'leeg': '' };

  C.TEKENAARS.puls = function (el) {
    var p = S.puls;
    if (!p) { el.innerHTML = '<div class="leeg">Nog geen beeld.</div>'; return; }
    var u = '<h2 class="ckop">Global Command Center</h2>' +
      '<p class="lead">De stand van elk domein, elke keer opnieuw gerekend uit de gegevens. ' +
      'Een domein zonder objecten staat op <em>leeg</em> en niet op <em>in orde</em>: niet gemeten is geen groen.</p>';

    u += '<div class="rooster">' +
      tegel('Stand', p.stand, KLEUR[p.stand] || '', p.domeinen.length + ' domeinen in beeld') +
      tegel('Open uitzonderingen', p.zaken.open, p.zaken.overTermijn ? 'acc' : '', p.zaken.overTermijn + ' over de termijn, ' + p.zaken.zonderEigenaar + ' zonder eigenaar') +
      tegel('Te herstellen', p.herstel.kandidaten, p.herstel.kandidaten ? 'gold' : 'groen', p.herstel.runbooks + ' runbooks' + (p.herstel.autoAan ? ', automatisch herstel staat aan' : ', automatisch herstel staat UIT')) +
      tegel('Agents', p.agents.totaal, p.agents.gestopt ? 'acc' : '', p.agents.gestopt + ' gestopt, ' + p.agents.bijnaOpBudget + ' bijna op budget') +
      tegel('Journaalregels', p.journaal.regels, p.journaal.keten.heel ? 'groen' : 'acc',
        p.journaal.keten.heel ? 'de keten is heel (' + p.journaal.venster + ' in het venster)' : 'BREUK bij ' + esc(p.journaal.keten.bij)) +
      tegel('Beleidsregels', p.beleid.regels, p.beleid.voorstellenOpen ? 'gold' : '', p.beleid.voorstellenOpen + ' voorstel(len) wachten op een tweede paar ogen') +
      '</div>';

    u += '<h2 class="ckop" style="font-size:1.15rem;margin-top:1.6rem;">Per domein</h2><div class="rooster">';
    for (var i = 0; i < p.domeinen.length; i++) {
      var d = p.domeinen[i];
      u += '<div class="tegel"><div class="l">' + esc(d.domein) + '</div>' +
        '<div class="v ' + (KLEUR[d.stand] || '') + '" style="font-size:1.15rem;">' + esc(d.stand) + '</div>' +
        '<div class="u">' + esc(d.redenen.join(' · ')) + '</div>' +
        '<div class="meta" style="margin-top:.5rem;">' + d.objecten + ' objecten in ' +
        esc(d.soorten.map(function (s) { return s.meervoud; }).join(', ')) + '</div>' +
        (d.runbooks.length ? '<div class="meta" style="margin-top:.35rem;">' +
          d.runbooks.map(function (r) { return esc(r.naam) + ' (' + r.kandidaten + ', ' + esc(r.niveau) + ')'; }).join('<br>') + '</div>' : '') +
        '</div>';
    }
    u += '</div>';
    u += '<p class="meta" style="margin-top:1.2rem;">Dekking: ' + p.dekking.soorten + ' objectsoorten over ' +
      p.dekking.domeinen + ' domeinen. Wat niet in het objectregister staat, telt hier niet mee -- het staat dan niet op groen, het staat er niet.</p>';
    el.innerHTML = u;
  };

  function tegel(l, v, k, u) {
    return '<div class="tegel"><div class="l">' + esc(l) + '</div>' +
      '<div class="v ' + (k || '') + '">' + esc(v) + '</div>' +
      (u ? '<div class="u">' + esc(u) + '</div>' : '') + '</div>';
  }

  /* De werkplek-suite. Elk kaartje wijst naar een app die er al is; de tekst
     zegt waarvoor je hem pakt, niet wat hij heet. */
  var SUITE = [
    ['Schrijven & rekenen', [
      ['/apps/office.html', 'RTG Office', 'Documenten, bladen, presentaties, formulieren en borden -- met de kantoor-drive eronder.'],
      ['/apps/notities.html', 'Notities', 'Korte aantekeningen die aan een dossier of project blijven hangen.'],
      ['/apps/bestanden.html', 'Bestanden', 'De drive: versies, rechten, bewaartermijn en het spoor wie wat opende.']
    ]],
    ['Contact', [
      ['/apps/rtmail.html', 'RTMail', 'De eigen mailstack met gedeelde postbussen en triage.'],
      ['/apps/comm.html', 'Berichten', 'Chat, bellen, videobellen en afspraken in één gesprekslijst.'],
      ['/apps/meet.html', 'Meet', 'Vergaderen met scherm delen; de notulen komen in het dossier.'],
      ['/apps/agenda.html', 'Agenda', 'Mensen, ruimtes en middelen in één planning.']
    ]],
    ['Bedrijfsvoering', [
      ['/apps/backoffice.html', 'Backoffice', 'De dagcijfers, partners, orders en de verificatiewachtrij.'],
      ['/apps/kantoren.html', 'De kamers', 'De afdelingskamers van RTG, de boardroom en de regie.'],
      ['/apps/personeel.html', 'Personeel', 'Rooster, taken, verlof en de PDA’s van de werkvloer.'],
      ['/apps/payroll.html', 'Payroll', 'De loonrun, uren, toeslagen en de salarisadministratie.'],
      ['/apps/balans.html', 'Balans', 'Grootboek, debiteuren, crediteuren en de jaarcijfers.'],
      /* RTG REKENING. Het b-woord in de eigen productnaam vraagt een
         vergunning (Wft 3:7), dus heet dit overal RTG Rekening --
         test/eu-naleving.test.js loopt elk uitgeleverd scherm na om te zien of
         iemand het toch weer anders noemt, en die pin leest ook commentaar. */
      ['/apps/bank.html', 'RTG Rekening', 'De eigen rekeninglaag op het Pay-grootboek.'],
      ['/apps/juridisch.html', 'Juridisch', 'Voorwaarden, privacy en de partnerafspraken.']
    ]],
    ['Techniek & dienst', [
      ['/apps/techniek.html', 'Techniek', 'De motorkap: grootboeken, belasting en de wacht.'],
      ['/apps/meldkamer.html', 'Meldkamer', 'Incidenten, dienst en de coördinatie erop.'],
      ['/apps/logboek.html', 'Logboek', 'Wat er is gebeurd, in de volgorde waarin het gebeurde.'],
      ['/apps/websitestudio.html', 'Website­studio', 'De publieke kant: pagina’s, campagnes en beeld.']
    ]],
    ['RTG & RTF', [
      ['/apps/foundation/kantoor.html', 'RTF-kantoor', 'De stichting: projecten, vrijwilligers, hulpvragen en de afdrachten.'],
      ['/apps/rtgkantoor.html', 'De RTG AI', 'De eigen AI van het kantoor en de Onderzoeker ernaast.'],
      ['/apps/boardroom.html', 'Boardroom', 'De kamer van de eigenaar: functies aan of uit, platformbreed.'],
      ['/apps/redactiekantoor.html', 'Redactie', 'Krant, magazine en de drukkerij in eigen huis.']
    ]]
  ];

  C.TEKENAARS.werkplek = function (el) {
    var u = '<h2 class="ckop">De werkplek</h2>' +
      '<p class="lead">Command bestuurt; hier wordt gewerkt. Deze apps bestaan al en delen dezelfde inlog, ' +
      'dezelfde codenamen en dezelfde gegevens -- ze worden hier geopend, niet nagebouwd. ' +
      'Wat u in Command aan een object doet, ziet u daar terug, en omgekeerd.</p>';
    for (var i = 0; i < SUITE.length; i++) {
      u += '<h2 class="ckop" style="font-size:1.1rem;margin:1.4rem 0 .6rem;">' + esc(SUITE[i][0]) + '</h2><div class="werkplek">';
      var rij = SUITE[i][1];
      for (var j = 0; j < rij.length; j++) {
        u += '<a href="' + esc(rij[j][0]) + '"><b>' + esc(rij[j][1]) + '</b><span>' + esc(rij[j][2]) + '</span></a>';
      }
      u += '</div>';
    }
    el.innerHTML = u;
  };
})();
/* RTG Command, deel 3: de zoekbalk over alles, en het objectdossier.

   DE UITSLAG ZEGT ALTIJD WAAR ER GEKEKEN IS. Ook bij nul treffers staat er
   welke soorten en welke velden zijn doorzocht. "Niets gevonden" hoort een
   uitslag te zijn en geen stilte -- anders weet je niet of je verkeerd zocht of
   dat het er echt niet is.

   HET DOSSIER LAAT ZIEN WAT HET NIET WEET. Staat er een kluisveld, dan staat
   dat er als kluisveld en niet als leeg veld. Is de afhankelijkhedenscan tegen
   zijn grens gelopen, dan zegt hij dat. Een dossier dat zijn eigen gaten
   verzwijgt, laat je een beslissing nemen op iets wat je niet hebt gezien. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, S = C.S, api = C.api;

  C.TEKENAARS.zoek = function (el) {
    var term = S.zoekterm || '';
    document.querySelector('#q').value = term;
    el.innerHTML = '<h2 class="ckop">Zoek alles</h2>' +
      '<p class="lead">Eén balk over elk domein: naam, code, kenteken, plaats, status of ordernummer. ' +
      'Wat u vindt, opent u als dossier -- met de systemen die eraan hangen.</p>' +
      '<div id="zuit">' + (term ? '<div class="leeg">Zoeken naar “' + esc(term) + '”…</div>'
        : '<div class="leeg">Typ boven in de balk en druk op enter.</div>') + '</div>';
    if (!term) return;
    api('zoek', { q: term }).then(function (d) {
      S.zoek = d;
      document.querySelector('#zuit').innerHTML = zoekuit(d);
      bindTreffers();
    }).catch(function (e) { if (!e.stil) document.querySelector('#zuit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
  };

  function zoekuit(d) {
    if (d.kort) return '<div class="leeg">Een zoekterm van minstens twee tekens, graag.</div>';
    var u = '<p class="meta" style="margin-bottom:.9rem;">' + d.totaal + ' treffer(s) in ' +
      d.groepen.length + ' soort(en)' + (d.domeinen && d.domeinen.length ? ' over ' + d.domeinen.length + ' domein(en)' : '') + '.</p>';
    if (!d.groepen.length) {
      u += '<div class="kaart"><h3>Niets gevonden</h3><p>Er is gekeken in ' + d.bereik.length + ' objectsoorten:</p>' +
        '<div class="meta" style="margin-top:.5rem;">' +
        d.bereik.map(function (b) { return esc(b.meervoud) + ' (' + esc(b.velden.join(', ')) + ')'; }).join('<br>') +
        '</div></div>';
      return u;
    }
    for (var i = 0; i < d.groepen.length; i++) {
      var g = d.groepen[i];
      u += '<div class="kaart"><h3>' + esc(g.label) + ' <span class="meta">· ' + g.totaal + ' treffer(s) in ' + esc(g.domein) + '</span></h3>';
      if (g.afgekapt) u += '<p class="meta">Er is tot ' + g.afgekapt + ' rijen gekeken; daarboven is niet gescand.</p>';
      for (var j = 0; j < g.rijen.length; j++) {
        var r = g.rijen[j];
        u += '<div class="lijn"><button class="knop" data-t="' + esc(r.type) + '" data-i="' + esc(r.id) + '" style="border:none;padding:0;text-align:left;">' +
          '<b>' + esc(r.titel) + '</b></button>' +
          (r.sub ? ' <span class="meta">' + esc(r.sub) + '</span>' : '') +
          '<div class="meta">' + esc(r.type) + ' ' + esc(r.id) + ' · gevonden op ' + esc(r.veld) + '</div></div>';
      }
      if (g.totaal > g.rijen.length) u += '<p class="meta" style="margin-top:.5rem;">' +
        (g.totaal - g.rijen.length) + ' verder niet getoond.</p>';
      u += '</div>';
    }
    return u;
  }

  function bindTreffers() {
    document.querySelectorAll('#zuit [data-t]').forEach(function (b) {
      b.onclick = function () { openObject(b.dataset.t, b.dataset.i); };
    });
  }

  function openObject(type, id) {
    S.object = { type: type, id: id, data: null };
    C.ga('object');
  }
  C.openObject = openObject;

  /* Het objectdossier is geen eigen werkplek in de rail: je komt er vanuit een
     treffer, een uitzondering of een plan. Hij staat wel in TEKENAARS, zodat
     de schil hem net zo tekent als alle andere. */
  C.TEKENAARS.object = function (el) {
    var o = S.object;
    if (!o) { el.innerHTML = '<div class="leeg">Geen object gekozen.</div>'; return; }
    if (!o.data) {
      el.innerHTML = '<div class="leeg">Dossier laden…</div>';
      api('object', { type: o.type, id: o.id }).then(function (d) { o.data = d; C.teken(); })
        .catch(function (e) { if (!e.stil) el.innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
      return;
    }
    var d = o.data;
    var u = '<button class="knop" id="terugZoek">← terug naar de zoekuitslag</button>' +
      '<h2 class="ckop" style="margin-top:.9rem;">' + esc(d.object.titel) + '</h2>' +
      '<p class="lead">' + esc(d.object.label) + ' ' + esc(d.object.id) +
      (d.object.sub ? ' · ' + esc(d.object.sub) : '') + ' · domein ' + esc(d.object.domein) + '</p>';

    u += '<div class="kaart"><h3>Wat er kan</h3>';
    if (!d.acties.length) u += '<p>Geen handelingen bekend voor deze soort.</p>';
    for (var i = 0; i < d.acties.length; i++) {
      var a = d.acties[i];
      u += '<div class="lijn"><b>' + esc(a.naam) + '</b> ' + C.niveau(a.niveau) +
        ' <span class="meta">risico ' + a.score + (a.vierOgen ? ' · vier ogen' : '') + '</span>' +
        '<div class="meta">' + esc(a.wat) + '</div>' +
        '<div class="meta">' + esc(a.waaromNiet || a.waarom) + '</div>' +
        (a.soort === 'runbook' && a.past ? '<div class="crij" style="margin-top:.45rem;">' +
          '<button class="knop" data-rb="' + esc(a.id) + '" data-droog="1">Droog draaien</button>' +
          '<button class="knop' + (a.niveau === 'auto' ? ' vol' : '') + '" data-rb="' + esc(a.id) + '">Uitvoeren</button></div>' : '') +
        '</div>';
    }
    u += '</div>';

    u += '<div class="kaart"><h3>Tijdlijn</h3>';
    if (!d.tijdlijn.length) u += '<p>Nog niets vastgelegd over dit object.</p>';
    for (var t = 0; t < Math.min(d.tijdlijn.length, 40); t++) {
      var r = d.tijdlijn[t];
      u += '<div class="lijn"><span class="meta">' + esc(C.tijd(r.at)) + '</span> · ' + esc(r.wat) +
        (r.door ? ' <span class="meta">door ' + esc(r.door) + '</span>' : '') +
        (r.niveau ? ' ' + C.niveau(r.niveau) : '') +
        (r.reden ? '<div class="meta">' + esc(r.reden) + '</div>' : '') + '</div>';
    }
    u += '</div>';

    u += '<div class="kaart"><h3>Hangt hieraan</h3>';
    if (!d.afhankelijkheden.length) u += '<p>Geen enkel ander object verwijst naar dit object.</p>';
    for (var g = 0; g < d.afhankelijkheden.length; g++) {
      var gr = d.afhankelijkheden[g];
      u += '<div class="lijn"><b>' + esc(gr.label) + '</b> <span class="meta">' + gr.totaal + ' · ' + esc(gr.domein) + '</span><div class="meta">' +
        gr.rijen.map(function (x) { return '<button class="knop" data-t="' + esc(x.type) + '" data-i="' + esc(x.id) + '" style="border:none;padding:0;font-size:.8rem;">' + esc(x.titel) + '</button> (via ' + esc(x.via) + ')'; }).join(' · ') +
        '</div></div>';
    }
    if (d.afhankelijkhedenOnvolledig) u += '<p class="meta" style="margin-top:.5rem;">Let op: minstens één collectie is groter dan de scangrens. Deze lijst is daarmee niet volledig.</p>';
    u += '</div>';

    u += '<div class="kaart"><h3>De feiten</h3><div class="schuif"><table class="ctab"><tbody>';
    for (var f = 0; f < d.feiten.length; f++) {
      u += '<tr><th style="width:11rem;">' + esc(d.feiten[f].veld) + '</th><td>' +
        esc(d.feiten[f].waarde) + (d.feiten[f].kluis ? ' <span class="meta">(alleen via de kluis, met reden en spoor)</span>' : '') + '</td></tr>';
    }
    u += '</tbody></table></div></div>';
    el.innerHTML = u;

    document.querySelector('#terugZoek').onclick = function () { C.ga('zoek'); };
    el.querySelectorAll('[data-t]').forEach(function (b) {
      b.onclick = function () { openObject(b.dataset.t, b.dataset.i); };
    });
    el.querySelectorAll('[data-rb]').forEach(function (b) {
      b.onclick = function () {
        var droog = b.dataset.droog === '1';
        var reden = droog ? 'droogloop vanuit het objectdossier' : prompt('Waarom voert u dit uit? (komt in het journaal)');
        if (!droog && !reden) return;
        api('runbook/voer', { id: b.dataset.rb, droog: droog, reden: reden, alleen: [o.id], menselijkAkkoord: !droog })
          .then(function (r) {
            C.meld((droog ? 'Droog: ' : 'Uitgevoerd: ') + r.run.geraakt + ' geval(len).');
            o.data = null; return C.ververs();
          }).then(function () { C.teken(); })
          .catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
  };
})();
/* RTG Command, deel 4: de operator en de uitzonderingenrij.

   DE OPERATOR IS DE HELE BELOFTE IN ÉÉN SCHERM. U stelt een vraag in gewone
   taal, u krijgt een gemeten antwoord met oorzaken, en daarna één knop: doe de
   veilige gevallen en geef mij de uitzonderingen.

   WAT ER MET OPZET NIET IS: een knop "doe alles". De uitzonderingen zijn er
   niet omdat de machine ze nog niet kan, maar omdat het beleid zegt dat ze een
   mens vragen. Een knop die daaroverheen gaat, maakt het beleid tot decoratie.

   DE UITZONDERINGENRIJ toont wat de automatisering echt niet zelf kon. Elke
   zaak draagt zijn bewijs: wat de machine zag, en waarom hij het niet deed. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, S = C.S, api = C.api;

  var VOORBEELDEN = [
    'waarom loopt mobiliteit achter?',
    'wat staat er open in de handel?',
    'welke boekingen zijn afgebroken?',
    'wat kan er nu veilig hersteld worden?'
  ];

  C.TEKENAARS.operator = function (el) {
    var u = '<h2 class="ckop">Operator</h2>' +
      '<p class="lead">Vraag het in gewone taal. Het antwoord is gerekend uit de gegevens: hoeveel gevallen, ' +
      'welke oorzaken, hoeveel de machine veilig mag doen en wat een mens moet beoordelen. ' +
      'De AI verwoordt hooguit; hij kiest niet wat er gebeurt.</p>' +
      '<div class="kaart">' +
      '<textarea class="veld" id="opq" placeholder="Bijvoorbeeld: waarom loopt mobiliteit in Haarlem achter?"></textarea>' +
      '<div class="crij" style="margin-top:.6rem;"><button class="knop vol" id="opGa">Vraag het</button>' +
      VOORBEELDEN.map(function (v) { return '<button class="knop" data-vb="' + esc(v) + '">' + esc(v) + '</button>'; }).join('') +
      '</div></div><div id="opuit"></div>';
    el.innerHTML = u;

    document.querySelector('#opGa').onclick = vraag;
    el.querySelectorAll('[data-vb]').forEach(function (b) {
      b.onclick = function () { document.querySelector('#opq').value = b.dataset.vb; vraag(); };
    });
    if (S.plan) toonPlan(S.plan);

    function vraag() {
      var q = document.querySelector('#opq').value.trim();
      if (!q) { C.meld('Stel eerst een vraag.'); return; }
      document.querySelector('#opuit').innerHTML = '<div class="leeg">De operator rekent…</div>';
      api('operator/plan', { q: q }).then(function (d) { S.plan = d.plan; toonPlan(d.plan); })
        .catch(function (e) { if (!e.stil) document.querySelector('#opuit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
    }
  };

  function toonPlan(p) {
    var u = '<div class="kaart"><h3>Het antwoord</h3><p style="color:var(--txt);font-size:.95rem;line-height:1.7;">' +
      esc(p.tekst) + '</p>' +
      '<div class="crij" style="margin-top:.9rem;">' +
      (p.veilig && !p.uitgevoerd ? '<button class="knop vol" id="opDoe">Doe de veilige ' + p.veilig + ' en geef mij de uitzonderingen</button>' : '') +
      (p.uitgevoerd ? '<span class="meta">Dit plan is uitgevoerd.</span>' : '') +
      '</div></div>';

    for (var i = 0; i < p.delen.length; i++) {
      var d = p.delen[i];
      u += '<div class="kaart"><h3>' + esc(d.naam) + ' <span class="meta">· ' + d.totaal + ' geval(len) in ' + esc(d.domein) + '</span></h3>';
      if (d.oorzaakVeld) {
        u += '<p>Gemeten oorzaak: het veld <b>' + esc(d.oorzaakVeld) + '</b>.</p><div class="meta" style="margin-top:.35rem;">' +
          d.oorzaken.map(function (o) { return o.aantal + '× ' + esc(o.waarde); }).join(' · ') + '</div>';
      } else {
        u += '<p class="meta">Geen enkel veld verklaart deze gevallen samen; ze hebben geen gedeelde oorzaak.</p>';
      }
      u += '<div class="crij" style="margin-top:.7rem;">' +
        '<span class="meta">veilig ' + d.veilig + '</span><span class="meta">· met hulp ' + d.hulp + '</span>' +
        '<span class="meta">· mens ' + d.mens + '</span>' +
        (d.overgeslagen ? '<span class="meta">· ' + d.overgeslagen + ' boven de rondegrens</span>' : '') +
        '</div>' +
        '<div class="meta" style="margin-top:.4rem;">Stapeloordeel: risico ' + d.stapeloordeel.score + ' -- ' + esc(d.stapeloordeel.waarom) + '</div>';
      if (d.uitzonderingen.length) {
        u += '<div style="margin-top:.7rem;"><b style="font-size:.85rem;">Uitzonderingen</b>';
        for (var j = 0; j < d.uitzonderingen.length; j++) {
          var x = d.uitzonderingen[j];
          u += '<div class="lijn"><button class="knop" data-t="' + esc(d.type) + '" data-i="' + esc(x.id) + '" style="border:none;padding:0;">' +
            esc(x.titel) + '</button> <span class="meta">risico ' + x.score + ' -- ' + esc(x.waarom) + '</span></div>';
        }
        u += '</div>';
      }
      u += '</div>';
    }
    document.querySelector('#opuit').innerHTML = u;

    var doe = document.querySelector('#opDoe');
    if (doe) doe.onclick = function () {
      var reden = prompt('Waarom voert u dit uit? (komt in het journaal)');
      if (!reden) return;
      doe.disabled = true;
      api('operator/uitvoeren', { plan: p.id, reden: reden }).then(function (r) {
        C.meld(r.hersteld + ' hersteld, ' + r.zaken + ' uitzondering(en) als zaak geopend.');
        S.plan.uitgevoerd = true;
        return C.ververs();
      }).then(function () { C.ga('zaken'); })
        .catch(function (e) { doe.disabled = false; if (!e.stil) C.meld(e.message); });
    };
    document.querySelectorAll('#opuit [data-t]').forEach(function (b) {
      b.onclick = function () { C.openObject(b.dataset.t, b.dataset.i); };
    });
  }

  /* ---- de uitzonderingenrij ---- */
  C.TEKENAARS.zaken = function (el) {
    el.innerHTML = '<h2 class="ckop">Uitzonderingen</h2>' +
      '<p class="lead">Alleen wat de automatisering niet zelfstandig kon afhandelen. Elke zaak heeft een eigenaar, ' +
      'een termijn en straks een besluit -- en dat besluit is het lesmateriaal voor de volgende automatiseringsronde.</p>' +
      '<div id="zkuit"><div class="leeg">Laden…</div></div>';
    api('zaken', { max: 60 }).then(function (d) {
      document.querySelector('#zkuit').innerHTML = rij(d);
      bind(d);
    }).catch(function (e) { if (!e.stil) document.querySelector('#zkuit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
  };

  function rij(d) {
    var t = d.tellingen;
    var u = '<div class="rooster">' +
      '<div class="tegel"><div class="l">Open</div><div class="v">' + t.open + '</div><div class="u">' + t.zonderEigenaar + ' zonder eigenaar</div></div>' +
      '<div class="tegel"><div class="l">Over de termijn</div><div class="v ' + (t.overTermijn ? 'acc' : 'groen') + '">' + t.overTermijn + '</div><div class="u">van de open zaken</div></div>' +
      '<div class="tegel"><div class="l">Afgehandeld</div><div class="v">' + t.afgehandeld + '</div><div class="u">' + t.opTijdAfgehandeld + ' daarvan op tijd</div></div>' +
      '</div>';
    if (d.leerpunten && d.leerpunten.length) {
      u += '<div class="kaart"><h3>Wat zich herhaalt</h3><p>Deze besluiten vielen meermaals hetzelfde uit. Dat is een runbook dat nog niet bestaat.</p>';
      for (var i = 0; i < d.leerpunten.length; i++) {
        var l = d.leerpunten[i];
        u += '<div class="lijn"><b>' + esc(l.oorzaak) + ' → ' + esc(l.besluit) + '</b> <span class="meta">' + l.aantal + '×</span>' +
          '<div class="meta">' + esc(l.voorstel) + '</div></div>';
      }
      u += '</div>';
    }
    if (!d.zaken.length) return u + '<div class="leeg">Geen uitzonderingen. Alles wat er was, is automatisch afgehandeld.</div>';
    for (var z = 0; z < d.zaken.length; z++) {
      var k = d.zaken[z];
      u += '<div class="kaart" data-zaak="' + esc(k.id) + '"><h3>' + esc(k.titel) + '</h3>' +
        '<p class="meta">' + esc(k.domein) + ' · oorzaak: ' + esc(k.oorzaak) + ' · geopend ' + esc(C.tijd(k.at)) +
        ' · termijn ' + esc(C.tijd(k.termijn)) + (k.risico != null ? ' · risico ' + k.risico : '') + '</p>' +
        '<p class="meta">Status: ' + esc(k.status) + (k.eigenaar ? ' · eigenaar ' + esc(k.eigenaar) : ' · nog geen eigenaar') + '</p>' +
        (k.objectType ? '<p class="meta">Object: <button class="knop" data-t="' + esc(k.objectType) + '" data-i="' + esc(k.objectId) + '" style="border:none;padding:0;font-size:.78rem;">' + esc(k.objectType) + ' ' + esc(k.objectId) + '</button></p>' : '') +
        (k.bewijs ? '<p class="meta">Bewijs: ' + esc(JSON.stringify(k.bewijs).slice(0, 220)) + '</p>' : '') +
        (k.besluit ? '<p class="meta">Besluit: ' + esc(k.besluit.keuze) + ' -- ' + esc(k.besluit.reden) + ' (' + esc(k.besluit.door) + ')</p>'
          : '<div class="crij" style="margin-top:.6rem;">' +
            (k.eigenaar ? '' : '<button class="knop" data-neem="' + esc(k.id) + '">Ik pak hem op</button>') +
            '<input class="veld" data-keuze="' + esc(k.id) + '" placeholder="besluit (bv. hersteld, afgewezen)" style="min-width:12rem;">' +
            '<input class="veld" data-reden="' + esc(k.id) + '" placeholder="waarom" style="min-width:14rem;flex:1;">' +
            '<button class="knop vol" data-besluit="' + esc(k.id) + '">Besluiten</button></div>') +
        '</div>';
    }
    return u;
  }

  function bind() {
    document.querySelectorAll('#zkuit [data-neem]').forEach(function (b) {
      b.onclick = function () {
        api('zaak/neem', { id: b.dataset.neem }).then(function () { C.meld('Opgepakt.'); return C.ververs(); })
          .then(function () { C.teken(); }).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
    document.querySelectorAll('#zkuit [data-besluit]').forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.besluit;
        var keuze = document.querySelector('[data-keuze="' + id + '"]').value;
        var reden = document.querySelector('[data-reden="' + id + '"]').value;
        api('zaak/besluit', { id: id, keuze: keuze, reden: reden })
          .then(function () { C.meld('Besloten.'); return C.ververs(); })
          .then(function () { C.teken(); }).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
    document.querySelectorAll('#zkuit [data-t]').forEach(function (b) {
      b.onclick = function () { C.openObject(b.dataset.t, b.dataset.i); };
    });
  }
})();
/* RTG Command, deel 5: het herstel -- de runbooks, de rondes en de terugzetknop.

   DROOG DRAAIEN STAAT LINKS VAN UITVOEREN, en dat is geen opmaakkeuze. De
   volgorde van de knoppen is de volgorde van het werk: eerst zien wat er zou
   gebeuren, dan pas doen. Een runbook waarvan niemand ooit de droogloop heeft
   gelezen, is een knop waarvan niemand weet wat hij doet.

   ELKE RONDE IS TERUG TE DRAAIEN ZOLANG NIEMAND ANDERS ERAAN ZAT. De kern zet
   alleen terug wat nog de waarde heeft die de ronde erin zette; wat sindsdien
   door iemand anders is gewijzigd, blijft staan en wordt geteld als
   overgeslagen. Zo wist een terugdraaiing nooit stilletjes andermans werk. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api;

  C.TEKENAARS.herstel = function (el) {
    el.innerHTML = '<h2 class="ckop">Herstel</h2>' +
      '<p class="lead">Vooraf goedgekeurde herstelrecepten. Wat een runbook mag doen, hangt niet aan de knop maar ' +
      'aan het beleid van dit moment: dezelfde handeling is autonoom bij één geval en mensenwerk bij honderd.</p>' +
      '<div id="hbuit"><div class="leeg">Laden…</div></div>';
    laad();
  };

  function laad() {
    Promise.all([api('runbooks'), api('runs', { n: 15 })]).then(function (r) {
      document.querySelector('#hbuit').innerHTML = teken(r[0].runbooks, r[1].runs);
      bind();
    }).catch(function (e) { if (!e.stil) document.querySelector('#hbuit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
  }

  function teken(runbooks, runs) {
    var u = '';
    for (var i = 0; i < runbooks.length; i++) {
      var rb = runbooks[i];
      u += '<div class="kaart"><h3>' + esc(rb.naam) + ' ' + C.niveau(rb.oordeel.niveau) + '</h3>' +
        '<p>' + esc(rb.wat) + '</p>' +
        '<p class="meta" style="margin-top:.45rem;">Zet <b>' + esc(rb.veld) + '</b> op <b>' + esc(rb.naar) + '</b> · ' +
        (rb.terugDraaibaar ? 'terug te draaien' : 'NIET terug te draaien') +
        (rb.klantImpact ? ' · de klant merkt dit' : ' · geen klantimpact') + '</p>' +
        '<p class="meta">Risico ' + rb.oordeel.score + ' -- ' + esc(rb.oordeel.waarom) + '</p>' +
        '<div class="crij" style="margin-top:.7rem;align-items:baseline;">' +
        '<b style="font-family:\'Bodoni Moda\',Georgia,serif;font-size:1.3rem;">' + rb.kandidaten + '</b>' +
        '<span class="meta">geval(len) passen nu</span>' +
        (rb.kandidaten ? '<button class="knop" data-droog="' + esc(rb.id) + '">Droog draaien</button>' +
          '<button class="knop' + (rb.oordeel.niveau === 'auto' ? ' vol' : '') + '" data-voer="' + esc(rb.id) + '">Uitvoeren</button>' : '') +
        '</div>' +
        (rb.oordeel.niveau === 'hand' && rb.kandidaten ? '<p class="meta" style="margin-top:.5rem;">Dit runbook staat op handmatig: uitvoeren vraagt uw expliciete akkoord en komt als zodanig in het journaal.</p>' : '') +
        '<div class="meta" id="droog-' + esc(rb.id) + '"></div></div>';
    }

    u += '<h2 class="ckop" style="font-size:1.15rem;margin:1.6rem 0 .7rem;">De laatste rondes</h2>';
    if (!runs.length) u += '<div class="leeg">Er is nog geen herstelronde gedraaid.</div>';
    for (var j = 0; j < runs.length; j++) {
      var r = runs[j];
      u += '<div class="kaart"><h3>' + esc(r.naam) + ' <span class="meta">· ' + esc(C.tijd(r.at)) + '</span></h3>' +
        '<p class="meta">' + (r.droog ? 'droogloop' : 'uitgevoerd') + ' door ' + esc(r.door) + ' · ' +
        r.geraakt + ' van ' + r.totaalKandidaten + ' · ' + C.niveau(r.niveau) + ' · risico ' + C.getal(r.score) +
        (r.reden ? ' · ' + esc(r.reden) : '') + '</p>' +
        (r.voorbeelden && r.voorbeelden.length ? '<div class="meta" style="margin-top:.4rem;">' +
          r.voorbeelden.map(function (v) { return esc(v.titel) + ': ' + esc(v.van) + ' → ' + esc(v.naar); }).join('<br>') +
          (r.geraakt > r.voorbeelden.length ? '<br>… en nog ' + (r.geraakt - r.voorbeelden.length) : '') + '</div>' : '') +
        (r.droog ? '' : r.teruggedraaid
          ? '<p class="meta" style="margin-top:.5rem;">Teruggedraaid door ' + esc(r.terugDoor) + '.</p>'
          : '<div class="crij" style="margin-top:.6rem;"><button class="knop weg" data-terug="' + esc(r.id) + '">Terugzetten naar de vorige toestand</button></div>') +
        '</div>';
    }
    return u;
  }

  function bind() {
    document.querySelectorAll('[data-droog]').forEach(function (b) {
      b.onclick = function () {
        api('runbook/voer', { id: b.dataset.droog, droog: true }).then(function (r) {
          var vak = document.querySelector('#droog-' + b.dataset.droog);
          vak.innerHTML = '<div style="margin-top:.6rem;border-top:1px solid var(--line);padding-top:.5rem;">' +
            '<b>Droogloop:</b> ' + r.run.geraakt + ' van ' + r.run.totaalKandidaten + ' geval(len) zouden veranderen.<br>' +
            r.run.voorbeelden.map(function (v) { return esc(v.titel) + ': ' + esc(v.van) + ' → ' + esc(v.naar); }).join('<br>') +
            (r.overgeslagen ? '<br>' + r.overgeslagen + ' vallen buiten deze ronde.' : '') + '</div>';
        }).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
    document.querySelectorAll('[data-voer]').forEach(function (b) {
      b.onclick = function () {
        var reden = prompt('Waarom voert u dit herstel uit? (komt in het journaal)');
        if (!reden) return;
        api('runbook/voer', { id: b.dataset.voer, droog: false, reden: reden, menselijkAkkoord: true })
          .then(function (r) { C.meld(r.run.geraakt + ' geval(len) hersteld.'); return C.ververs(); })
          .then(laad).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
    document.querySelectorAll('[data-terug]').forEach(function (b) {
      b.onclick = function () {
        var reden = prompt('Waarom draait u deze ronde terug?');
        if (!reden) return;
        api('runbook/terug', { run: b.dataset.terug, reden: reden })
          .then(function (r) { C.meld(r.teruggezet + ' teruggezet, ' + r.overgeslagen + ' overgeslagen (daar zat iemand anders aan).'); return C.ververs(); })
          .then(laad).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
  }
})();
/* RTG Command, deel 6: het beleid en de simulatie.

   HET BELEID IS EEN GEGEVEN, GEEN CODE. Elke regel heeft een versie, een
   herkomst en een reden; terugzetten is de volgende versie en niet het wissen
   van de vorige. Wie een regel met vier ogen wijzigt, doet een VOORSTEL -- en
   kan het niet zelf goedkeuren. Dat wordt op de server afgedwongen, niet hier:
   een grendel die alleen in de knop zit, is er niet.

   DE SIMULATIE STAAT ERNAAST EN NIET ERACHTER. Elke regel heeft een knop
   "proef" die laat zien wat de nieuwe waarde met de routering doet vóórdat hij
   gezet wordt. De proef rekent met een schaduw-beleid en raakt de echte regel
   gegarandeerd niet aan. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api;

  C.TEKENAARS.beleid = function (el) {
    el.innerHTML = '<h2 class="ckop">Beleid</h2>' +
      '<p class="lead">De operationele regels van RTG op één plek, met versies en een knop terug. ' +
      'Zware regels vragen twee paar ogen; de server weigert een goedkeuring van dezelfde persoon die het voorstel deed.</p>' +
      '<div id="bluit"><div class="leeg">Laden…</div></div>';
    laad();
  };

  function laad() {
    api('beleid').then(function (d) {
      document.querySelector('#bluit').innerHTML = teken(d);
      bind();
    }).catch(function (e) { if (!e.stil) document.querySelector('#bluit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
  }

  function teken(d) {
    var u = '';
    var open = d.voorstellen.filter(function (v) { return v.status === 'wacht'; });
    if (open.length) {
      u += '<div class="kaart"><h3>Wachten op een tweede paar ogen</h3>';
      for (var i = 0; i < open.length; i++) {
        var v = open[i];
        u += '<div class="lijn"><b>' + esc(v.wat) + '</b>' +
          '<div class="meta">' + esc(String(v.van)) + ' → ' + esc(String(v.naar)) + ' · voorgesteld door ' + esc(v.door) +
          ' op ' + esc(C.tijd(v.at)) + '</div>' +
          '<div class="meta">Reden: ' + esc(v.reden) + '</div>' +
          '<div class="crij" style="margin-top:.45rem;">' +
          '<input class="veld" data-kr="' + esc(v.id) + '" placeholder="uw oordeel, kort" style="flex:1;min-width:12rem;">' +
          '<button class="knop vol" data-keur="' + esc(v.id) + '" data-ja="1">Goedkeuren</button>' +
          '<button class="knop weg" data-keur="' + esc(v.id) + '">Afwijzen</button></div></div>';
      }
      u += '</div>';
    }

    for (var r = 0; r < d.regels.length; r++) {
      var g = d.regels[r];
      u += '<div class="kaart"><h3>' + esc(g.wat) + '</h3>' +
        '<p class="meta">' + esc(g.id) + ' · versie ' + g.versie + ' van ' + g.versies +
        (g.sinds ? ' · sinds ' + esc(C.tijd(g.sinds)) + ' door ' + esc(g.door) : ' · startwaarde') +
        (g.vierOgen ? ' · vier ogen vereist' : '') + '</p>' +
        '<div class="crij" style="margin-top:.6rem;align-items:baseline;">' +
        '<b style="font-family:\'Bodoni Moda\',Georgia,serif;font-size:1.4rem;">' + esc(String(g.waarde)) + '</b>' +
        '<span class="meta">' + esc(g.eenheid) + '</span>' +
        '<input class="veld" data-nw="' + esc(g.id) + '" placeholder="nieuwe waarde" style="width:8rem;">' +
        '<input class="veld" data-rd="' + esc(g.id) + '" placeholder="reden" style="flex:1;min-width:11rem;">' +
        '<button class="knop" data-proef="' + esc(g.id) + '">Proef</button>' +
        '<button class="knop vol" data-zet="' + esc(g.id) + '">Zetten</button>' +
        (g.versies > 1 ? '<button class="knop weg" data-terug="' + esc(g.id) + '">Eén terug</button>' : '') +
        '</div><div class="meta" id="proef-' + esc(g.id).replace(/\./g, '_') + '"></div></div>';
    }
    return u;
  }

  function proefvak(id) { return document.querySelector('#proef-' + id.replace(/\./g, '_')); }

  function bind() {
    document.querySelectorAll('[data-proef]').forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.proef;
        var w = document.querySelector('[data-nw="' + id + '"]').value;
        if (w === '') { C.meld('Vul eerst een nieuwe waarde in.'); return; }
        api('simulatie/beleid', { id: id, waarde: isNaN(Number(w)) ? w : Number(w) }).then(function (d) {
          proefvak(id).innerHTML = '<div style="margin-top:.6rem;border-top:1px solid var(--line);padding-top:.5rem;">' +
            '<b>Proef zonder te zetten:</b> ' + esc(d.gevolg) +
            (d.risicoWaarschuwing ? '<br><span style="color:var(--acc);">' + esc(d.risicoWaarschuwing) + '</span>' : '') +
            (d.wijzigingen.length ? '<br>' + d.wijzigingen.map(function (x) {
              return esc(x.naam) + ': ' + esc(x.van) + ' → ' + esc(x.naar) + ' (' + x.kandidaten + ' geval(len))'; }).join('<br>') : '') +
            '</div>';
        }).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
    document.querySelectorAll('[data-zet]').forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.zet;
        var w = document.querySelector('[data-nw="' + id + '"]').value;
        var rd = document.querySelector('[data-rd="' + id + '"]').value;
        if (w === '') { C.meld('Vul een nieuwe waarde in.'); return; }
        var waarde = w === 'true' ? true : w === 'false' ? false : isNaN(Number(w)) ? w : Number(w);
        api('beleid/zet', { id: id, waarde: waarde, reden: rd }).then(function (d) {
          C.meld(d.vierOgen ? 'Voorstel ingediend; iemand anders moet het goedkeuren.' : 'Gezet, versie ' + d.versie + '.');
          return C.ververs();
        }).then(laad).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
    document.querySelectorAll('[data-terug]').forEach(function (b) {
      b.onclick = function () {
        var reden = prompt('Waarom zet u deze regel terug?');
        if (!reden) return;
        api('beleid/terug', { id: b.dataset.terug, reden: reden })
          .then(function (d) { C.meld('Terug naar versie ' + d.terugNaar + '.'); return C.ververs(); })
          .then(laad).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
    document.querySelectorAll('[data-keur]').forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.keur;
        api('beleid/keur', { voorstel: id, akkoord: b.dataset.ja === '1',
          reden: document.querySelector('[data-kr="' + id + '"]').value })
          .then(function () { C.meld('Beoordeeld.'); return C.ververs(); })
          .then(laad).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    });
  }

  /* ---- de digitale tweeling ---- */
  C.TEKENAARS.simulatie = function (el) {
    el.innerHTML = '<h2 class="ckop">Simulatie</h2>' +
      '<p class="lead">Wat gebeurt er als het volume verandert? Dit rekent lineair door op de werkelijke aantallen, ' +
      'met een knik in de wachttijd boven 85% bezetting. De aannames staan in de uitslag -- een voorspelling zonder ' +
      'zichtbare aannames is een mening met cijfers eromheen.</p>' +
      '<div class="kaart"><div class="crij">' +
      '<label class="lb" style="margin:0;">Groei %</label><input class="veld" id="simG" value="30" style="width:5.5rem;">' +
      '<label class="lb" style="margin:0;">Plaats (optioneel)</label><input class="veld" id="simP" placeholder="bv. Amsterdam" style="width:11rem;">' +
      '<label class="lb" style="margin:0;">Capaciteit erbij</label><input class="veld" id="simC" value="0" style="width:5.5rem;">' +
      '<button class="knop vol" id="simGa">Reken door</button></div></div><div id="simuit"></div>';
    document.querySelector('#simGa').onclick = function () {
      api('simulatie/watals', { groei: Number(document.querySelector('#simG').value || 0),
        plaats: document.querySelector('#simP').value, capaciteit: Number(document.querySelector('#simC').value || 0) })
        .then(function (d) { document.querySelector('#simuit').innerHTML = simTeken(d); })
        .catch(function (e) { if (!e.stil) C.meld(e.message); });
    };
  };

  function simTeken(d) {
    var u = '<div class="kaart"><h3>' + esc(d.vraag) + '</h3>' +
      '<p>' + (d.knelpunten.length ? 'Knelpunt bij: <b>' + esc(d.knelpunten.join(', ')) + '</b>.' : 'Geen enkel domein komt boven 85% bezetting.') +
      ' Er komen ' + d.extraUitzonderingen + ' extra uitzonderingen bij; dat is ongeveer ' + d.extraMensuren + ' mensuur.</p>' +
      '<p class="meta" style="margin-top:.5rem;">Model: ' + esc(d.model) + '</p></div>';
    u += '<div class="kaart"><div class="schuif"><table class="ctab"><thead><tr><th>Domein</th><th>Volume nu</th><th>Straks</th>' +
      '<th>Bezetting</th><th>Wachtindex</th><th>Uitzonderingen</th></tr></thead><tbody>';
    for (var i = 0; i < d.regels.length; i++) {
      var r = d.regels[i];
      u += '<tr><td>' + esc(r.domein) + (r.knelpunt ? ' <span class="cniveau hand">knelpunt</span>' : '') + '</td>' +
        '<td>' + r.volume.nu + '</td><td>' + r.volume.straks + '</td>' +
        '<td>' + r.bezetting.nu + '% → ' + r.bezetting.straks + '%</td>' +
        '<td>' + r.wachtindex.nu + ' → ' + r.wachtindex.straks + '</td>' +
        '<td>' + r.uitzonderingen.nu + ' → ' + r.uitzonderingen.straks + '</td></tr>';
    }
    u += '</tbody></table></div></div>';
    u += '<div class="kaart"><h3>De aannames</h3>';
    for (var a = 0; a < d.aannames.length; a++) {
      u += '<div class="lijn"><b>' + esc(d.aannames[a].wat) + '</b><div class="meta">Gevolg: ' + esc(d.aannames[a].gevolg) + '</div></div>';
    }
    u += '</div>';
    return u;
  }
})();
/* RTG Command, deel 7: het toezicht -- agents en tijdelijke rechten.

   DIT IS ÉÉN SCHERM EN GEEN TWEE, en dat is met opzet. Een agent-budget en een
   tijdelijk mensenrecht zijn dezelfde vraag in twee vormen: wie mag nu hoeveel,
   en tot wanneer? Ze uit elkaar trekken zou betekenen dat je bij een incident op
   twee plekken moet kijken om te weten wie er aan de knoppen zat.

   DE VERVALDATUM IS DE KERN. Er is niets hier dat blijft staan: alles heeft een
   `tot`, ook de nooddeur. Er valt dus ook niets te vergeten in te trekken --
   het verlopen is de standaardtoestand en het geldig zijn de uitzondering.

   De twee spiegels (werkbesparing en journaal) staan in ./command-08.js. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api;

  /* ---- toezicht: agents en tijdelijke rechten ---- */
  C.TEKENAARS.toezicht = function (el) {
    el.innerHTML = '<h2 class="ckop">Toezicht</h2>' +
      '<p class="lead">Wie mag nu wat, en tot wanneer? Agents dragen budgetten per uur en per dag en worden ' +
      'gestopt zodra ze vaker misgaan dan goed gaan. Zware mensenrechten hebben een vervaldatum -- er is niets ' +
      'dat blijft staan, dus er valt ook niets te vergeten in te trekken.</p>' +
      '<div id="tzuit"><div class="leeg">Laden…</div></div>';
    laadToezicht();
  };

  function laadToezicht() {
    Promise.all([api('agents'), api('rechten')]).then(function (r) {
      document.querySelector('#tzuit').innerHTML = tzTeken(r[0].agents, r[1]);
      tzBind();
    }).catch(function (e) { if (!e.stil) document.querySelector('#tzuit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
  }

  function tzTeken(agents, rechten) {
    var u = '<h2 class="ckop" style="font-size:1.15rem;margin-bottom:.7rem;">Agents</h2>';
    if (!agents.length) u += '<div class="kaart"><p>Er heeft nog geen agent gehandeld. Er staan dus geen budgetten open -- dat is een uitslag, geen ontbrekende meting.</p></div>';
    for (var i = 0; i < agents.length; i++) {
      var a = agents[i];
      u += '<div class="kaart"><h3>' + esc(a.naam) + (a.gestopt ? ' <span class="cniveau hand">gestopt</span>' : '') + '</h3>' +
        (a.gestopt ? '<p class="meta">Reden: ' + esc(a.stopReden) + '</p>' : '') +
        '<p class="meta">' + a.actiesDitUur + ' van ' + a.actiesMax + ' handelingen dit uur · ' +
        C.euro(a.centenVandaag) + ' van ' + C.euro(a.centenMax) + ' vandaag · foutkans ' + a.foutkans + '%</p>' +
        '<div class="staaf"><i style="width:' + Math.min(100, Math.round(a.actiesDitUur / a.actiesMax * 100)) + '%"></i></div>' +
        '<div class="crij" style="margin-top:.7rem;">' +
        (a.gestopt ? '<button class="knop" data-hervat="' + esc(a.naam) + '">Hervatten</button>'
          : '<button class="knop weg" data-stop="' + esc(a.naam) + '">Stoppen</button>') +
        '</div></div>';
    }

    u += '<h2 class="ckop" style="font-size:1.15rem;margin:1.6rem 0 .7rem;">Zware rechten</h2>';
    u += '<div class="kaart"><h3>Wat er tijdelijk te geven valt</h3>';
    for (var s = 0; s < rechten.soorten.length; s++) {
      var so = rechten.soorten[s];
      u += '<div class="lijn"><b>' + esc(so.id) + '</b> <span class="meta">· hooguit ' + so.maxMinuten + ' minuten · nu ' + so.nuActief + ' actief</span>' +
        '<div class="meta">' + esc(so.wat) + '</div>' +
        '<div class="crij" style="margin-top:.45rem;">' +
        '<input class="veld" data-aan="' + esc(so.id) + '" placeholder="aan wie" style="width:11rem;">' +
        '<input class="veld" data-rrd="' + esc(so.id) + '" placeholder="reden" style="flex:1;min-width:11rem;">' +
        '<button class="knop" data-geef="' + esc(so.id) + '">Tijdelijk geven</button>' +
        '<button class="knop weg" data-nood="' + esc(so.id) + '">Nooddeur</button></div></div>';
    }
    u += '</div>';

    u += '<div class="kaart"><h3>Nu actief</h3>';
    if (!rechten.actief.length) u += '<p>' + esc(rechten.uitleg || 'Geen actieve rechten.') + '</p>';
    for (var r = 0; r < rechten.actief.length; r++) {
      var x = rechten.actief[r];
      u += '<div class="lijn"><b>' + esc(x.recht) + '</b>' + (x.nood ? ' <span class="cniveau hand">nooddeur</span>' : '') +
        '<div class="meta">' + esc(x.aan) + ' · gegeven door ' + esc(x.door) + ' · tot ' + esc(C.tijd(x.tot)) + '</div>' +
        '<div class="meta">' + esc(x.reden) + '</div>' +
        '<div class="crij" style="margin-top:.4rem;"><button class="knop weg" data-introk="' + esc(x.id) + '">Nu intrekken</button></div></div>';
    }
    u += '<p class="meta" style="margin-top:.5rem;">' + rechten.verlopen + ' recht(en) zijn verlopen of ingetrokken; die staan in het journaal.</p></div>';
    return u;
  }

  function tzBind() {
    var doe = function (sel, pad, bouw, tekst) {
      document.querySelectorAll(sel).forEach(function (b) {
        b.onclick = function () {
          var body = bouw(b);
          if (!body) return;
          api(pad, body).then(function () { C.meld(tekst); return C.ververs(); })
            .then(laadToezicht).catch(function (e) { if (!e.stil) C.meld(e.message); });
        };
      });
    };
    doe('[data-stop]', 'agent/stop', function (b) {
      var r = prompt('Waarom stopt u deze agent?'); return r ? { naam: b.dataset.stop, reden: r } : null;
    }, 'Agent gestopt.');
    doe('[data-hervat]', 'agent/hervat', function (b) {
      var r = prompt('Waarom hervat u deze agent?'); return r ? { naam: b.dataset.hervat, reden: r } : null;
    }, 'Agent hervat.');
    doe('[data-geef]', 'recht/geef', function (b) {
      var id = b.dataset.geef;
      return { recht: id, aan: document.querySelector('[data-aan="' + id + '"]').value,
        reden: document.querySelector('[data-rrd="' + id + '"]').value };
    }, 'Tijdelijk recht gegeven.');
    doe('[data-nood]', 'recht/nood', function (b) {
      var id = b.dataset.nood;
      var r = document.querySelector('[data-rrd="' + id + '"]').value ||
        prompt('De nooddeur vraagt een volledige reden; die staat straks in het journaal.');
      return r ? { recht: id, reden: r } : null;
    }, 'Nooddeur open -- dit staat in het journaal en vervalt vanzelf.');
    doe('[data-introk]', 'recht/introk', function (b) {
      var r = prompt('Waarom trekt u dit recht in?'); return r ? { id: b.dataset.introk, reden: r } : null;
    }, 'Ingetrokken.');
  }
})();
/* RTG Command, deel 8: de werkbesparing en het journaal -- de twee spiegels.

   HET WERKBESPARINGSBORD IS BEWUST HET SCHERM WAAROP DEZE APP KAN ZAKKEN. Als
   de handminuten per duizend handelingen niet dalen, dan is er geen
   automatisering bijgekomen maar een dashboard. Daarom staat de onzekerheid van
   de meter erbij: de minutenprijzen zijn schattingen, en dat hoort een lezer te
   weten voordat hij er beleid op maakt.

   HET JOURNAAL is de andere spiegel: niet wat we van plan waren, maar wat er
   werkelijk gebeurde -- met de oude en de nieuwe toestand, de actor en de
   reden. De ketencontrole staat er bovenaan, want een auditspoor waarvan je de
   heelheid niet kunt nakijken, is een lijst die je op zijn woord moet geloven. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api;

  C.TEKENAARS.werk = function (el) {
    el.innerHTML = '<h2 class="ckop">Werkbesparing</h2>' +
      '<p class="lead">Deze app bestaat niet om duizend medewerkers een scherm te geven, maar om ervoor te zorgen ' +
      'dat er geen duizend nodig zijn. Dit is de meter waarop die belofte zichtbaar wordt -- of zichtbaar breekt.</p>' +
      '<div id="wkuit"><div class="leeg">Laden…</div></div>';
    api('werk', { dagen: 30 }).then(function (d) {
      document.querySelector('#wkuit').innerHTML = wkTeken(d.bord, d.opbrengst);
    }).catch(function (e) { if (!e.stil) document.querySelector('#wkuit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
  };

  function wkTeken(b, opbrengst) {
    var u = '<div class="rooster">' +
      '<div class="tegel"><div class="l">Handminuten per 1.000</div><div class="v">' + b.handminutenPer1000 + '</div><div class="u">over ' + b.handelingen + ' handelingen in ' + b.dagen + ' dagen</div></div>' +
      '<div class="tegel"><div class="l">Automatiseringsgraad</div><div class="v ' + (b.automatiseringsgraad >= 50 ? 'groen' : 'gold') + '">' + b.automatiseringsgraad + '%</div><div class="u">aandeel dat volledig autonoom liep</div></div>' +
      '<div class="tegel"><div class="l">Handwerk</div><div class="v">' + b.handUren + ' u</div><div class="u">' + b.bespaardeUren + ' uur niet gedaan doordat de machine het deed</div></div>' +
      '<div class="tegel"><div class="l">Lekken</div><div class="v ' + (b.lekken.length ? 'acc' : 'groen') + '">' + b.lekken.length + '</div><div class="u">werkstromen met volume die nog nooit autonoom liepen</div></div>' +
      '</div>';

    u += '<div class="kaart"><h3>Per werkstroom</h3><div class="schuif"><table class="ctab"><thead><tr>' +
      '<th>Handeling</th><th>Aantal</th><th>Handmatig</th><th>Assisted</th><th>Autonoom</th><th>Handuren</th><th>Graad</th></tr></thead><tbody>';
    for (var i = 0; i < b.werkstromen.length; i++) {
      var w = b.werkstromen[i];
      u += '<tr><td>' + esc(w.actie) + (w.lek ? ' <span class="cniveau hand">lek</span>' : '') + '</td>' +
        '<td>' + w.aantal + '</td><td>' + w.perNiveau.hand + '</td><td>' + w.perNiveau.assist + '</td>' +
        '<td>' + w.perNiveau.auto + '</td><td>' + w.handUren + '</td><td>' + w.automatiseringsgraad + '%</td></tr>';
    }
    if (!b.werkstromen.length) u += '<tr><td colspan="7" class="meta">Er is in deze periode nog niets genoteerd.</td></tr>';
    u += '</tbody></table></div><p class="meta" style="margin-top:.7rem;">' + esc(b.onzeker) + '</p></div>';

    if (b.kandidaten.length) {
      u += '<div class="kaart"><h3>Kandidaten voor de volgende ronde</h3>';
      for (var k = 0; k < b.kandidaten.length; k++) {
        u += '<div class="lijn"><b>' + esc(b.kandidaten[k].oorzaak) + ' → ' + esc(b.kandidaten[k].besluit) + '</b>' +
          '<div class="meta">' + esc(b.kandidaten[k].voorstel) + '</div></div>';
      }
      u += '</div>';
    }

    u += '<div class="kaart"><h3>Wat elk runbook oplevert</h3><div class="schuif"><table class="ctab"><thead><tr>' +
      '<th>Runbook</th><th>Gevallen</th><th>Niveau</th><th>Besparing</th><th>Wat het tegenhoudt</th></tr></thead><tbody>';
    for (var o = 0; o < opbrengst.length; o++) {
      var r = opbrengst[o];
      u += '<tr><td>' + esc(r.naam) + '</td><td>' + r.kandidaten + '</td><td>' + C.niveau(r.niveau) + '</td>' +
        '<td>' + r.besparingUren + ' u</td><td class="meta">' + esc(r.blokkade || 'niets -- dit loopt autonoom') + '</td></tr>';
    }
    u += '</tbody></table></div></div>';
    return u;
  }

  /* ---- het journaal ---- */
  C.TEKENAARS.journaal = function (el) {
    el.innerHTML = '<h2 class="ckop">Journaal</h2>' +
      '<p class="lead">Iedere menselijke én automatische handeling, met de oude en de nieuwe toestand, de actor, ' +
      'de reden en de gebruikte regel. Elke regel draagt de hash van de vorige; wie er middenin iets wijzigt, ' +
      'breekt de keten en dat is hieronder te zien.</p>' +
      '<div id="jruit"><div class="leeg">Laden…</div></div>';
    api('journaal', { n: 80 }).then(function (d) {
      document.querySelector('#jruit').innerHTML = jrTeken(d);
    }).catch(function (e) { if (!e.stil) document.querySelector('#jruit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; });
  };

  function jrTeken(d) {
    var u = '<div class="kaart"><h3>De keten</h3><p>' +
      (d.keten.heel
        ? 'Heel: ' + d.keten.regels + ' regels in het venster sluiten op elkaar aan. In totaal zijn er ' + d.aantal + ' regels genoteerd.'
        : 'BREUK bij regel ' + esc(d.keten.bij) + ': ' + esc(d.keten.waarom)) +
      '</p><p class="meta" style="margin-top:.4rem;">Dit bewijst dat de regels in het venster onderling kloppen. ' +
      'Het bewijst niet dat er niets vóór het venster is verdwenen -- daarvoor telt het totaal onafhankelijk mee.</p></div>';
    u += '<div class="kaart"><div class="schuif"><table class="ctab"><thead><tr><th>Wanneer</th><th>Wie</th><th>Wat</th>' +
      '<th>Niveau</th><th>Object</th><th>Voor → na</th><th>Reden</th></tr></thead><tbody>';
    for (var i = 0; i < d.regels.length; i++) {
      var r = d.regels[i];
      u += '<tr><td class="meta">' + esc(C.tijd(r.at)) + '</td><td>' + esc(r.actor) + '</td>' +
        '<td>' + esc(r.actie) + (r.uitslag !== 'gedaan' ? ' <span class="meta">(' + esc(r.uitslag) + ')</span>' : '') + '</td>' +
        '<td>' + C.niveau(r.niveau) + (r.risico != null ? ' <span class="meta">' + r.risico + '</span>' : '') + '</td>' +
        '<td class="meta">' + esc(r.objectType ? r.objectType + ' ' + r.objectId : '-') + '</td>' +
        '<td class="meta">' + esc(kort(r.voor)) + ' → ' + esc(kort(r.na)) + '</td>' +
        '<td class="meta">' + esc(r.reden) + '</td></tr>';
    }
    if (!d.regels.length) u += '<tr><td colspan="7" class="meta">Nog niets genoteerd.</td></tr>';
    u += '</tbody></table></div></div>';
    return u;
  }

  function kort(v) {
    if (v == null) return '-';
    if (typeof v !== 'object') return String(v);
    var s = Object.keys(v).map(function (k) { return k + '=' + v[k]; }).join(', ');
    return s.length > 90 ? s.slice(0, 90) + '…' : s;
  }
})();
/* RTG Command, deel 9: de gegevenskwaliteit en de kennisgraaf.

   TWEE SCHERMEN DIE OP DEZELFDE METING DRAAIEN. De kwaliteitslaag meet welk
   veld in de praktijk naar welke soort verwijst; daar komen de wezen uit (een
   verwijzing zonder doel) en daar komen de randen van de graaf uit. Dat is één
   meting, twee vragen -- en dus geen twee schema's die elkaar kunnen
   tegenspreken.

   ZEKER EN VERMOED STAAN APART, en dat is hier zichtbaar. Een dubbele sleutel
   is een feit; een waarde die één keer voorkomt terwijl de rest tientallen
   keren hetzelfde zegt, is een vermoeden. Ze in één lijst zetten zou het hele
   scherm de betrouwbaarheid van het zwakste onderdeel geven. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api, S = C.S;

  C.TEKENAARS.kwaliteit = function (el) {
    el.innerHTML = '<h2 class="ckop">Gegevenskwaliteit</h2>' +
      '<p class="lead">Niet wat er verkeerd staat, maar wat er kapot is: twee rijen met dezelfde sleutel, ' +
      'een rij zonder sleutel, een verwijzing naar iets dat niet bestaat. Dat valt zelden op -- tot iemand ' +
      'op de verkeerde rij klikt.</p><div id="kwuit"><div class="leeg">Meten…</div></div>';
    api('kwaliteit').then(function (d) {
      var u = '<div class="rooster">' +
        tegel('Defecten', d.tel.defecten, d.tel.defecten ? 'acc' : 'groen', 'zeker, over ' + d.tel.soorten + ' bevinding(en)') +
        tegel('Vermoedens', d.tel.vermoedens, d.tel.vermoedens ? 'gold' : '', 'mogelijk een typefout of een oude naam') +
        tegel('Objecten', d.gemeten.objecten, '', 'in ' + d.gemeten.soorten + ' soorten nagekeken') +
        '</div>';

      u += '<div class="kaart"><h3>Wat er zeker kapot is</h3>';
      if (!d.bevindingen.length) u += '<p>Niets. Elke sleutel is uniek en elke verwijzing komt ergens aan.</p>';
      for (var i = 0; i < d.bevindingen.length; i++) {
        var b = d.bevindingen[i];
        u += '<div class="lijn"><b>' + esc(b.label) + ' · ' + esc(b.wat) + '</b> <span class="meta">' + b.aantal + '×</span>' +
          '<div class="meta">' + esc(b.uitleg) + '</div>' +
          (b.voorbeelden && b.voorbeelden.length ? '<div class="meta">' + esc(b.voorbeelden.join(' · ')) + '</div>' : '') +
          '</div>';
      }
      u += '<p class="meta" style="margin-top:.6rem;">' + esc(d.gemeten.drempel) + '.' +
        (d.gemeten.onvolledig ? ' Let op: minstens één collectie is groter dan de scangrens, dus dit beeld is niet volledig.' : '') +
        '</p></div>';

      if (d.vermoedens.length) {
        u += '<div class="kaart"><h3>Vermoedens</h3><p>Dit zijn geen defecten. Ze staan apart omdat een meter ' +
          'die vermoedens als feiten telt, terecht wordt genegeerd.</p>';
        for (var v = 0; v < d.vermoedens.length; v++) {
          u += '<div class="lijn"><b>' + esc(d.vermoedens[v].label) + '</b> <span class="meta">' +
            esc(d.vermoedens[v].veld) + ' = ' + esc(d.vermoedens[v].waarde) + '</span>' +
            '<div class="meta">' + esc(d.vermoedens[v].uitleg) + '</div></div>';
        }
        u += '</div>';
      }
      document.querySelector('#kwuit').innerHTML = u;
    }).catch(function (e) {
      if (!e.stil) document.querySelector('#kwuit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
    });
  };

  function tegel(l, v, k, u) {
    return '<div class="tegel"><div class="l">' + esc(l) + '</div><div class="v ' + (k || '') + '">' + esc(v) + '</div>' +
      (u ? '<div class="u">' + esc(u) + '</div>' : '') + '</div>';
  }

  C.TEKENAARS.graaf = function (el) {
    el.innerHTML = '<h2 class="ckop">Kennisgraaf</h2>' +
      '<p class="lead">Hoe het geheel samenhangt, en wat er twee stappen verderop ligt. De randen zijn ' +
      'gemeten uit de gegevens en niet uit een schema: een veld heet pas een verwijzing als het in de praktijk ' +
      'vrijwel altijd een bestaande sleutel van een andere soort bevat.</p>' +
      '<div id="grUit"><div class="leeg">Meten…</div></div>';
    api('graaf').then(function (d) {
      var u = '<div class="kaart"><h3>De randen</h3>';
      if (!d.randen.length) u += '<p>Geen enkel veld verwijst meetbaar naar een andere soort.</p>';
      for (var i = 0; i < d.randen.length; i++) {
        var r = d.randen[i];
        u += '<div class="lijn"><b>' + esc(r.van) + '</b> <span class="meta">- ' + esc(r.veld) + ' →</span> <b>' +
          esc(r.naar) + '</b> <span class="meta">(' + Math.round(r.deel * 100) + '% raak)</span></div>';
      }
      u += '</div>';

      u += '<div class="kaart"><h3>De knopen</h3><div class="schuif"><table class="ctab"><thead><tr>' +
        '<th>Soort</th><th>Domein</th><th>Objecten</th></tr></thead><tbody>' +
        d.knopen.map(function (k) {
          return '<tr><td>' + esc(k.label) + '</td><td class="meta">' + esc(k.domein) + '</td><td>' + k.aantal + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        (d.losse.length ? '<p class="meta" style="margin-top:.6rem;">Los in de graaf (niets verwijst ernaar en ze verwijzen nergens heen): ' +
          esc(d.losse.join(', ')) + '. Dat is een uitslag, geen fout -- maar het is wel waar een koppeling zou kunnen ontbreken.</p>' : '') +
        '</div>';

      u += '<div class="kaart"><h3>Wandel vanaf een object</h3>' +
        '<div class="crij"><input class="veld" id="grT" placeholder="soort (bv. zaak)" style="width:9rem;">' +
        '<input class="veld" id="grI" placeholder="id" style="width:9rem;">' +
        '<input class="veld" id="grD" value="2" style="width:4rem;" aria-label="diepte">' +
        '<button class="knop vol" id="grGa">Wandel</button></div><div id="grPad"></div></div>';
      document.querySelector('#grUit').innerHTML = u;

      document.querySelector('#grGa').onclick = function () {
        api('graaf/wandel', { type: document.querySelector('#grT').value,
          id: document.querySelector('#grI').value, diepte: Number(document.querySelector('#grD').value || 2) })
          .then(function (w) {
            document.querySelector('#grPad').innerHTML =
              '<p class="meta" style="margin-top:.7rem;">Vanaf <b>' + esc(w.start.titel) + '</b>: ' +
              w.knopen + ' knopen tot diepte ' + w.diepte + (w.grens ? ' -- ' + esc(w.grens) : '') + '</p>' +
              w.lagen.map(function (l) {
                return '<div class="lijn"><b>stap ' + l.stap + '</b> <span class="meta">' + l.aantal + '</span>' +
                  '<div class="meta">' + esc(l.objecten.map(function (o) {
                    return o.type + ' ' + o.id + (o.via ? ' (via ' + o.via + ')' : '');
                  }).join(' · ')) + '</div></div>';
              }).join('');
          })
          .catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    }).catch(function (e) {
      if (!e.stil) document.querySelector('#grUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
    });
  };

  /* De twee werkplekken bij "Zien" hangen, want dat is wat ze zijn: kijken naar
     wat er is, niet eraan draaien. Ze staan achter de zoekbalk omdat je daar
     doorgaans op uitkomt vanuit een object. */
  var i = C.WERKPLEKKEN.findIndex(function (w) { return w.id === 'zoek'; });
  C.WERKPLEKKEN.splice(i + 1, 0,
    { id: 'kwaliteit', naam: 'Kwaliteit', sec: 'Zien',
      teller: function (s) { return s.start && s.start.kwaliteit ? s.start.kwaliteit.defecten : 0; } },
    { id: 'graaf', naam: 'Kennisgraaf', sec: 'Zien' });
  void S;
})();
/* RTG Command, deel 10: de servicedoelen met hun foutbudget, en de sonde.

   DIT SCHERM MAG NIET GERUSTSTELLEN ALS HET NIETS WEET. Dat is de hele reden
   dat het bestaat. De tellers achter deze cijfers beginnen bij elke herstart op
   nul; een vers proces met drie verzoeken en nul fouten staat op 100% en dat
   als "doel gehaald" tonen is de duurste leugen die hier kan staan. Vandaar de
   derde stand naast gehaald en niet gehaald: "onvoldoende gemeten", in een
   eigen kleur en met de reden erbij.

   EN BINNEN EN BUITEN STAAN APART. Wat de app over zichzelf telt, telt niets
   meer zodra de app plat ligt. De sonde klopt van buitenaf aan; die cijfers
   worden er nergens bij opgeteld, want dan verdwijnt het strenge getal in het
   makkelijke. Staat er niets van buitenaf, dan zegt het scherm dat met zoveel
   woorden in plaats van het weg te laten. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api, S = C.S;

  /* Drie standen, drie kleuren. "Onvoldoende gemeten" heeft er bewust een
     eigen: hem groen tonen zou een leeg venster als een gehaald doel laten
     lezen, en dat is precies de fout die dit scherm moet voorkomen. */
  var KLEUR = { 'gehaald': 'ok', 'niet gehaald': 'mis', 'onvoldoende gemeten': 'onbekend' };

  C.TEKENAARS.slo = function (el) {
    el.innerHTML = '<h2 class="ckop">Servicedoelen</h2>' +
      '<p class="lead">Niet wat wij beloven maar wat wij meten, en hoeveel foutbudget er nog over is. ' +
      'Een doel zonder budgetstand is een rapportcijfer achteraf; met budget is de afweging tussen ' +
      'snelheid en stabiliteit een cijfer in plaats van een discussie.</p>' +
      '<div id="sloUit"><div class="leeg">Meten…</div></div>';
    api('slo').then(function (d) {
      var u = '<div class="rooster">' +
        tegel('Gehaald', d.tel.gehaald, d.tel.gehaald ? 'groen' : '', 'van ' + d.tel.doelen + ' doelen') +
        tegel('Niet gehaald', d.tel.gezakt, d.tel.gezakt ? 'acc' : '', 'budget aan het opmaken') +
        tegel('Onvoldoende gemeten', d.tel.onvoldoende, d.tel.onvoldoende ? 'gold' : '', 'te weinig verkeer of te kort venster') +
        '</div>';

      u += '<div class="kaart"><h3>Uitrol</h3><p><b>' + (d.uitrol.mag ? 'Mag' : 'Niet nu') + '.</b> ' +
        esc(d.uitrol.reden) + '</p>' +
        (d.uitrol.onbeoordeeld ? '<p class="meta">' + d.uitrol.onbeoordeeld + ' doel(en) zijn nog niet beoordeeld. ' +
          'Die houden bewust niets tegen: een slot dat na elke herstart een dag dichtzit, wordt omzeild ' +
          'in plaats van gebruikt.</p>' : '') + '</div>';

      for (var i = 0; i < d.doelen.length; i++) u += doelKaart(d.doelen[i]);

      u += '<div class="kaart"><h3>Waar deze cijfers vandaan komen</h3>' +
        '<p class="meta">' + esc(d.bron.binnen) + '</p>' +
        '<p class="meta">' + (d.bron.buiten && d.bron.buiten.gemeten
          ? 'Van buitenaf: ' + d.bron.buiten.pogingen + ' metingen, ' + d.bron.buiten.mislukt + ' mislukt.'
          : 'Van buitenaf: ' + esc((d.bron.buiten && d.bron.buiten.uitleg) || 'niet gemeten')) + '</p>' +
        '<p class="meta">De failover is apart beproefd en niet beweerd: <code>npm run chaos</code> start een ' +
        'eigen trio en schiet de ACTIEVE server om met SIGKILL. De uitslag staat in SLO.md.</p>' +
        '<p class="meta">De doelen staan in ' + esc(d.norm.bestand) + ' (vastgelegd ' + esc(d.norm.vastgelegd) +
        '); een doel telt pas mee vanaf ' + d.norm.minimumVerzoeken + ' verzoeken en ' +
        Math.round(d.norm.minimumDekking * 100) + '% van zijn venster.</p></div>';
      document.querySelector('#sloUit').innerHTML = u;
    }).catch(function (e) {
      if (!e.stil) document.querySelector('#sloUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
    });
  };

  function doelKaart(d) {
    var b = d.budget;
    var waarde = d.gemeten == null ? 'niets gemeten'
      : (d.eenheid === 's' ? '<= ' + d.gemeten + ' s' : d.gemeten + '%');
    var streef = d.eenheid === 's' ? '< ' + d.streef + ' s' : d.streef + '%';
    return '<div class="kaart"><h3>' + esc(d.naam) + '</h3>' +
      '<div class="crij"><span class="cniveau ' + (KLEUR[d.oordeel] || '') + '">' + esc(d.oordeel) + '</span>' +
      '<span class="meta">' + esc(d.meet) + '</span></div>' +
      '<div class="rooster">' +
      tegel('Gemeten', waarde, '', d.metingen + ' metingen') +
      tegel('Streef', streef, '', 'over ' + d.venster.dagen + ' dagen') +
      (b ? tegel('Budget over', Math.round(b.restDeel * 100) + '%',
        b.op ? 'acc' : (b.restDeel < 0.25 ? 'gold' : 'groen'),
        Math.max(0, b.restMinuten) + ' van ' + b.totaalMinuten + ' minuten')
        : tegel('Budget', 'n.v.t.', '', 'een snelheidsdoel heeft geen minutenbudget')) +
      '</div>' +
      '<p class="meta">' + esc(d.uitleg) + '</p>' +
      '<p class="meta">Gemeten venster: ' + Math.round(d.venster.gemetenSeconden / 60) + ' min, ' +
      'dat is ' + (d.venster.dekking * 100).toFixed(1) + '% van de afgesproken ' + d.venster.dagen + ' dagen.' +
      (d.waarom ? ' ' + esc(d.waarom) : '') + '</p></div>';
  }

  function tegel(l, v, k, u) {
    return '<div class="tegel"><div class="l">' + esc(l) + '</div><div class="v ' + (k || '') + '">' + v + '</div>' +
      (u ? '<div class="u">' + esc(u) + '</div>' : '') + '</div>';
  }

  C.TEKENAARS.sonde = function (el) {
    el.innerHTML = '<h2 class="ckop">Sonde</h2>' +
      '<p class="lead">Nepgebruikers die de keten lopen terwijl er niemand kijkt. Ze raken niets aan: ' +
      'de inlogreis logt met opzet verkeerd in en verwacht een afwijzing, want de sonde toetst dat het pad ' +
      'antwoordt en niet dat hij binnenkomt.</p>' +
      '<div id="soUit"><div class="leeg">Ophalen…</div></div>';
    teken();

    function teken() {
      api('sonde', { uren: 24 }).then(function (d) {
        var u = '';
        if (d.let) u += '<div class="kaart"><h3>Let op</h3><p>' + esc(d.let) + '</p></div>';
        u += '<div class="crij"><button class="knop vol" id="soGa">Ronde nu draaien</button>' +
          '<span class="meta">' + d.monsters + ' monsters in ' + d.uren + ' uur, ' +
          d.bewaard + ' bewaard van maximaal ' + d.max + '</span></div>';
        u += kant('Van buitenaf', d.buiten, 'TLS, de proxy en het netwerk zitten hierin. Dit is het cijfer dat telt.');
        u += kant('Van de machine zelf', d.binnen, 'Dit bewijst dat de HTTP-laag antwoordt, niet dat een klant erbij kan.');

        u += '<div class="kaart"><h3>De reizen</h3><div class="schuif"><table class="ctab"><thead><tr>' +
          '<th>Reis</th><th>Pad</th><th>Verwacht</th><th>Max</th></tr></thead><tbody>' +
          d.reizen.map(function (r) {
            return '<tr><td>' + esc(r.naam) + '<div class="meta">' + esc(r.waarom || '') + '</div></td>' +
              '<td class="meta">' + esc(r.methode + ' ' + r.pad) + '</td>' +
              '<td class="meta">' + esc((r.verwacht || []).join('/')) + '</td>' +
              '<td class="meta">' + (r.maxMs || '') + ' ms</td></tr>';
          }).join('') + '</tbody></table></div></div>';

        if (d.storingen.length) {
          u += '<div class="kaart"><h3>Laatste storingen</h3>' + d.storingen.map(function (m) {
            return '<div class="lijn"><b>' + esc(m.reis) + '</b> <span class="meta">' + esc(m.van) + ' · ' +
              esc(m.at) + '</span><div class="meta">' + esc(m.reden || 'zonder reden genoteerd') + '</div></div>';
          }).join('') + '</div>';
        }
        document.querySelector('#soUit').innerHTML = u;
        document.querySelector('#soGa').onclick = function () {
          this.disabled = true;
          api('sonde/draai').then(function (r) { C.meld(r.gelukt + ' van ' + r.van_totaal + ' reizen gelukt'); teken(); })
            .catch(function (e) { if (!e.stil) C.meld(e.message); });
        };
      }).catch(function (e) {
        if (!e.stil) document.querySelector('#soUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
      });
    }
  };

  function kant(titel, k, waarom) {
    var u = '<div class="kaart"><h3>' + esc(titel) + '</h3><p class="meta">' + esc(waarom) + '</p>';
    if (!k.pogingen) return u + '<p>Niets gemeten in dit venster.</p></div>';
    u += '<div class="rooster">' +
      tegel('Gelukt', Math.round(k.deel * 100) + '%', k.deel === 1 ? 'groen' : 'acc', k.gelukt + ' van ' + k.pogingen) +
      tegel('Mislukt', k.mislukt, k.mislukt ? 'acc' : '', 'geen of een onverwacht antwoord') +
      tegel('Te traag', k.traag, k.traag ? 'gold' : '', 'wel geantwoord, over de afgesproken tijd') +
      tegel('p90', (k.p90Ms == null ? '-' : k.p90Ms + ' ms'), '', 'p50 ' + (k.p50Ms == null ? '-' : k.p50Ms + ' ms')) +
      '</div>';
    u += '<div class="schuif"><table class="ctab"><thead><tr><th>Reis</th><th>Gelukt</th><th>p90</th></tr></thead><tbody>' +
      k.reizen.map(function (r) {
        return '<tr><td>' + esc(r.naam) + '</td><td>' + r.gelukt + '/' + r.pogingen + '</td><td class="meta">' +
          (r.p90Ms == null ? '-' : r.p90Ms + ' ms') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
    return u;
  }

  /* Bij "Spiegel" en niet bij "Zien": dit zijn de schermen waarop deze opzet
     zichzelf kan tegenspreken, net als de werkbesparing en het journaal. */
  C.WERKPLEKKEN.push(
    { id: 'slo', naam: 'Servicedoelen', sec: 'Spiegel',
      teller: function (s) { return s.slo && s.slo.tel ? s.slo.tel.gezakt : 0; } },
    { id: 'sonde', naam: 'Sonde', sec: 'Spiegel' });
  void S;
})();
/* RTG Command, deel 11: de herkomst -- waar komt een gegeven vandaan en wie
   hangt ervan af.

   WAT DIT SCHERM ANDERS DOET DAN EEN GEWOON LINEAGE-BORD: het zet bij elk
   antwoord waar het vandaan komt. Gemeten uit de gegevens, aangegeven in een
   tabel die een mens schreef, of gerekend uit die twee. Zet je die drie door
   elkaar in één plaatje, dan krijgt het geheel de betrouwbaarheid van het
   zwakste deel en kan niemand zien welk deel dat is.

   EN DE BLINDE VLEK STAAT BOVENAAN EN NIET IN EEN VOETNOOT. Het journaal ziet
   alleen wat via Command is gegaan. Een soort zonder schrijver betekent hier
   dus niet "hier schrijft niemand in" -- en juist die verwarring is hoe iemand
   iets weggooit waar wel degelijk aan wordt geschreven. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api, S = C.S;

  var AARD = { gemeten: 'ok', aangegeven: 'onbekend', afgeleid: 'mis' };
  function merk(a) {
    return '<span class="cniveau ' + (AARD[a] || '') + '">' + esc(a) + '</span>';
  }

  C.TEKENAARS.herkomst = function (el) {
    el.innerHTML = '<h2 class="ckop">Herkomst</h2>' +
      '<p class="lead">Waar een gegeven vandaan komt, wie eraan mag schrijven, wie het werkelijk deed, ' +
      'hoe lang het blijft, en wat er wees wordt als het verdwijnt. Bij elk antwoord staat of het ' +
      'gemeten is, aangegeven in een tabel, of daaruit gerekend.</p>' +
      '<div id="hkUit"><div class="leeg">Meten…</div></div>';
    api('herkomst').then(function (d) {
      var u = '<div class="kaart"><h3>De blinde vlek</h3><p>' + esc(d.blindeVlek) + '</p></div>';

      u += '<div class="rooster">' +
        tegel('Soorten', d.soorten.length, '', 'in het register van deze laag') +
        tegel('Zonder termijn', d.zonderTermijn.length, d.zonderTermijn.length ? 'gold' : 'groen',
          'staan niet in het bewaarbeleid') +
        tegel('Zonder schrijver', d.zonderSchrijver.length, '', 'niemand schreef hierin via Command') +
        '</div>';

      u += '<div class="kaart"><h3>Zoek de herkomst van één object</h3>' +
        '<div class="crij"><input class="veld smal" id="hkT" placeholder="soort (bv. zaak)">' +
        '<input class="veld smal" id="hkI" placeholder="id">' +
        '<button class="knop vol" id="hkGa">Spoor</button></div><div id="hkSpoor"></div></div>';

      for (var i = 0; i < d.soorten.length; i++) u += soortKaart(d.soorten[i]);
      document.querySelector('#hkUit').innerHTML = u;

      document.querySelector('#hkGa').onclick = function () {
        api('herkomst/spoor', { type: document.querySelector('#hkT').value, id: document.querySelector('#hkI').value })
          .then(teken).catch(function (e) { if (!e.stil) C.meld(e.message); });
      };
    }).catch(function (e) {
      if (!e.stil) document.querySelector('#hkUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
    });
  };

  function soortKaart(k) {
    var u = '<div class="kaart"><h3>' + esc(k.label) + ' <span class="meta">' + esc(k.collectie) + ' · ' +
      k.aantal + '</span></h3>';

    u += '<div class="lijn"><b>Wijst naar</b> ' + merk('gemeten') + '<div class="meta">' +
      (k.heen.length ? k.heen.map(function (h) {
        return esc(h.veld) + ' → ' + esc(h.naar) + ' (' + Math.round(h.deel * 100) + '%)';
      }).join(' · ') : 'geen enkel veld wijst meetbaar naar een andere soort') + '</div></div>';

    u += '<div class="lijn"><b>Hangt hiervan af</b> ' + merk('afgeleid') + '<div class="meta">' +
      esc(k.afhankelijk.uitleg) + '</div></div>';

    u += '<div class="lijn"><b>Mag schrijven</b> ' + merk('aangegeven') + '<div class="meta">' +
      (k.magSchrijven.length ? k.magSchrijven.map(function (m) {
        return esc(m.naam) + ' (' + esc(m.veld) + ')';
      }).join(' · ') : 'geen runbook raakt deze soort aan') + '</div></div>';

    u += '<div class="lijn"><b>Heeft geschreven</b> ' + merk('gemeten') + '<div class="meta">' +
      (k.heeftGeschreven.length ? k.heeftGeschreven.map(function (h) {
        return esc(h.actie) + ' ' + h.aantal + '× (' + h.niveaus.join('/') + ')';
      }).join(' · ') : 'het journaal heeft hier niets over genoteerd') + '</div></div>';

    u += '<div class="lijn"><b>Blijft</b> ' + merk('aangegeven') + '<div class="meta">' +
      (k.bewaren.termijn ? Math.round(k.bewaren.termijn) + ' dagen, grond ' + esc(k.bewaren.grond) + ' -- ' +
        esc(k.bewaren.uitleg) : esc(k.bewaren.uitleg)) + '</div></div>';

    return u + '</div>';
  }

  function teken(w) {
    var u = '<p class="meta" class="mt"><b>' + esc(w.object.titel) + '</b></p>';
    u += rij('Wijst naar', w.wijstNaar.map(function (x) { return x.type + ' ' + x.id + ' (via ' + x.via + ')'; }));
    u += rij('Wordt genoemd door', w.wordtGenoemdDoor.map(function (x) { return x.type + ' ' + x.id; }));
    u += rij('In het journaal', w.journaal.map(function (r) { return r.at + ' ' + r.actie + ' (' + r.actor + ')'; }));
    u += '<div class="lijn"><b>Bewaren</b><div class="meta">' +
      (w.bewaren.vervalt ? 'verloopt op ' + esc(w.bewaren.vervalt) : esc(w.bewaren.uitleg)) +
      (w.bewaren.let ? ' -- ' + esc(w.bewaren.let) : '') + '</div></div>';
    document.querySelector('#hkSpoor').innerHTML = u;
  }

  function rij(kop, lijst) {
    return '<div class="lijn"><b>' + esc(kop) + '</b> <span class="meta">' + lijst.length + '</span>' +
      '<div class="meta">' + (lijst.length ? esc(lijst.slice(0, 12).join(' · ')) : 'niets') + '</div></div>';
  }

  function tegel(l, v, k, u) {
    return '<div class="tegel"><div class="l">' + esc(l) + '</div><div class="v ' + (k || '') + '">' + esc(v) + '</div>' +
      (u ? '<div class="u">' + esc(u) + '</div>' : '') + '</div>';
  }

  var i = C.WERKPLEKKEN.findIndex(function (w) { return w.id === 'graaf'; });
  C.WERKPLEKKEN.splice(i + 1, 0, { id: 'herkomst', naam: 'Herkomst', sec: 'Zien' });
  void S;
})();
/* RTG Command, deel 12: de uitrol (canary) en de zandbak.

   TWEE SCHERMEN DIE ALLEBEI OVER RISICO GAAN, en die het risico dus moeten
   TONEN in plaats van wegpoetsen. Bij de canary is dat de stand van de
   terugroldrempel en het aantal antwoorden waarop die rust; bij de zandbak is
   dat wat een zandbak NIET is. Een knop "ronde draaien" zonder die zinnen
   eromheen nodigt uit tot vertrouwen dat er niet is. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api, S = C.S;

  var KLEUR = { 'binnen de drempel': 'ok', 'over de drempel': 'mis',
    'onvoldoende gemeten': 'onbekend', 'niet te wegen': 'onbekend' };

  C.TEKENAARS.canary = function (el) {
    el.innerHTML = '<h2 class="ckop">Uitrol</h2>' +
      '<p class="lead">Een functie stap voor stap openzetten, met een drempel die hem automatisch ' +
      'terugdraait. De verdeling is vast per persoon en verschilt per functie; anoniem verkeer valt ' +
      'er nooit in, dus op paden die vooral zonder inlog worden gebruikt bereikt en meet een canary ' +
      'bijna niets.</p><div id="caUit"><div class="leeg">Ophalen…</div></div>';
    teken();

    function teken() {
      api('canary').then(function (d) {
        var u = '<div class="rooster">' +
          tegel('Lopend', d.tel.lopend, d.tel.lopend ? 'gold' : '', 'uitrollen die nu gewogen worden') +
          tegel('Teruggerold', d.tel.teruggerold, d.tel.teruggerold ? 'acc' : '', 'over de drempel gegaan') +
          '</div>';

        u += '<div class="kaart"><h3>Nieuwe uitrol</h3>' +
          '<div class="crij"><input class="veld breed" id="caId" placeholder="functie-id (bv. command-zien)">' +
          '<input class="veld kort" id="caDeel" value="0.1" aria-label="deel">' +
          '<button class="knop vol" id="caGa">Starten</button></div>' +
          '<p class="meta">Een canary verdeelt een OPEN functie over de mensen; hij opent geen dichte. ' +
          'Standaard: ' + Math.round(d.standaard.drempel * 1000) / 10 + '% serverfouten is de drempel, ' +
          'vanaf ' + d.standaard.minimum + ' antwoorden.</p></div>';

        if (!d.canaries.length) u += '<div class="kaart"><p>Er loopt geen enkele uitrol.</p></div>';
        for (var i = 0; i < d.canaries.length; i++) u += kaartVan(d.canaries[i]);
        u += '<p class="meta">' + esc(d.uitleg) + '</p>';
        document.querySelector('#caUit').innerHTML = u;

        document.querySelector('#caGa').onclick = function () {
          api('canary/start', { id: document.querySelector('#caId').value,
            deel: Number(document.querySelector('#caDeel').value || 0.1) })
            .then(function () { teken(); }).catch(function (e) { if (!e.stil) C.meld(e.message); });
        };
        Array.prototype.forEach.call(document.querySelectorAll('[data-ca]'), function (b) {
          b.onclick = function () {
            api('canary/' + b.getAttribute('data-ca'), { id: b.getAttribute('data-id'),
              deel: Number(b.getAttribute('data-deel') || 0) })
              .then(function () { teken(); }).catch(function (e) { if (!e.stil) C.meld(e.message); });
          };
        });
      }).catch(function (e) {
        if (!e.stil) document.querySelector('#caUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
      });
    }

    function kaartVan(k) {
      var m = k.meting;
      var u = '<div class="kaart"><h3>' + esc(k.naam) + ' <span class="meta">' + esc(k.id) + '</span></h3>' +
        '<div class="crij"><span class="cniveau ' + (KLEUR[k.oordeel] || '') + '">' + esc(k.oordeel) + '</span>' +
        '<span class="meta">' + Math.round(k.deel * 100) + '% van de mensen · ' + esc(k.stand) + '</span></div>' +
        '<div class="rooster">' +
        tegel('Antwoorden', m.kwijt ? '-' : m.antwoorden, '', 'sinds de nulmeting') +
        tegel('Serverfouten', m.kwijt ? '-' : m.fouten, m.fouten ? 'acc' : '', 'in dezelfde periode') +
        tegel('Drempel', Math.round(k.drempel * 1000) / 10 + '%', '', 'vanaf ' + k.minimum + ' antwoorden') +
        '</div>';
      if (m.kwijt) u += '<p class="meta">' + esc(m.uitleg) + '</p>';
      if (k.reden) u += '<p class="meta">Teruggerold: ' + esc(k.reden) + '</p>';
      if (k.let) u += '<p class="meta">' + esc(k.let) + '</p>';
      u += '<div class="crij">' +
        knop(k.id, 'breder', 'Naar 50%', 0.5) + knop(k.id, 'breder', 'Naar 100%', 1) +
        knop(k.id, 'terug', 'Terugdraaien', 0) + knop(k.id, 'af', 'Afronden', 0) +
        '</div><p class="meta">Afronden is iets anders dan honderd procent: zolang er een canary hangt, ' +
        'loopt er een uitrol die gewogen wordt.</p></div>';
      return u;
    }
    function knop(id, actie, tekst, deel) {
      return '<button class="knop" data-ca="' + actie + '" data-id="' + esc(id) + '" data-deel="' + deel + '">' +
        esc(tekst) + '</button>';
    }
  };

  C.TEKENAARS.zandbak = function (el) {
    el.innerHTML = '<h2 class="ckop">Zandbak</h2>' +
      '<p class="lead">Een proces proeven zonder ook maar één productierij aan te raken. De inhoud komt ' +
      'uit de zaaiset en nooit uit de echte gegevens; de motoren zien een venster op het vak van deze ' +
      'zandbak, dus er is geen pad naar een productiecollectie.</p>' +
      '<div id="zaUit"><div class="leeg">Ophalen…</div></div>';
    teken();

    function teken() {
      api('zandbak').then(function (d) {
        var u = '<div class="kaart"><h3>Wat een zandbak niet is</h3><p>' + esc(d.let) + '</p></div>';
        u += '<div class="kaart"><h3>Nieuwe zandbak</h3><div class="crij">' +
          '<input class="veld mid" id="zaN" placeholder="naam">' +
          '<input class="veld breed" id="zaW" placeholder="waarvoor (optioneel)">' +
          '<button class="knop vol" id="zaGa">Maken</button></div>' +
          '<p class="meta">' + d.zandbakken.length + ' van maximaal ' + d.max + '; standaard ' +
          d.standaardDagen + ' dagen houdbaar. ' + esc(d.uitleg) + '</p></div>';

        for (var i = 0; i < d.zandbakken.length; i++) {
          var z = d.zandbakken[i];
          u += '<div class="kaart"><h3>' + esc(z.naam) + ' <span class="meta">' + z.objecten + ' objecten</span></h3>' +
            '<p class="meta">Gemaakt ' + esc(z.gemaakt) + ' door ' + esc(z.door) + ', vervalt ' + esc(z.vervalt) + '.' +
            (z.waarvoor ? ' ' + esc(z.waarvoor) : '') + '</p>' +
            (z.let ? '<p class="meta">' + esc(z.let) + '</p>' : '') +
            '<div class="crij"><input class="veld mid" data-zoek="' + esc(z.naam) + '" placeholder="zoek in deze zandbak">' +
            '<button class="knop" data-zzoek="' + esc(z.naam) + '">Zoeken</button>' +
            '<button class="knop" data-zkwal="' + esc(z.naam) + '">Kwaliteit meten</button>' +
            '<button class="knop" data-zweg="' + esc(z.naam) + '">Opruimen</button></div>' +
            '<div id="zu-' + esc(z.naam) + '"></div></div>';
        }
        document.querySelector('#zaUit').innerHTML = u;

        document.querySelector('#zaGa').onclick = function () {
          api('zandbak/maak', { naam: document.querySelector('#zaN').value,
            waarvoor: document.querySelector('#zaW').value })
            .then(function () { teken(); }).catch(function (e) { if (!e.stil) C.meld(e.message); });
        };
        hang('data-zweg', function (n) { return api('zandbak/weg', { naam: n }).then(teken); });
        hang('data-zzoek', function (n) {
          var v = document.querySelector('[data-zoek="' + n + '"]').value;
          return api('zandbak/zoek', { naam: n, q: v }).then(function (r) {
            document.querySelector('#zu-' + n).innerHTML = '<p class="meta">' + r.totaal +
              ' treffers in de zandbak: ' + esc((r.treffers || []).map(function (t) { return t.titel; }).join(' · ')) + '</p>';
          });
        });
        hang('data-zkwal', function (n) {
          return api('zandbak/kwaliteit', { naam: n }).then(function (r) {
            document.querySelector('#zu-' + n).innerHTML = '<p class="meta">' + r.tel.defecten +
              ' defecten over ' + r.gemeten.objecten + ' objecten in de zandbak.</p>';
          });
        });
      }).catch(function (e) {
        if (!e.stil) document.querySelector('#zaUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
      });
    }
    function hang(attr, doe) {
      Array.prototype.forEach.call(document.querySelectorAll('[' + attr + ']'), function (b) {
        b.onclick = function () { doe(b.getAttribute(attr)).catch(function (e) { if (!e.stil) C.meld(e.message); }); };
      });
    }
  };

  function tegel(l, v, k, u) {
    return '<div class="tegel"><div class="l">' + esc(l) + '</div><div class="v ' + (k || '') + '">' + esc(v) + '</div>' +
      (u ? '<div class="u">' + esc(u) + '</div>' : '') + '</div>';
  }

  C.WERKPLEKKEN.push(
    { id: 'canary', naam: 'Uitrol', sec: 'Besturen',
      teller: function (s) { return s.start && s.start.canary ? s.start.canary.lopend : 0; } },
    { id: 'zandbak', naam: 'Zandbak', sec: 'Besturen' });
  void S;
})();
/* RTG Command, deel 13: master data.

   DIT SCHERM TOONT EEN VOORSTEL EN GEEN BESLUIT, en dat moet te zien zijn. Bij
   elke groep staat waarom de meter denkt dat het dezelfde partij is EN dat twee
   bedrijven met dezelfde naam in dezelfde stad twee bedrijven kunnen zijn. Dat
   verschil zit niet in de gegevens, dus het hoort ook niet als zekerheid op het
   scherm te staan. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api, S = C.S;

  C.TEKENAARS.mdm = function (el) {
    el.innerHTML = '<h2 class="ckop">Master data</h2>' +
      '<p class="lead">Eén gezaghebbend record per bedrijf en per locatie. De kandidaten zijn gemeten ' +
      'uit de gegevens; welk veld de naam en de plaats draagt komt uit een tabel. Er wordt hier nooit ' +
      'vanzelf samengevoegd.</p><div id="mdUit"><div class="leeg">Meten…</div></div>';
    teken();

    function teken() {
      api('mdm').then(function (d) {
        var u = '<div class="rooster">' +
          tegel('Groepen', d.tel.groepen, d.tel.groepen ? 'gold' : 'groen', d.tel.rijen + ' rijen erin') +
          tegel('Plaatsen', d.tel.plaatsen, '', d.tel.schrijfwijzen + ' met meer dan één schrijfwijze') +
          tegel('Samengevoegd', d.samengevoegd, '', 'rijen met een verwijzing naar een gouden record') +
          '</div><div class="kaart"><h3>De grens van deze meting</h3><p>' + esc(d.let) + '</p>' +
          '<p class="meta">Bronnen: ' + esc(d.bronnen.map(function (b) {
            return b.collectie + ' (' + b.naamVeld + ')'; }).join(', ')) + '</p></div>';

        if (!d.bedrijven.length) u += '<div class="kaart"><p>Geen enkele groep die op elkaar lijkt.</p></div>';
        for (var i = 0; i < d.bedrijven.length; i++) {
          var g = d.bedrijven[i];
          u += '<div class="kaart"><h3>' + esc(g.leden[0].naam) + ' <span class="meta">' + g.aantal + ' rijen · ' +
            esc(g.zekerheid) + '</span></h3><p class="meta">' + esc(g.waarom) + '</p>' +
            '<div class="schuif"><table class="ctab"><thead><tr><th>Soort</th><th>Id</th><th>Naam</th><th>Plaats</th></tr></thead><tbody>' +
            g.leden.map(function (l) {
              return '<tr><td>' + esc(l.soort) + '</td><td>' + esc(l.id) + '</td><td>' + esc(l.naam) +
                '</td><td class="meta">' + esc(l.plaats || '') + '</td></tr>';
            }).join('') + '</tbody></table></div>' +
            '<div class="crij"><button class="knop" data-goud="' + esc(g.sleutel) + '">Gouden record bekijken</button>' +
            '<span class="meta">' + esc(g.let) + '</span></div><div id="mg-' + esc(g.sleutel).replace(/[^a-z0-9]/g, '') + '"></div></div>';
        }

        if (d.locaties.dichtbij.length) {
          u += '<div class="kaart"><h3>Plaatsen die dicht bij elkaar liggen</h3>' +
            d.locaties.dichtbij.map(function (x) {
              return '<div class="lijn"><b>' + esc(x.a) + '</b> en <b>' + esc(x.b) + '</b> ' +
                '<span class="meta">' + x.afstandM + ' m</span><div class="meta">' + esc(x.let) + '</div></div>';
            }).join('') + '</div>';
        }
        document.querySelector('#mdUit').innerHTML = u;

        Array.prototype.forEach.call(document.querySelectorAll('[data-goud]'), function (b) {
          b.onclick = function () {
            var sl = b.getAttribute('data-goud');
            api('mdm/gouden', { sleutel: sl }).then(function (r) {
              document.querySelector('#mg-' + sl.replace(/[^a-z0-9]/g, '')).innerHTML =
                '<p class="meta" class="mt">' + esc(r.uitleg) + '</p>' +
                '<div class="schuif"><table class="ctab"><thead><tr><th>Veld</th><th>Wint</th><th>Van</th><th>Alternatieven</th></tr></thead><tbody>' +
                Object.keys(r.velden).slice(0, 20).map(function (k) {
                  var v = r.velden[k];
                  return '<tr><td>' + esc(k) + '</td><td>' + esc(String(v.waarde).slice(0, 40)) + '</td>' +
                    '<td class="meta">' + esc(v.van) + '</td><td class="meta">' +
                    esc(v.alternatieven.map(function (a) { return String(a.waarde).slice(0, 20); }).join(' · ')) +
                    '</td></tr>';
                }).join('') + '</tbody></table></div>' +
                '<p class="meta">Strijdig: ' + esc(r.strijdig.join(', ') || 'niets') + '. Samenvoegen is ' +
                'mensenwerk en gaat via de API (mdm/samen), zodat het altijd een reden en een journaalregel draagt.</p>';
            }).catch(function (e) { if (!e.stil) C.meld(e.message); });
          };
        });
      }).catch(function (e) {
        if (!e.stil) document.querySelector('#mdUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
      });
    }
  };

  function tegel(l, v, k, u) {
    return '<div class="tegel"><div class="l">' + esc(l) + '</div><div class="v ' + (k || '') + '">' + esc(v) + '</div>' +
      (u ? '<div class="u">' + esc(u) + '</div>' : '') + '</div>';
  }

  var i = C.WERKPLEKKEN.findIndex(function (w) { return w.id === 'herkomst'; });
  C.WERKPLEKKEN.splice(i + 1, 0, { id: 'mdm', naam: 'Master data', sec: 'Zien' });
  void S;
})();
/* RTG Command, deel 14: de overname.

   HET SCHERM LOOPT IN DE VOLGORDE VAN DE MOTOR: inlezen, afbeelden, droogloop,
   uitvoeren. Die volgorde is de veiligheid, dus hij staat ook zo op het scherm
   in plaats van als vier losse knoppen naast elkaar.

   HET ZEGEL STAAT OP DE KNOP. "Uitvoeren met zegel a1b2c3" is geen sier: het
   zegel hoort bij precies de droogloop die eronder staat. Verandert de partij
   of de afbeelding, dan past het niet meer en weigert de server -- zodat je
   nooit het ene rapport goedkeurt en iets anders importeert. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api, S = C.S;

  C.TEKENAARS.overname = function (el) {
    el.innerHTML = '<h2 class="ckop">Overname</h2>' +
      '<p class="lead">De administratie van een overgenomen bedrijf inlezen, in vier stappen waarvan de ' +
      'volgorde de veiligheid is. Uitvoeren kan alleen met het zegel van precies de droogloop die je hebt ' +
      'bekeken, en er wordt nooit iets overschreven.</p>' +
      '<div id="ovUit"><div class="leeg">Ophalen…</div></div>';
    teken();

    function teken() {
      api('overname').then(function (d) {
        var u = '<div class="kaart"><h3>Nieuwe partij inlezen</h3>' +
          '<div class="crij"><input class="veld mid" id="ovN" placeholder="naam van de partij">' +
          '<select class="veld" id="ovS">' + d.soorten.map(function (s2) {
            return '<option value="' + esc(s2.type) + '">' + esc(s2.label) + ' (sleutel: ' + esc(s2.sleutel) + ')</option>';
          }).join('') + '</select></div>' +
          '<label class="lb" for="ovR">De rijen, als JSON-lijst</label>' +
          '<textarea class="veld" id="ovR" placeholder=\'[{"ID":"X1","Naam":"Zaak Een"}]\'></textarea>' +
          '<div class="crij"><button class="knop vol" id="ovGa">Inlezen</button></div>' +
          '<p class="meta">' + esc(d.uitleg) + '</p></div>';

        for (var i = 0; i < d.partijen.length; i++) u += partij(d.partijen[i]);
        document.querySelector('#ovUit').innerHTML = u;

        document.querySelector('#ovGa').onclick = function () {
          var rijen;
          try { rijen = JSON.parse(document.querySelector('#ovR').value || '[]'); }
          catch (e) { return C.meld('Dat is geen geldige JSON.'); }
          api('overname/lees', { naam: document.querySelector('#ovN').value,
            soort: document.querySelector('#ovS').value, rijen: rijen })
            .then(function () { teken(); }).catch(function (e) { if (!e.stil) C.meld(e.message); });
        };
        hang('data-ovd', function (id) { return api('overname/droogloop', { id: id }).then(teken); });
        hang('data-ovt', function (id) { return api('overname/terug', { id: id }).then(teken); });
        Array.prototype.forEach.call(document.querySelectorAll('[data-ova]'), function (b) {
          b.onclick = function () {
            var id = b.getAttribute('data-ova');
            var a = document.querySelector('#ova-' + id).value;
            var afb;
            try { afb = JSON.parse(a || '{}'); } catch (e) { return C.meld('Dat is geen geldige JSON.'); }
            api('overname/afbeelden', { id: id, afbeelding: afb })
              .then(function () { teken(); }).catch(function (e) { if (!e.stil) C.meld(e.message); });
          };
        });
        Array.prototype.forEach.call(document.querySelectorAll('[data-ovv]'), function (b) {
          b.onclick = function () {
            api('overname/voer', { id: b.getAttribute('data-ovv'), zegel: b.getAttribute('data-zegel'),
              reden: 'overname via het scherm' })
              .then(function () { teken(); }).catch(function (e) { if (!e.stil) C.meld(e.message); });
          };
        });
      }).catch(function (e) {
        if (!e.stil) document.querySelector('#ovUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
      });
    }

    function partij(p) {
      var u = '<div class="kaart"><h3>' + esc(p.naam) + ' <span class="meta">' + esc(p.soort) + ' · ' +
        p.rijen + ' rijen · ' + esc(p.stand) + '</span></h3>';
      u += '<label class="lb" for="ova-' + esc(p.id) + '">Afbeelding: ons veld naar hun veld</label>' +
        '<div class="crij"><input class="veld breed" id="ova-' + esc(p.id) + '" value=\'' +
        esc(JSON.stringify(p.afbeelding || {})) + '\'>' +
        '<button class="knop" data-ova="' + esc(p.id) + '">Afbeelden</button>' +
        '<button class="knop" data-ovd="' + esc(p.id) + '">Droogloop</button></div>';
      if (p.rapport) {
        u += '<div class="rooster">' +
          tegel('Gaat erin', p.rapport.erin, 'groen', 'van ' + p.rapport.aangeboden + ' aangeboden') +
          tegel('Gaat er niet in', p.rapport.mis, p.rapport.mis ? 'gold' : '', 'met een reden per rij') +
          '</div>' +
          (p.rapport.misVoorbeelden.length ? '<div class="schuif"><table class="ctab"><thead><tr><th>Regel</th><th>Sleutel</th><th>Waarom niet</th></tr></thead><tbody>' +
            p.rapport.misVoorbeelden.map(function (m) {
              return '<tr><td>' + m.regel + '</td><td>' + esc(m.sleutel || '') + '</td><td class="meta">' +
                esc(m.waarom) + '</td></tr>';
            }).join('') + '</tbody></table></div>' : '');
        if (!p.uitgevoerd) {
          u += '<div class="crij"><button class="knop vol" data-ovv="' + esc(p.id) + '" data-zegel="' +
            esc(p.rapport.zegel) + '">Uitvoeren met zegel ' + esc(p.rapport.zegel) + '</button></div>';
        }
      }
      if (p.uitgevoerd) {
        u += '<p class="meta">Uitgevoerd op ' + esc(p.uitgevoerd.at) + ' door ' + esc(p.uitgevoerd.door) +
          ': ' + p.uitgevoerd.erin + ' rijen erin.</p>' +
          '<div class="crij"><button class="knop" data-ovt="' + esc(p.id) + '">Terugdraaien</button></div>';
      }
      return u + '</div>';
    }
    function hang(attr, doe) {
      Array.prototype.forEach.call(document.querySelectorAll('[' + attr + ']'), function (b) {
        b.onclick = function () { doe(b.getAttribute(attr)).catch(function (e) { if (!e.stil) C.meld(e.message); }); };
      });
    }
  };


  function tegel(l, v, k, u) {
    return '<div class="tegel"><div class="l">' + esc(l) + '</div><div class="v ' + (k || '') + '">' + esc(v) + '</div>' +
      (u ? '<div class="u">' + esc(u) + '</div>' : '') + '</div>';
  }

  C.WERKPLEKKEN.push({ id: 'overname', naam: 'Overname', sec: 'Doen' });
  void S;
})();
/* RTG Command, deel 15: koppelingen en landen.

   TWEE SCHERMEN DIE ALLEBEI IETS TONEN WAT ER NOG NIET IS, en dat is hier geen
   tekortkoming maar de inhoud: de API-poort staat er en er zit niets achter
   (de toelating begint leeg), en een landpakket richt in maar dekt geen
   naleving, dus de mensenwerk-lijst blijft staan na het activeren.

   Op allebei had een groen vinkje gekund. Dat vinkje is precies wat later
   iemand laat denken dat het klaar is. De steden staan in ./command-16.js. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api, S = C.S;

  C.TEKENAARS.apipoort = function (el) {
    el.innerHTML = '<h2 class="ckop">Koppelingen</h2>' +
      '<p class="lead">Sleutels, scopes, quota en uitfasering voor machines, op /api/extern/. Het geheim ' +
      'van een sleutel is één keer te zien en wordt nergens bewaard.</p>' +
      '<div id="apUit"><div class="leeg">Ophalen…</div></div>';
    teken();

    function teken() {
      api('apipoort').then(function (d) {
        var u = '';
        if (d.let) u += '<div class="kaart"><h3>Er staat niets achter deze poort</h3><p>' + esc(d.let) + '</p></div>';
        u += '<div class="rooster">' +
          tegel('Sleutels', d.tel.sleutels, '', d.tel.actief + ' actief van maximaal ' + d.max) +
          tegel('Toegelaten paden', d.tel.paden, d.tel.paden ? '' : 'gold', 'wat een sleutel ooit mag raken') +
          '</div>';

        u += '<div class="kaart"><h3>Een pad toelaten</h3><div class="crij">' +
          '<input class="veld breed" id="apPad" placeholder="/api/extern/...">' +
          '<input class="veld kort" id="apVer" value="v1" aria-label="versie">' +
          '<input class="veld mid" id="apUit2" placeholder="uitfasering (ISO-datum, optioneel)">' +
          '<button class="knop vol" id="apGa">Toelaten</button></div></div>';

        if (d.toelating.length) {
          u += '<div class="kaart"><h3>De toelating</h3><div class="schuif"><table class="ctab"><thead><tr>' +
            '<th>Pad</th><th>Versie</th><th>Uitfasering</th><th></th></tr></thead><tbody>' +
            d.toelating.map(function (t) {
              return '<tr><td>' + esc(t.pad) + '</td><td class="meta">' + esc(t.versie) + '</td><td class="meta">' +
                esc(t.uitfasering || '-') + '</td><td><button class="knop" data-apweg="' + esc(t.pad) +
                '">Eraf</button></td></tr>';
            }).join('') + '</tbody></table></div></div>';
        }

        u += '<div class="kaart"><h3>Een sleutel maken</h3><div class="crij">' +
          '<input class="veld mid" id="apN" placeholder="naam van de koppeling">' +
          '<input class="veld mid" id="apS" placeholder="scope-pad">' +
          '<input class="veld kort" id="apQ" value="1000" aria-label="quotum per uur">' +
          '<button class="knop vol" id="apMaak">Maken</button></div>' +
          '<p class="meta">Een scope buiten de toelating wordt geweigerd en niet stil ingeperkt.</p>' +
          '<div id="apGeheim"></div></div>';

        for (var i = 0; i < d.sleutels.length; i++) {
          var s2 = d.sleutels[i];
          u += '<div class="lijn"><b>' + esc(s2.naam) + '</b> <span class="meta">' + esc(s2.id) +
            (s2.ingetrokken ? ' · ingetrokken' : '') + '</span>' +
            '<div class="meta">' + esc(s2.scopes.map(function (sc) {
              return sc.pad + ' (' + sc.methoden.join('/') + ')'; }).join(' · ')) +
            ' · ' + s2.gebruiktDitUur + '/' + s2.quotaPerUur + ' dit uur · ' + s2.geweigerd + ' geweigerd</div>' +
            (s2.ingetrokken ? '' : '<div class="crij"><button class="knop" data-apin="' + esc(s2.id) +
              '">Intrekken</button></div>') + '</div>';
        }
        document.querySelector('#apUit').innerHTML = u;

        document.querySelector('#apGa').onclick = function () {
          api('apipoort/toelaten', { pad: document.querySelector('#apPad').value,
            versie: document.querySelector('#apVer').value,
            uitfasering: document.querySelector('#apUit2').value || null })
            .then(teken).catch(function (e) { if (!e.stil) C.meld(e.message); });
        };
        document.querySelector('#apMaak').onclick = function () {
          api('apipoort/sleutel', { naam: document.querySelector('#apN').value,
            scopes: [{ pad: document.querySelector('#apS').value }],
            quotaPerUur: Number(document.querySelector('#apQ').value || 1000) })
            .then(function (r) {
              document.querySelector('#apGeheim').innerHTML = '<p class="meta" class="mt">' +
                '<b>' + esc(r.geheim) + '</b><br>' + esc(r.let) + '</p>';
            }).catch(function (e) { if (!e.stil) C.meld(e.message); });
        };
        hang('data-apweg', function (p) { return api('apipoort/toelating-weg', { pad: p }).then(teken); });
        hang('data-apin', function (id) { return api('apipoort/intrekken', { id: id, reden: 'via het scherm' }).then(teken); });
      }).catch(function (e) {
        if (!e.stil) document.querySelector('#apUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
      });
    }
  };

  C.TEKENAARS.land = function (el) {
    el.innerHTML = '<h2 class="ckop">Landen</h2>' +
      '<p class="lead">Een land aanzetten als configuratiebundel. Een pakket dekt de inrichting en nooit ' +
      'de naleving: btw-registratie, loonaangifte en een toezichthouder blijven mensenwerk.</p>' +
      '<div id="laUit"><div class="leeg">Ophalen…</div></div>';
    teken();

    function teken(land) {
      api('land', land ? { land: land } : {}).then(function (d) {
        var u = '';
        if (d.pakketten) {
          u += '<div class="kaart"><h3>De pakketten</h3><div class="schuif"><table class="ctab"><thead><tr>' +
            '<th>Land</th><th>Munt</th><th>Taal</th><th>Aan</th><th>Mensenwerk</th><th></th></tr></thead><tbody>' +
            d.pakketten.map(function (p) {
              return '<tr><td>' + esc(p.naam) + '</td><td class="meta">' + esc(p.valuta) + '</td>' +
                '<td class="meta">' + esc(p.taal) + '</td><td>' + (p.actief ? 'ja' : 'nee') + '</td>' +
                '<td class="meta">' + p.mensenwerk + ' punten</td>' +
                '<td><button class="knop" data-lakijk="' + esc(p.land) + '">Bekijken</button></td></tr>';
            }).join('') + '</tbody></table></div><p class="meta">' + esc(d.let) + '</p></div>';
        } else {
          u += '<div class="kaart"><h3>' + esc(d.naam) + '</h3>' +
            d.onderdelen.map(function (o) {
              return '<div class="lijn"><b>' + esc(o.wat) + '</b> <span class="cniveau ' +
                (o.ligt ? 'ok' : 'mis') + '">' + (o.ligt ? 'ligt er' : 'ontbreekt') + '</span>' +
                '<div class="meta">' + esc(o.uitleg) + ' <i>(' + esc(o.bron) + ')</i></div></div>';
            }).join('') +
            '<div class="crij" class="mt">' +
            '<button class="knop vol" data-laaan="' + esc(d.land) + '">Activeren</button>' +
            '<button class="knop" data-lauit="' + esc(d.land) + '">Terugdraaien</button>' +
            '<button class="knop" data-lakijk="">Terug naar de lijst</button></div></div>' +
            '<div class="kaart"><h3>Blijft mensenwerk</h3><ul>' +
            d.mensenwerk.map(function (m) { return '<li class="meta">' + esc(m) + '</li>'; }).join('') +
            '</ul><p class="meta">' + esc(d.waarschuwing) + '</p></div>';
        }
        document.querySelector('#laUit').innerHTML = u;
        hang('data-lakijk', function (l) { teken(l || null); return Promise.resolve(); });
        hang('data-laaan', function (l) { return api('land/activeer', { land: l }).then(function () { teken(l); }); });
        hang('data-lauit', function (l) { return api('land/terug', { land: l }).then(function () { teken(l); }); });
      }).catch(function (e) {
        if (!e.stil) document.querySelector('#laUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
      });
    }
  };

  function hang(attr, doe) {
    Array.prototype.forEach.call(document.querySelectorAll('[' + attr + ']'), function (b) {
      b.onclick = function () { doe(b.getAttribute(attr)).catch(function (e) { if (!e.stil) C.meld(e.message); }); };
    });
  }
  function tegel(l, v, k, u) {
    return '<div class="tegel"><div class="l">' + esc(l) + '</div><div class="v ' + (k || '') + '">' + esc(v) + '</div>' +
      (u ? '<div class="u">' + esc(u) + '</div>' : '') + '</div>';
  }

  C.WERKPLEKKEN.push(
    { id: 'apipoort', naam: 'Koppelingen', sec: 'Besturen' },
    { id: 'land', naam: 'Landen', sec: 'Besturen' });
  void S;
})();
/* RTG Command, deel 16: de steden en het alarm.

   HET SCHERM TOONT PER STAP OF HIJ GEDAAN IS, en er staat er bewust een tussen
   die dat NOOIT wordt: het stadsweefsel draagt vandaag een geografie zonder
   sleutel "welke stad". Een tweede stad met eigen zones en Stadsdozen is een
   verbouwing van die laag.

   Dat had een groen vinkje kunnen zijn. Dan start iemand Antwerpen, ziet
   "ingericht", en ontdekt een maand later dat elke meting in de zones van de
   eerste stad is geboekt. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api, S = C.S;

  C.TEKENAARS.stad = function (el) {
    el.innerHTML = '<h2 class="ckop">Steden</h2>' +
      '<p class="lead">Een stad inrichten. De stand is met opzet eerlijker dan de knop: "gestart" betekent ' +
      'dat de administratie klaarstaat, niet dat de stad draait.</p>' +
      '<div id="stUit"><div class="leeg">Ophalen…</div></div>';
    teken();

    function teken() {
      api('stad').then(function (d) {
        var u = '<div class="kaart"><h3>Wat een knop hier niet kan</h3><p>' + esc(d.let) + '</p></div>' +
          '<div class="kaart"><h3>Nieuwe stad</h3><div class="crij">' +
          '<input class="veld mid" id="stN" placeholder="naam">' +
          '<input class="veld smal" id="stL" placeholder="landcode (bv. NL)">' +
          '<button class="knop vol" id="stGa">Starten</button></div>' +
          '<p class="meta">Het landpakket van dat land moet aanstaan.</p></div>';

        for (var i = 0; i < d.steden.length; i++) {
          var s2 = d.steden[i];
          u += '<div class="kaart"><h3>' + esc(s2.naam) + ' <span class="meta">' + esc(s2.land) + '</span></h3>' +
            s2.stappen.map(function (p) {
              return '<div class="lijn"><b>' + esc(p.stap) + '</b> <span class="cniveau ' +
                (p.gedaan ? 'ok' : 'onbekend') + '">' + (p.gedaan ? 'gedaan' : 'staat open') + '</span>' +
                '<div class="meta">' + esc(p.uitleg) + '</div></div>';
            }).join('') +
            '<div class="crij" class="mt"><button class="knop" data-stweg="' + esc(s2.naam) +
            '">Stoppen</button></div></div>';
        }
        document.querySelector('#stUit').innerHTML = u;
        document.querySelector('#stGa').onclick = function () {
          api('stad/start', { naam: document.querySelector('#stN').value,
            land: document.querySelector('#stL').value })
            .then(teken).catch(function (e) { if (!e.stil) C.meld(e.message); });
        };
        hang('data-stweg', function (n) { return api('stad/stop', { naam: n }).then(teken); });
      }).catch(function (e) {
        if (!e.stil) document.querySelector('#stUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
      });
    }
  };


  function hang(attr, doe) {
    Array.prototype.forEach.call(document.querySelectorAll('[' + attr + ']'), function (b) {
      b.onclick = function () { doe(b.getAttribute(attr)).catch(function (e) { if (!e.stil) C.meld(e.message); }); };
    });
  }

  /* HET ALARM. Hij hoort bij "Zien" en bovenaan, want een alarm dat je moet
     opzoeken is geen alarm. */
  C.TEKENAARS.alarm = function (el) {
    el.innerHTML = '<h2 class="ckop">Alarm</h2>' +
      '<p class="lead">Een SLO zonder alarm is een rapportcijfer achteraf. Deze piep meet niets zelf: ' +
      'elke controle leest een laag die er al is. En hij gaat af bij het ONTSTAAN en bij het OPLOSSEN, ' +
      'niet elke ronde -- een melding die steeds terugkomt leert mensen om hem weg te klikken.</p>' +
      '<div id="alUit"><div class="leeg">Meten…</div></div>';
    teken();

    function teken() {
      api('alarm').then(function (d) {
        var u = '<div class="rooster">' +
          tegel('Actief', d.tel.actief, d.tel.actief ? 'acc' : 'groen', d.tel.hoog + ' met ernst hoog') +
          tegel('Stilgezet', d.tel.stil, d.tel.stil ? 'gold' : '', 'tijdelijk, met een reden in het journaal') +
          '</div>';
        u += '<div class="kaart"><h3>Waar dit alarm uitkomt</h3><ul>' +
          d.uitgangen.map(function (x) { return '<li class="meta">' + esc(x) + '</li>'; }).join('') +
          '</ul><p class="meta">' + esc(d.let) + '</p></div>';

        if (!d.alarmen.length) u += '<div class="kaart"><p>Geen enkele bevinding.</p></div>';
        for (var i = 0; i < d.alarmen.length; i++) {
          var a = d.alarmen[i];
          var stil = a.stilTot && Date.parse(a.stilTot) > Date.now();
          u += '<div class="lijn"><b>' + esc(a.naam) + '</b> ' +
            '<span class="cniveau ' + (a.actief ? (a.ernst === 'hoog' ? 'mis' : 'onbekend') : 'ok') + '">' +
            (a.actief ? esc(a.ernst) : 'opgelost') + '</span>' +
            (stil ? ' <span class="meta">stil tot ' + esc(a.stilTot) + '</span>' : '') +
            '<div class="meta">' + esc(a.wat) + ' · sinds ' + esc(a.sinds) + '</div>' +
            (a.actief && !stil ? '<div class="crij"><button class="knop" data-alstil="' + esc(a.id) +
              '">8 uur stilzetten</button></div>' : '') + '</div>';
        }
        document.querySelector('#alUit').innerHTML = u;
        hang('data-alstil', function (id) {
          return api('alarm/stil', { id: id, uren: 8, reden: 'stilgezet vanaf het scherm' }).then(teken);
        });
      }).catch(function (e) {
        if (!e.stil) document.querySelector('#alUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
      });
    }
  };

  function tegel(l, v, k, u) {
    return '<div class="tegel"><div class="l">' + esc(l) + '</div><div class="v ' + (k || '') + '">' + esc(v) + '</div>' +
      (u ? '<div class="u">' + esc(u) + '</div>' : '') + '</div>';
  }

  C.WERKPLEKKEN.unshift({ id: 'alarm', naam: 'Alarm', sec: 'Zien',
    teller: function (s) { return s.start && s.start.alarm ? s.start.alarm.actief : 0; } });
  C.WERKPLEKKEN.push({ id: 'stad', naam: 'Steden', sec: 'Besturen' });
  void S;
})();
