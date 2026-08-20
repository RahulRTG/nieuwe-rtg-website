/* RTG School Partner: geld. Facturen, betalingen, herinneringen, machtigingen,
   budgetten, subsidies, kantinesaldo en de rapportage -- allemaal aanwezig op
   de server, geen van alle op een scherm.

   Drie regels van de server die dit scherm zichtbaar houdt, omdat ze anders
   alleen in een broncodecommentaar bestaan:

   1. EEN OPENSTAAND BEDRAG HEEFT GEEN GEVOLG VOOR HET ONDERWIJS. Er is hier
      geen knop die een kind ergens van uitsluit, en de zin staat onder elke
      lijst waar geld in staat.
   2. EEN VRIJWILLIGE BIJDRAGE HERINNER JE HOOGUIT EEN KEER. Vaker vragen maakt
      vrijwillig alsnog verplicht; de server weigert de tweede en het scherm
      zegt waarom.
   3. ER WORDT HIER NIETS GEIND. Een machtiging is een vastgelegde afspraak met
      een maximum -- innen doet de bank. Van het rekeningnummer bewaren we vier
      tekens, want meer is niet nodig als je toch niets afschrijft.
   Gebonden vanuit app.js aan het einde van directie(). */
window.RTGSchoolGeld = (function () {
  'use strict';
  var A = null, S = null, esc = null, meld = null, wortel = null, LLN = [];

  var sleutels = function (extra) {
    var o = { schoolCode: S.code, beheerToken: S.token }, k;
    for (k in (extra || {})) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
    return o;
  };
  var euro = function (c) { return '€ ' + ((c || 0) / 100).toFixed(2).replace('.', ','); };

  function bind(api, sessie, escape, melder) {
    A = api; S = sessie; esc = escape; meld = melder;
    wortel = document.getElementById('dGeld');
    if (!wortel) return;
    teken();
  }

  function teken() {
    Promise.all([
      A('/school/debiteuren', sleutels()), A('/school/machtiging/lijst', sleutels()),
      A('/school/financien/rapport', sleutels()), A('/school/leerling/lijst', sleutels({ status: 'ingeschreven' }))
    ]).then(function (r) {
      var deb = r[0].body, mac = r[1].body, rap = r[2].body, lln = r[3].body;
      if (rap.error) { wortel.innerHTML = ''; return; }
      LLN = lln.leerlingen || [];
      var kies = LLN.map(function (l) { return '<option value="' + esc(l.id) + '">' + esc(l.naam) + '</option>'; }).join('');

      wortel.innerHTML = '<div class="deel">Geld</div>' +
        factuurKaart(deb, kies) + machtigingKaart(mac, kies) + budgetKaart(rap) + kantineKaart(kies) + rapportKaart(rap);
      knoppen();
    });
  }

  function factuurKaart(deb, kies) {
    var rijen = (deb.debiteuren || []).slice(0, 30).map(function (d) {
      return '<div class="item"><span>' + esc(d.naam) + ' <span class="stil">· ' + esc(d.nummer) + ' · ' + esc(d.soort) +
        (d.vrijwillig ? ' (vrijwillig)' : '') + (d.teLaat ? ' · vervallen' : '') +
        (d.herinneringen ? ' · ' + d.herinneringen + 'x herinnerd' : '') + '</span></span>' +
        '<span class="rij"><b>' + euro(d.open) + '</b>' +
        '<button class="knop" data-boek="' + esc(d.id) + '" data-open="' + d.open + '">Boek betaling</button>' +
        '<button class="knop" data-herinner="' + esc(d.id) + '">Herinner</button></span></div>';
    }).join('') || '<p class="stil">Niets openstaand.</p>';

    return '<div class="kaart enterprise-breed"><div class="kop">Openstaand (' + euro(deb.openTotaal) + ')</div>' + rijen +
      '<div class="rij" style="margin-top:.6rem;">' +
      '<select class="veld" id="glLeerling" aria-label="Voor welke leerling">' + kies + '</select>' +
      '<select class="veld" id="glSoort" aria-label="Soort factuur" style="flex:0 1 10rem;">' +
      ['schoolgeld', 'ouderbijdrage', 'excursie', 'materiaal', 'kantine', 'overig'].map(function (x) {
        return '<option value="' + x + '">' + x + '</option>'; }).join('') + '</select>' +
      '<input class="veld" id="glOms" maxlength="120" placeholder="Waarvoor" aria-label="Omschrijving">' +
      '<input class="veld" id="glBedrag" type="number" min="0" step="0.5" placeholder="Bedrag" aria-label="Bedrag in euro" style="flex:0 1 8rem;">' +
      '<input class="veld" id="glVervalt" type="date" aria-label="Vervaldatum" style="flex:0 1 10rem;">' +
      '<button class="knop p" id="glFactuur" type="button">Maak factuur</button></div>' +
      '<p class="stil">' + esc(deb.uitleg || '') + '</p></div>';
  }

  function machtigingKaart(mac, kies) {
    var rijen = (mac.machtigingen || []).slice(0, 20).map(function (m) {
      return '<div class="item"><span>' + esc(m.kenmerk) + ' <span class="stil">· ' + esc(m.houder) +
        ' · rekening op ...' + esc(m.ibanEinde) + ' · max ' + euro(m.maxCenten) + ' ' + esc(m.frequentie) + '</span></span>' +
        (m.actief ? '<button class="knop" data-intrek="' + esc(m.id) + '">Trek in</button>'
          : '<span class="tag">ingetrokken</span>') + '</div>';
    }).join('') || '<p class="stil">Geen machtigingen vastgelegd.</p>';

    return '<div class="kaart"><div class="kop">Machtigingen (' + (mac.actief || 0) + ' actief)</div>' + rijen +
      '<div class="rij" style="margin-top:.6rem;">' +
      '<select class="veld" id="glMLeerling" aria-label="Voor welke leerling">' + kies + '</select>' +
      '<input class="veld" id="glMHouder" maxlength="80" placeholder="Naam op de rekening" aria-label="Naam op de rekening">' +
      '<input class="veld" id="glMIban" maxlength="4" placeholder="Laatste 4" aria-label="Laatste vier tekens van het rekeningnummer" style="flex:0 1 7rem;">' +
      '<input class="veld" id="glMMax" type="number" min="0" step="0.5" placeholder="Max per keer" aria-label="Maximum per incasso" style="flex:0 1 9rem;">' +
      '<button class="knop p" id="glMachtiging" type="button">Leg vast</button></div>' +
      '<p class="stil">Er wordt hier niets geïnd en niets afgeschreven: dit is het register van wat er is getekend. Een ouder kan zijn machtiging zelf en per direct stoppen.</p></div>';
  }

  function budgetKaart(rap) {
    var rijen = (rap.budgetten || []).map(function (b) {
      return '<div class="item"><span>' + esc(b.naam) + '</span><span class="' + (b.overschreden ? 'tag' : 'stil') + '">' +
        euro(b.besteed) + ' van ' + euro(b.centen) + (b.overschreden ? ' · overschreden' : ' · ' + euro(b.over) + ' over') + '</span></div>';
    }).join('') || '<p class="stil">Nog geen budgetten.</p>';
    var subs = (rap.subsidies || []).map(function (s) {
      return '<div class="item"><span>' + esc(s.naam) + ' <span class="stil">· ' + esc(s.verstrekker || '-') + '</span></span>' +
        '<span class="stil">' + euro(s.ontvangen) + ' van ' + euro(s.centen) +
        (s.verantwoordVoor ? ' · verantwoorden voor ' + esc(s.verantwoordVoor) : '') + '</span></div>';
    }).join('') || '<p class="stil">Geen subsidies vastgelegd.</p>';

    return '<div class="kaart"><div class="kop">Budgetten</div>' + rijen +
      '<div class="rij" style="margin-top:.5rem;">' +
      '<input class="veld" id="glBNaam" maxlength="60" placeholder="Naam (afdeling of doel)" aria-label="Naam van het budget">' +
      '<input class="veld" id="glBBedrag" type="number" min="0" step="1" placeholder="Budget" aria-label="Budget in euro" style="flex:0 1 8rem;">' +
      '<input class="veld" id="glBBesteed" type="number" min="0" step="1" placeholder="Besteding boeken" aria-label="Besteding in euro" style="flex:0 1 9rem;">' +
      '<input class="veld" id="glBWat" maxlength="120" placeholder="Waaraan" aria-label="Waaraan besteed">' +
      '<button class="knop" id="glBudget" type="button">Zet budget</button></div>' +
      '<div class="kop" style="margin-top:.8rem;">Subsidies</div>' + subs +
      '<div class="rij" style="margin-top:.5rem;">' +
      '<input class="veld" id="glSNaam" maxlength="80" placeholder="Naam" aria-label="Naam van de subsidie">' +
      '<input class="veld" id="glSVer" maxlength="80" placeholder="Verstrekker" aria-label="Verstrekker">' +
      '<input class="veld" id="glSBedrag" type="number" min="0" step="1" placeholder="Toegekend" aria-label="Toegekend bedrag" style="flex:0 1 8rem;">' +
      '<input class="veld" id="glSOnt" type="number" min="0" step="1" placeholder="Ontvangen" aria-label="Ontvangen bedrag" style="flex:0 1 8rem;">' +
      '<button class="knop" id="glSubsidie" type="button">Noteer</button></div></div>';
  }

