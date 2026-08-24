/* RTG School Partner (los deel): de enterprise-werkbank van de directie --
   leerlingadministratie, het dashboard met waarschuwingen, geld en veiligheid.
   De rollen, de koppelingen en het journaal staan in enterprise-beheer.js.

   Twee dingen die dit scherm bewust NIET doet, omdat de server ze ook niet
   doet: het toont geen ranglijst (klassen staan op naam) en er is geen knop om
   een leerling ergens van uit te sluiten omdat er niet betaald is.
   Gebonden vanuit app.js aan het einde van directie(). */
(function () {
  'use strict';
  var A = null, S = null, esc = null, meld = null, wortel = null;

  function kaart(kop, binnen, voet) {
    return '<div class="kaart"><div class="kop">' + kop + '</div>' + binnen +
      (voet ? '<p class="stil h-mt50">' + voet + '</p>' : '') + '</div>';
  }
  function rij(links, rechts) {
    return '<div class="item"><span>' + links + '</span><span class="stil">' + rechts + '</span></div>';
  }
  var euro = function (c) { return '€ ' + ((c || 0) / 100).toFixed(2); };
  var sleutels = function (extra) {
    var o = { schoolCode: S.code, beheerToken: S.token }, k;
    for (k in (extra || {})) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
    return o;
  };

  function bind(api, sessie, escape, melder) {
    A = api; S = sessie; esc = escape; meld = melder;
    wortel = document.getElementById('dEnterprise');
    if (!wortel) return;
    teken();
    if (window.RTGSchoolBeheer) RTGSchoolBeheer.bind(api, sessie, escape, melder, sleutels, { kaart: kaart, rij: rij });
  }

  function teken() {
    Promise.all([
      A('/school/leerling/lijst', sleutels()), A('/school/dashboard', sleutels()),
      A('/school/debiteuren', sleutels()), A('/school/organisatie', sleutels())
    ]).then(function (r) {
      var lln = r[0].body, dash = r[1].body, deb = r[2].body, org = r[3].body;
      if (lln.error) { wortel.innerHTML = ''; return; }
      var t = lln.tellingen || {}, h = '<div class="deel">Leerlingadministratie</div>';

      h += kaart('Leerlingen',
        rij('Ingeschreven', t.ingeschreven || 0) + rij('Aanmeldingen', t.aanmelding || 0) +
        rij('Wachtlijst', t.wachtlijst || 0) + rij('Uitgeschreven', t.uitgeschreven || 0) +
        '<div class="rij h-mt60">' +
        '<input class="veld" id="enNaam" maxlength="60" placeholder="Naam van de leerling" aria-label="Naam van de leerling">' +
        '<select class="veld" id="enKlas" aria-label="Klas" style="flex:0 1 9rem;"><option value="">Zonder klas</option>' +
        (org.klassen || []).map(function (k) { return '<option value="' + esc(k.code) + '">' + esc(k.naam) + '</option>'; }).join('') +
        '</select><button class="knop p" id="enAanmeld" type="button">Meld aan</button></div>',
        'Een aanmelding is nog geen plaats. Plaatsen of op de wachtlijst zetten doet u hieronder, met de klas die hierboven staat gekozen.');

      var open = (lln.leerlingen || []).filter(function (l) { return l.status === 'aanmelding' || l.status === 'wachtlijst'; });
      h += kaart('Te behandelen', open.length ? open.map(function (l) {
        return '<div class="item"><span>' + esc(l.naam) + ' <span class="stil">· ' + esc(l.status) + '</span></span>' +
          '<span class="rij"><button class="knop p" data-en="plaats" data-id="' + esc(l.id) + '">Plaats</button>' +
          '<button class="knop" data-en="wacht" data-id="' + esc(l.id) + '">Wachtlijst</button></span></div>';
      }).join('') : '<p class="stil">Geen openstaande aanmeldingen.</p>');

      h += '<div class="deel">Beeld van de school</div>';
      h += '<div class="kpis">' + [
        ['Aanwezig (30d)', dash.aanwezigheid && dash.aanwezigheid.aanwezigheidsdeel != null
          ? Math.round(dash.aanwezigheid.aanwezigheidsdeel * 100) + '%' : '-'],
        ['Docenten actief', (dash.docenten || {}).actief || 0],
        ['Vandaag uit', (dash.docenten || {}).vandaagUit || 0],
        ['Openstaand', deb.openTotaal != null ? euro(deb.openTotaal) : '-']
      ].map(function (x) { return '<div class="kpi"><b>' + x[1] + '</b><span>' + x[0] + '</span></div>'; }).join('') + '</div>';

      h += kaart('Waarschuwingen', (dash.waarschuwingen || []).length
        ? dash.waarschuwingen.map(function (w) { return '<p class="stil" style="margin:0.25rem 0;">◆ ' + esc(w.tekst) + '</p>'; }).join('')
        : '<p class="stil">Geen waarschuwingen.</p>',
      'Elk signaal noemt zijn eigen rekensom. Tevredenheid staat hier niet: dat meten we nergens, dus verzinnen we het ook niet.');

      h += kaart('Per klas', (dash.klassen || []).map(function (k) {
        return rij(esc(k.naam), (k.leerlingen || 0) + ' leerlingen · gem. ' + (k.gemiddelde == null ? '-' : k.gemiddelde) +
          ' · verzuim ' + (k.verzuim == null ? '-' : Math.round(k.verzuim * 100) + '%'));
      }).join('') || '<p class="stil">Nog geen klassen.</p>', 'Op naam gesorteerd, nooit op prestatie.');

      h += '<div class="deel">Geld</div>';
      h += kaart('Debiteuren', (deb.debiteuren || []).slice(0, 8).map(function (d) {
        return rij(esc(d.naam) + ' <span class="stil">· ' + esc(d.soort) + (d.vrijwillig ? ' (vrijwillig)' : '') + '</span>',
          euro(d.open) + (d.teLaat ? ' · vervallen' : ''));
      }).join('') || '<p class="stil">Niets openstaand.</p>',
      'Een openstaand bedrag heeft geen enkel gevolg voor het onderwijs: er is geen knop die een kind ergens van uitsluit.');

      h += '<div class="deel">Veiligheid</div>';
      h += kaart('Gebouw en calamiteit',
        '<div class="rij"><button class="knop" id="enOntruim" type="button">Toon ontruimingslijst</button>' +
        '<input class="veld" id="enNood" maxlength="400" placeholder="Wat is er aan de hand en wat moet men doen?" aria-label="Noodmelding">' +
        '<button class="knop p" id="enNoodGa" type="button">Meld calamiteit</button>' +
        '<button class="knop" id="enNoodAf" type="button">Alarm afmelden</button></div>' +
        '<div id="enOntruimUit" class="stil h-mt50"></div>',
        'De melding landt in elke klas en dus bij elk gezin. Van de passen wordt alleen de huidige stand bewaard, geen looproute.');

      wortel.innerHTML = h;
      knoppen();
    });
  }

  function knoppen() {
    var q = function (id) { return document.getElementById(id); };
    q('enAanmeld').addEventListener('click', function () {
      var naam = q('enNaam').value.trim();
      if (!naam) return meld('Vul de naam van de leerling in.');
      A('/school/leerling/aanmeld', sleutels({ naam: naam })).then(function (r) {
        meld(r.body.error || 'Aanmelding genoteerd.');
        if (!r.body.error) teken();
      });
    });
    q('enOntruim').addEventListener('click', function () {
      A('/school/ontruiming', sleutels({ reden: 'controle vanuit de werkbank' })).then(function (r) {
        var d = r.body;
        if (d.error) return meld(d.error);
        var namen = function (lijst) { return (lijst || []).map(function (x) { return esc(x.naam); }).join(', ') || '-'; };
        q('enOntruimUit').innerHTML = 'Bron: ' + esc(d.bron) + ' · ' + d.totaal + ' aanwezig.<br>' +
          'Leerlingen: ' + namen(d.leerlingen) + '<br>Personeel: ' + namen(d.personeel) + '<br>Bezoekers: ' + namen(d.bezoekers);
      });
    });
    q('enNoodGa').addEventListener('click', function () {
      var tekst = q('enNood').value.trim();
      if (!tekst) return meld('Schrijf wat er aan de hand is.');
      A('/school/calamiteit', sleutels({ tekst: tekst, soort: 'ontruiming' })).then(function (r) {
        meld(r.body.error || 'De melding staat in elke klas.');
      });
    });
    q('enNoodAf').addEventListener('click', function () {
      A('/school/calamiteit', sleutels({ stop: true })).then(function (r) { meld(r.body.error || 'Het alarm is afgemeld.'); });
    });
    Array.prototype.forEach.call(wortel.querySelectorAll('[data-en]'), function (b) {
      b.addEventListener('click', function () {
        var klas = document.getElementById('enKlas').value;
        A('/school/leerling/besluit', sleutels({ leerlingId: b.dataset.id,
          besluit: b.dataset.en === 'plaats' ? 'plaatsen' : 'wachtlijst', klasCode: klas || undefined }))
          .then(function (r) {
            meld(r.body.error || (r.body.plek ? 'Op de wachtlijst, plek ' + r.body.plek + '.' : 'Geplaatst.'));
            if (!r.body.error) teken();
          });
      });
    });
  }

  window.RTGSchoolEnterprise = { bind: bind };
})();
