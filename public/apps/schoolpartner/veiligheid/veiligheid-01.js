/* RTG School Partner: gebouw en veiligheid -- toegangspassen, bezoekers en
   incidenten. De ontruimingslijst en de calamiteitenknop staan al in
   enterprise.js; dit is de dagelijkse kant eronder.

   Het scherm draagt de scherpste belofte van deze laag zichtbaar mee: van een
   pas bestaat alleen de HUIDIGE stand. Er is hier dus geen "waar was Sanne
   vandaag"-knop, en die kan er ook niet komen -- de server bewaart het niet.
   Wat er wel is, is de vraag die er bij een ontruiming toe doet: wie is nu
   binnen.

   Bij incidenten is de vertrouwelijke stand geen vinkje tussen de andere: hij
   staat bij het label dat zegt wie er dan meeleest. Een incident met een kind
   erin is een dossier over dat kind, en dat gaat niet rond in de lerarenkamer.
   Gebonden vanuit app.js aan het einde van directie(). */
window.RTGSchoolVeiligheid = (function () {
  'use strict';
  var A = null, S = null, esc = null, meld = null, wortel = null, MENSEN = { leerlingen: [], personeel: [] };

  var sleutels = function (extra) {
    var o = { schoolCode: S.code, beheerToken: S.token }, k;
    for (k in (extra || {})) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
    return o;
  };
  var opties = function (rijen, waarde, label) {
    return rijen.map(function (x) { return '<option value="' + esc(x[waarde]) + '">' + esc(x[label]) + '</option>'; }).join('');
  };

  function bind(api, sessie, escape, melder) {
    A = api; S = sessie; esc = escape; meld = melder;
    wortel = document.getElementById('dVeiligheid');
    if (!wortel) return;
    teken();
  }

  function teken() {
    Promise.all([
      A('/school/pas/lijst', sleutels()), A('/school/bezoeker/lijst', sleutels()),
      A('/school/incident/lijst', sleutels({ reden: 'incidentoverzicht in de werkbank' })),
      A('/school/leerling/lijst', sleutels({ status: 'ingeschreven' })),
      A('/school/school/overzicht', sleutels())
    ]).then(function (r) {
      var passen = r[0].body, bezoek = r[1].body, inc = r[2].body, lln = r[3].body, sch = r[4].body;
      if (passen.error) { wortel.innerHTML = ''; return; }
      MENSEN.leerlingen = lln.leerlingen || [];
      MENSEN.personeel = (sch.personeel || []).filter(function (p) { return p.status === 'actief'; });

      wortel.innerHTML = '<div class="deel">Gebouw en veiligheid</div>' +
        pasKaart(passen) + bezoekKaart(bezoek) + incidentKaart(inc);
      knoppen();
    });
  }

  function pasKaart(d) {
    var rijen = (d.passen || []).map(function (p) {
      return '<div class="item"><span>' + esc(p.houder) + ' <span class="stil">· ' + esc(p.soort) +
        (p.binnen ? ' · binnen sinds ' + esc(String(p.sinds || '').slice(11, 16)) + ' (' + esc(p.ingang || '') + ')' : ' · buiten') +
        '</span></span><span class="rij">' +
        (p.status === 'actief'
          ? '<button class="knop" data-passeer="' + esc(p.id) + '" data-richting="' + (p.binnen ? 'uit' : 'in') + '">' +
            (p.binnen ? 'Naar buiten' : 'Naar binnen') + '</button>' +
            '<button class="knop" data-pasblok="' + esc(p.id) + '" data-aan="0">Blokkeer</button>'
          : '<span class="tag">geblokkeerd</span><button class="knop" data-pasblok="' + esc(p.id) + '" data-aan="1">Zet weer aan</button>') +
        '</span></div>';
    }).join('') || '<p class="stil">Nog geen passen uitgegeven.</p>';

    return '<div class="kaart"><div class="kop">Toegangspassen</div>' +
      '<div class="kpis h-mb60">' +
      [['Passen', d.aantal || 0], ['Nu binnen', d.binnen || 0], ['Passages vandaag', d.passagesVandaag || 0]]
        .map(function (x) { return '<div class="kpi"><b>' + x[1] + '</b><span>' + x[0] + '</span></div>'; }).join('') + '</div>' +
      rijen +
      '<div class="rij h-mt60">' +
      '<select class="veld h-kolom9" id="vgSoort" aria-label="Soort pas">' +
      '<option value="leerling">Leerling</option><option value="personeel">Personeel</option><option value="bezoeker">Bezoeker</option></select>' +
      '<select class="veld" id="vgLeerling" aria-label="Voor welke leerling">' + opties(MENSEN.leerlingen, 'id', 'naam') + '</select>' +
      '<select class="veld" id="vgPersoneel" aria-label="Voor welk personeelslid" hidden>' + opties(MENSEN.personeel, 'id', 'naam') + '</select>' +
      '<input class="veld" id="vgHouder" maxlength="60" placeholder="Naam van de houder" aria-label="Naam van de houder" hidden>' +
      '<button class="knop p" id="vgPas" type="button">Geef pas</button></div>' +
      '<p class="stil">' + esc(d.uitleg || '') + ' Voor de vraag die er bij een ontruiming toe doet -- wie is nu binnen -- is de huidige stand genoeg.</p></div>';
  }

  function bezoekKaart(d) {
    var rijen = (d.bezoekers || []).map(function (b) {
      return '<div class="item"><span>' + esc(b.naam) + ' <span class="stil">' +
        (b.organisatie ? '· ' + esc(b.organisatie) + ' ' : '') + (b.voor ? '· voor ' + esc(b.voor) : '') + '</span></span>' +
        (b.binnen ? '<button class="knop" data-bezuit="' + esc(b.id) + '">Teken uit</button>'
          : '<span class="stil">uit om ' + esc(String(b.uitAt || '').slice(11, 16)) + '</span>') + '</div>';
    }).join('') || '<p class="stil">Geen bezoekers geregistreerd.</p>';

    return '<div class="kaart"><div class="kop">Bezoekers (' + (d.binnen || 0) + ' binnen)</div>' + rijen +
      '<div class="rij h-mt60">' +
      '<input class="veld" id="vgBezNaam" maxlength="60" placeholder="Naam" aria-label="Naam van de bezoeker">' +
      '<input class="veld" id="vgBezOrg" maxlength="60" placeholder="Organisatie" aria-label="Organisatie">' +
      '<input class="veld" id="vgBezVoor" maxlength="60" placeholder="Op bezoek bij" aria-label="Op bezoek bij">' +
      '<button class="knop p" id="vgBez" type="button">Meld aan</button></div></div>';
  }

